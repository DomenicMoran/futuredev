"""Self-consistent local audio provenance helpers (not a release authenticity claim)."""
from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
from typing import Any, Callable


PIPELINE_SCHEMA_VERSION = 2
GENERATION_SCHEMA_VERSION = 1


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_speech_json(blocks: list[dict[str, Any]]) -> str:
    """Canonical input: JSON.stringify([{speaker,text}, ...]) with field order fixed."""
    payload = [{"speaker": block["speaker"], "text": block["text"]} for block in blocks]
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def speech_sha256(blocks: list[dict[str, Any]]) -> str:
    return sha256_bytes(canonical_speech_json(blocks).encode("utf-8"))


def block_speech_sha256(speaker: str, text: str) -> str:
    return sha256_bytes(f"{speaker}\n{text}".encode("utf-8"))


def text_sha256(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def atomic_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".partial", dir=path.parent)
    temp = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def read_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def complete_work_document(lesson_id: str, blocks: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schemaVersion": PIPELINE_SCHEMA_VERSION,
        "lessonId": lesson_id,
        "speechSha256": speech_sha256(blocks),
        "blocks": [
            {
                "index": index,
                "speaker": block["speaker"],
                "textSha256": text_sha256(block["text"]),
                "speechSha256": block_speech_sha256(block["speaker"], block["text"]),
                "file": f"{lesson_id}-b{index + 1:03d}.mp3",
                "state": "pending",
            }
            for index, block in enumerate(blocks)
        ],
    }


def verified_work_rows(
    lesson_id: str,
    blocks: list[dict[str, Any]],
    work_dir: Path,
    ffprobe: str,
    mp3_ok: Callable[[Path, str], bool],
    duration_seconds: Callable[[Path, str], float],
) -> tuple[dict[str, Any], dict[int, Path]]:
    """Read only v2 rows whose exact text binding and bytes are both verified."""
    expected = complete_work_document(lesson_id, blocks)
    previous = read_json(work_dir / f"{lesson_id}.checksums.json")
    ready: dict[int, Path] = {}
    if not isinstance(previous, dict) or previous.get("schemaVersion") != PIPELINE_SCHEMA_VERSION:
        return expected, ready
    if previous.get("lessonId") != lesson_id or previous.get("speechSha256") != expected["speechSha256"]:
        return expected, ready
    old_rows = previous.get("blocks")
    if not isinstance(old_rows, list):
        return expected, ready
    for row in expected["blocks"]:
        index = row["index"]
        if index >= len(old_rows):
            continue
        old = old_rows[index]
        if not isinstance(old, dict):
            continue
        if any(old.get(key) != row.get(key) for key in ("index", "speaker", "textSha256", "speechSha256", "file")):
            continue
        path = work_dir / row["file"]
        if old.get("state") != "rendered" or not path.is_file() or not mp3_ok(path, ffprobe):
            continue
        if old.get("audioBytes") != path.stat().st_size or old.get("audioSha256") != sha256_file(path):
            continue
        try:
            measured_duration = duration_seconds(path, ffprobe)
        except (OSError, subprocess.CalledProcessError):
            continue
        recorded_duration = finite_duration_seconds(old.get("durationSeconds"))
        if recorded_duration is None or finite_duration_seconds(measured_duration) is None or abs(recorded_duration - measured_duration) > 0.05:
            continue
        row.update({"state": "rendered", "audioBytes": old["audioBytes"], "audioSha256": old["audioSha256"], "durationSeconds": round(measured_duration, 6)})
        ready[index] = path
    return expected, ready


def reusable_proven_blocks(
    lesson_id: str,
    blocks: list[dict[str, Any]],
    out_dir: Path,
    ffprobe: str,
    mp3_ok: Callable[[Path, str], bool],
    duration_seconds: Callable[[Path, str], float],
) -> dict[str, Path]:
    """Map proven speech hashes to verified prior block files; legacy 16-char checksums are not proof."""
    document = read_json(out_dir / f"{lesson_id}.provenance.json")
    if not isinstance(document, dict) or document.get("schemaVersion") != GENERATION_SCHEMA_VERSION or document.get("lessonId") != lesson_id:
        return {}
    if not is_sha256(document.get("speechSha256")):
        return {}
    audio_path = out_dir / f"{lesson_id}.mp3"
    cues_path = out_dir / f"{lesson_id}.cues.json"
    if document.get("audioFile") != audio_path.name or document.get("cuesFile") != cues_path.name:
        return {}
    if not audio_path.is_file() or not cues_path.is_file() or not mp3_ok(audio_path, ffprobe):
        return {}
    if document.get("audioBytes") != audio_path.stat().st_size or document.get("audioSha256") != sha256_file(audio_path):
        return {}
    if document.get("cuesBytes") != cues_path.stat().st_size or document.get("cuesSha256") != sha256_file(cues_path):
        return {}
    cues = read_json(cues_path)
    if not isinstance(cues, dict) or cues.get("lessonId") != lesson_id or not isinstance(cues.get("blocks"), list):
        return {}
    rows = document.get("blocks")
    cue_rows = cues["blocks"]
    if not isinstance(rows, list) or not rows or len(cue_rows) != len(rows):
        return {}
    found: dict[str, Path] = {}
    block_root = out_dir / lesson_id
    current_by_binding = {
        (block.get("speaker"), text_sha256(block.get("text", ""))): block
        for block in blocks
        if isinstance(block, dict) and isinstance(block.get("speaker"), str) and isinstance(block.get("text"), str)
    }
    seen_indices: set[int] = set()
    timeline = 0.0
    for row_position, row in enumerate(rows):
        if not isinstance(row, dict) or row.get("state") != "rendered":
            return {}
        file_name = row.get("file")
        digest = row.get("audioSha256")
        speech_hash = row.get("speechSha256")
        index = row.get("index")
        speaker = row.get("speaker")
        text_digest = row.get("textSha256")
        if not isinstance(index, int) or index < 0 or index in seen_indices or index != row_position:
            return {}
        seen_indices.add(index)
        if not isinstance(file_name, str) or Path(file_name).name != file_name or file_name != f"{lesson_id}-b{index + 1:03d}.mp3":
            return {}
        if not is_sha256(digest) or not is_sha256(speech_hash) or not is_row_speaker(speaker) or not is_row_text_digest(text_digest):
            return {}
        current_block = current_by_binding.get((speaker, text_digest))
        binding_matches = current_block is not None and speech_hash == block_speech_sha256(speaker, current_block["text"])
        path = block_root / file_name
        if not path.is_file() or not mp3_ok(path, ffprobe):
            continue
        if row.get("audioBytes") != path.stat().st_size or digest != sha256_file(path):
            continue
        try:
            measured_duration = duration_seconds(path, ffprobe)
        except (OSError, subprocess.CalledProcessError):
            return {}
        recorded_duration = finite_duration_seconds(row.get("durationSeconds"))
        if recorded_duration is None or finite_duration_seconds(measured_duration) is None or abs(recorded_duration - measured_duration) > 0.05:
            return {}
        cue = cue_rows[index]
        if not isinstance(cue, dict) or cue.get("index") != index or cue.get("speaker") != speaker:
            return {}
        if index:
            prior_speaker = rows[index - 1].get("speaker")
            if not is_row_speaker(prior_speaker):
                return {}
            timeline += 0.3 if prior_speaker == speaker else 0.6
        cue_start = finite_start_seconds(cue.get("startSeconds"))
        cue_duration = finite_duration_seconds(cue.get("durationSeconds"))
        if cue_start is None or cue_duration is None or abs(cue_start - timeline) > 0.005 or abs(cue_duration - measured_duration) > 0.005:
            return {}
        timeline += measured_duration
        if binding_matches:
            found.setdefault(speech_hash, path)
    if sorted(seen_indices) != list(range(len(rows))):
        return {}
    return found


def is_sha256(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(character in "0123456789abcdef" for character in value)


def is_json_number(value: Any) -> bool:
    """JSON numbers only: int/float, never bool or numeric strings."""
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def finite_start_seconds(value: Any) -> float | None:
    if not is_json_number(value):
        return None
    number = float(value)
    if not math.isfinite(number) or number < 0:
        return None
    return number


def finite_duration_seconds(value: Any) -> float | None:
    if not is_json_number(value):
        return None
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        return None
    return number


def is_row_speaker(value: Any) -> bool:
    return isinstance(value, str)


def is_row_text_digest(value: Any) -> bool:
    return is_sha256(value)


def is_generation_current(
    lesson_id: str,
    blocks: list[dict[str, Any]],
    out_dir: Path,
    ffprobe: str,
    mp3_ok: Callable[[Path, str], bool],
    duration_seconds: Callable[[Path, str], float],
) -> bool:
    marker = read_json(out_dir / f"{lesson_id}.provenance.json")
    audio = out_dir / f"{lesson_id}.mp3"
    cues_file = out_dir / f"{lesson_id}.cues.json"
    if not isinstance(marker, dict) or marker.get("schemaVersion") != GENERATION_SCHEMA_VERSION:
        return False
    if marker.get("lessonId") != lesson_id or marker.get("speechSha256") != speech_sha256(blocks):
        return False
    if marker.get("audioFile") != audio.name or marker.get("cuesFile") != cues_file.name:
        return False
    if not audio.is_file() or not cues_file.is_file() or not mp3_ok(audio, ffprobe):
        return False
    if marker.get("audioBytes") != audio.stat().st_size or marker.get("audioSha256") != sha256_file(audio):
        return False
    if marker.get("cuesBytes") != cues_file.stat().st_size or marker.get("cuesSha256") != sha256_file(cues_file):
        return False
    cues = read_json(cues_file)
    rows = marker.get("blocks")
    if not isinstance(cues, dict) or cues.get("lessonId") != lesson_id or not isinstance(cues.get("blocks"), list):
        return False
    if not isinstance(rows, list) or len(rows) != len(blocks) or len(cues["blocks"]) != len(blocks):
        return False
    cursor = 0.0
    for index, (block, row, cue) in enumerate(zip(blocks, rows, cues["blocks"], strict=True)):
        if not isinstance(row, dict) or not isinstance(cue, dict):
            return False
        if row.get("index") != index or row.get("speaker") != block.get("speaker") or row.get("textSha256") != text_sha256(block.get("text", "")):
            return False
        if row.get("speechSha256") != block_speech_sha256(block.get("speaker", ""), block.get("text", "")):
            return False
        expected_block_file = f"{lesson_id}-b{index + 1:03d}.mp3"
        if row.get("file") != expected_block_file:
            return False
        block_path = out_dir / lesson_id / expected_block_file
        if not block_path.is_file() or not mp3_ok(block_path, ffprobe):
            return False
        if row.get("audioBytes") != block_path.stat().st_size or row.get("audioSha256") != sha256_file(block_path):
            return False
        if cue.get("index") != index or cue.get("speaker") != block.get("speaker"):
            return False
        if index:
            previous_speaker = blocks[index - 1].get("speaker")
            gap = 0.3 if previous_speaker == block.get("speaker") else 0.6
            cursor += gap
        try:
            measured_duration = duration_seconds(block_path, ffprobe)
        except (OSError, subprocess.CalledProcessError):
            return False
        row_duration = finite_duration_seconds(row.get("durationSeconds"))
        cue_start = finite_start_seconds(cue.get("startSeconds"))
        cue_duration = finite_duration_seconds(cue.get("durationSeconds"))
        if row_duration is None or finite_duration_seconds(measured_duration) is None or cue_start is None or cue_duration is None:
            return False
        if abs(row_duration - measured_duration) > 0.05:
            return False
        if abs(cue_start - cursor) > 0.005 or abs(cue_duration - measured_duration) > 0.005:
            return False
        if cue.get("isKeySentence") is not bool(block.get("isKeySentence")):
            return False
        role = block.get("role", "body")
        expected_section = {"faq": "faq", "terms_list": "terms", "example": "example"}.get(role, "body")
        if cue.get("section") != expected_section:
            return False
        cursor += measured_duration
    try:
        actual_duration = duration_seconds(audio, ffprobe)
    except (OSError, subprocess.CalledProcessError):
        return False
    marker_duration = finite_duration_seconds(marker.get("durationSeconds"))
    if marker_duration is None or finite_duration_seconds(actual_duration) is None:
        return False
    if abs(actual_duration - cursor) > 0.35:
        return False
    if abs(marker_duration - actual_duration) > 0.05:
        return False
    return True
