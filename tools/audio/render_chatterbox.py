#!/usr/bin/env python3
"""
FutureDev: Lektionen lokal mit Chatterbox Multilingual V3 vertonen.

Spiegel der Node-Pipeline (tools/audio/src/render-lesson.ts):
- je speechBlock eine MP3 unter tools/audio/out/<id>/<id>-bNNN.mp3
- Checksums abbruchfest, atomare Block-Writes, Resume mit MP3-Validierung
- ffmpeg-Concat mit 300/600 ms Stille
- Cue-Sidecar <id>.cues.json

Aufruf:
  .venv-chatterbox\\Scripts\\python.exe -u render_chatterbox.py --lesson M01-04-03
  .venv-chatterbox\\Scripts\\python.exe -u render_chatterbox.py --all-missing
  .venv-chatterbox\\Scripts\\python.exe -u render_chatterbox.py --all-missing --supervise
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time
import traceback
import uuid
from pathlib import Path

from pipeline_contract import (
    GENERATION_SCHEMA_VERSION,
    atomic_write_json,
    block_speech_sha256,
    finite_duration_seconds,
    finite_start_seconds,
    is_generation_current,
    is_row_speaker,
    reusable_proven_blocks,
    sha256_file,
    speech_sha256,
    text_sha256,
    verified_work_rows,
)

# Unbuffered + weniger tqdm-Rauschen (haeufige Ursache toter Redirect-Logs)
os.environ.setdefault("PYTHONUNBUFFERED", "1")
os.environ.setdefault("TQDM_DISABLE", "1")

ROOT = Path(__file__).resolve().parents[2]
LESSONS_DIR = ROOT / "content" / "lessons"
OUT_DIR = Path(__file__).resolve().parent / "out"
VOICES_DIR = Path(__file__).resolve().parent / "chatterbox-voices"
REF_A = VOICES_DIR / "speaker-A.wav"
REF_B = VOICES_DIR / "speaker-B.wav"
PROGRESS_PATH = OUT_DIR / "_chatterbox_progress.json"
CONTROL_PATH = OUT_DIR / "_chatterbox_control.json"
LOCK_PATH = OUT_DIR / "_chatterbox_batch.lock"
_LOCK_HANDLE = None
_LOCK_TOKEN: str | None = None

EXIT_PAUSED = 75

SAME_SPEAKER_SILENCE_MS = 300
SPEAKER_CHANGE_SILENCE_MS = 600

FFMPEG = os.environ.get("FFMPEG") or "ffmpeg"
FFPROBE = os.environ.get("FFPROBE") or "ffprobe"

# CUDA-OOM / Soft-Hang: Block einmal retryen, danach Lektion skippen
BLOCK_RETRIES = 2
MIN_BLOCK_BYTES = 800
MIN_BLOCK_SECONDS = 0.08


def log(msg: str) -> None:
    print(msg, flush=True)


def find_ffmpeg() -> tuple[str, str]:
    ffmpeg = FFMPEG
    ffprobe = FFPROBE
    if Path(ffmpeg).name == "ffmpeg" and not Path(ffmpeg).is_file():
        candidates = list(
            Path(r"C:\Users\domen\AppData\Local\Microsoft\WinGet\Packages").glob(
                "**/ffmpeg-*/bin/ffmpeg.exe"
            )
        )
        if candidates:
            ffmpeg = str(candidates[0])
            ffprobe = str(candidates[0].with_name("ffprobe.exe"))
    return ffmpeg, ffprobe


def block_checksum(speaker: str, text: str) -> str:
    return block_speech_sha256(speaker, text)


def section_from_role(role: str) -> str:
    if role == "faq":
        return "faq"
    if role == "terms_list":
        return "terms"
    if role == "example":
        return "example"
    return "body"


def duration_seconds(path: Path, ffprobe: str) -> float:
    out = subprocess.check_output(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def mp3_ok(path: Path, ffprobe: str) -> bool:
    if not path.is_file():
        return False
    if path.stat().st_size < MIN_BLOCK_BYTES:
        return False
    try:
        return duration_seconds(path, ffprobe) >= MIN_BLOCK_SECONDS
    except (subprocess.CalledProcessError, ValueError, OSError):
        return False


def ensure_silence(path: Path, ms: int, ffmpeg: str) -> None:
    if path.exists():
        try:
            if path.stat().st_size > 128 and abs(duration_seconds(path, find_ffmpeg()[1]) - ms / 1000) <= 0.04:
                return
        except (OSError, ValueError, subprocess.CalledProcessError):
            pass
        archive = OUT_DIR / "_archive" / "_silence" / f"{path.stem}-{time.strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:8]}.mp3"
        archive.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, archive)
        log(f"Stille-Datei war ungueltig/abweichend; Original gesichert: {archive}")
    tmp = path.with_name(f".{path.stem}.{uuid.uuid4().hex[:8]}.partial.mp3")
    try:
        subprocess.check_call(
            [
                ffmpeg,
                "-y",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=r=24000:cl=mono",
                "-t",
                f"{ms / 1000:.3f}",
                "-q:a",
                "9",
                str(tmp),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        ffprobe = find_ffmpeg()[1]
        if tmp.stat().st_size <= 128 or abs(duration_seconds(tmp, ffprobe) - ms / 1000) > 0.04:
            raise RuntimeError(f"Generierte Stille ist ungültig: {ms} ms")
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def concat_lesson(
    lesson_id: str,
    blocks: list[dict],
    block_paths: list[Path],
    out_mp3: Path,
    ffmpeg: str,
    ffprobe: str,
) -> list[float]:
    durations = [duration_seconds(p, ffprobe) for p in block_paths]
    silence_dir = OUT_DIR / "_silence"
    silence_dir.mkdir(parents=True, exist_ok=True)
    s300 = silence_dir / "300.mp3"
    s600 = silence_dir / "600.mp3"
    ensure_silence(s300, SAME_SPEAKER_SILENCE_MS, ffmpeg)
    ensure_silence(s600, SPEAKER_CHANGE_SILENCE_MS, ffmpeg)

    list_file = out_mp3.with_suffix(".concat.txt")
    lines: list[str] = []
    for i, block in enumerate(blocks):
        if i > 0:
            prev = blocks[i - 1]["speaker"]
            silence = s300 if prev == block["speaker"] else s600
            lines.append(f"file '{silence.as_posix()}'")
        lines.append(f"file '{block_paths[i].as_posix()}'")
    list_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

    tmp_out = Path(str(out_mp3) + ".partial.mp3")
    subprocess.check_call(
        [
            ffmpeg,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_file),
            "-c:a",
            "libmp3lame",
            "-q:a",
            "4",
            str(tmp_out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    list_file.unlink(missing_ok=True)
    if not mp3_ok(tmp_out, ffprobe):
        tmp_out.unlink(missing_ok=True)
        raise RuntimeError(f"Concat ungültig: {out_mp3.name}")
    os.replace(tmp_out, out_mp3)
    return durations


def build_cues(lesson_id: str, blocks: list[dict], durations: list[float]) -> dict:
    cue_blocks = []
    cursor = 0.0
    for i, block in enumerate(blocks):
        if i > 0:
            prev = blocks[i - 1]["speaker"]
            cursor += (
                SAME_SPEAKER_SILENCE_MS if prev == block["speaker"] else SPEAKER_CHANGE_SILENCE_MS
            ) / 1000.0
        dur = durations[i]
        cue_blocks.append(
            {
                "index": i,
                "speaker": block["speaker"],
                "startSeconds": round(cursor, 3),
                "durationSeconds": round(dur, 3),
                "isKeySentence": bool(block.get("isKeySentence")),
                "section": section_from_role(block.get("role", "body")),
            }
        )
        cursor += dur
    return {"lessonId": lesson_id, "blocks": cue_blocks}


def read_desired() -> str:
    if not CONTROL_PATH.exists():
        return "run"
    try:
        data = json.loads(CONTROL_PATH.read_text(encoding="utf-8-sig"))
        desired = data.get("desired", "run")
        return desired if desired in ("run", "pause") else "run"
    except (json.JSONDecodeError, OSError):
        return "run"


def set_desired(desired: str, reason: str = "") -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "desired": desired if desired in ("run", "pause") else "run",
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "reason": reason,
    }
    CONTROL_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def read_progress_status() -> str:
    try:
        if PROGRESS_PATH.exists():
            return str(json.loads(PROGRESS_PATH.read_text(encoding="utf-8")).get("status", ""))
    except (json.JSONDecodeError, OSError):
        pass
    return ""


def refresh_paused_progress() -> None:
    extra: dict[str, object] = {}
    try:
        if PROGRESS_PATH.exists():
            data = json.loads(PROGRESS_PATH.read_text(encoding="utf-8"))
            # Do not forward status/phase — write_progress sets those explicitly.
            for key in (
                "lessonId",
                "block",
                "totalBlocks",
                "speaker",
                "index",
                "remaining",
            ):
                if key in data:
                    extra[key] = data[key]
    except (json.JSONDecodeError, OSError):
        pass
    write_progress(status="paused", phase="paused", **extra)


def exit_if_pause_requested() -> None:
    if read_desired() == "pause":
        refresh_paused_progress()
        raise SystemExit(EXIT_PAUSED)


def write_progress(**fields: object) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "pid": os.getpid(),
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "updatedUnix": time.time(),
        **fields,
    }
    tmp = PROGRESS_PATH.with_suffix(".json.partial")
    data = json.dumps(payload, indent=2) + "\n"
    # Windows: Antivirus/Indexer can briefly lock the progress file; retry replace.
    last_err: OSError | None = None
    for attempt in range(8):
        try:
            tmp.write_text(data, encoding="utf-8")
            os.replace(tmp, PROGRESS_PATH)
            return
        except OSError as err:
            last_err = err
            time.sleep(0.05 * (attempt + 1))
    if last_err is not None:
        raise last_err


def acquire_lock() -> None:
    global _LOCK_HANDLE, _LOCK_TOKEN
    if _LOCK_HANDLE is not None:
        raise RuntimeError("Batch-Lock wurde in diesem Prozess bereits gehalten")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fd = os.open(LOCK_PATH, os.O_CREAT | os.O_RDWR, 0o600)
    handle = os.fdopen(fd, "r+b", buffering=0)
    try:
        if os.fstat(handle.fileno()).st_size == 0:
            handle.write(b"\0")
            handle.flush()
        handle.seek(0)
        try:
            if sys.platform == "win32":
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (OSError, BlockingIOError) as exc:
            raise SystemExit(f"Anderer Batch haelt den exklusiven OS-Lock (Lock-Datei: {LOCK_PATH}).") from exc
        _LOCK_TOKEN = uuid.uuid4().hex
        payload = json.dumps({"pid": os.getpid(), "token": _LOCK_TOKEN, "startedAt": time.strftime("%Y-%m-%dT%H:%M:%S")}) + "\n"
        handle.seek(0)
        handle.truncate(0)
        handle.write(payload.encode("utf-8"))
        handle.flush()
        os.fsync(handle.fileno())
        _LOCK_HANDLE = handle
    except BaseException:
        handle.close()
        raise


def release_lock() -> None:
    global _LOCK_HANDLE, _LOCK_TOKEN
    handle = _LOCK_HANDLE
    if handle is None:
        return
    try:
        handle.seek(0)
        if sys.platform == "win32":
            import msvcrt
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
    finally:
        handle.close()
        _LOCK_HANDLE = None
        _LOCK_TOKEN = None


def load_model(device: str):
    import inspect
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    weights = Path(__file__).resolve().parent / "chatterbox-weights"
    required = [
        "ve.pt",
        "s3gen.pt",
        "t3_mtl23ls_v3.safetensors",
        "conds.pt",
        "grapheme_mtl_merged_expanded_v1.json",
        "Cangjie5_TC.json",
    ]
    local_ok = weights.is_dir() and all(
        (weights / f).exists() and (weights / f).stat().st_size > 0 for f in required
    )

    log(f"Lade Chatterbox Multilingual auf {device}...")
    if local_ok:
        log(f"from_local {weights} (t3_model=v3)")
        sig = inspect.signature(ChatterboxMultilingualTTS.from_local)
        kwargs = {"ckpt_dir": str(weights), "device": device}
        if "t3_model" in sig.parameters:
            kwargs["t3_model"] = "v3"
        model = ChatterboxMultilingualTTS.from_local(**kwargs)
    else:
        log(
            "Lokale Gewichte fehlen — rufe zuerst download_chatterbox_weights.py auf "
            "(oder setze HF_TOKEN in .env.local)."
        )
        sig = inspect.signature(ChatterboxMultilingualTTS.from_pretrained)
        kwargs = {"device": device}
        if "t3_model" in sig.parameters:
            kwargs["t3_model"] = "v3"
        model = ChatterboxMultilingualTTS.from_pretrained(**kwargs)
    log("Modell geladen.")
    return model


def speak_block(model, text: str, speaker: str, wav_out: Path, device: str) -> None:
    import numpy as np
    import soundfile as sf
    import torch

    ref = REF_A if speaker == "A" else REF_B
    wav = model.generate(
        text,
        language_id="de",
        audio_prompt_path=str(ref),
        exaggeration=0.45,
        cfg_weight=0.4,
    )
    if isinstance(wav, torch.Tensor):
        audio = wav.detach().cpu().numpy()
    else:
        audio = np.asarray(wav)
    if audio.ndim == 2:
        audio = audio[0] if audio.shape[0] <= 2 else audio.reshape(-1)
    audio = np.asarray(audio, dtype=np.float32)

    # Endung muss .wav/.mp3 bleiben — soundfile/ffmpeg lesen das Format aus der Extension
    wav_tmp = Path(str(wav_out) + ".partial.wav")
    partial = Path(str(wav_out) + ".partial.mp3")
    ffmpeg, ffprobe = find_ffmpeg()
    try:
        sf.write(str(wav_tmp), audio, int(model.sr), format="WAV")
        subprocess.check_call(
            [
                ffmpeg,
                "-y",
                "-i",
                str(wav_tmp),
                "-codec:a",
                "libmp3lame",
                "-q:a",
                "4",
                str(partial),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if not mp3_ok(partial, ffprobe):
            raise RuntimeError(f"Block-MP3 ungültig: {wav_out.name}")
        os.replace(partial, wav_out)
    finally:
        wav_tmp.unlink(missing_ok=True)
        partial.unlink(missing_ok=True)
        if device.startswith("cuda"):
            torch.cuda.empty_cache()


def speak_block_retry(model, text: str, speaker: str, wav_out: Path, device: str) -> None:
    import torch

    last: BaseException | None = None
    for attempt in range(1, BLOCK_RETRIES + 1):
        try:
            speak_block(model, text, speaker, wav_out, device)
            return
        except Exception as exc:  # noqa: BLE001 — Batch darf einzelnen Block retryen
            last = exc
            log(f"    Retry {attempt}/{BLOCK_RETRIES} nach Fehler: {exc}")
            if device.startswith("cuda"):
                try:
                    torch.cuda.empty_cache()
                    torch.cuda.synchronize()
                except Exception:  # noqa: BLE001
                    pass
            time.sleep(1.5 * attempt)
    assert last is not None
    raise last


def validate_archived_generation(archive: Path, lesson_id: str, marker: dict) -> str | None:
    """Return a validation problem; raw-byte archive is retained even for damaged legacy pairs."""
    audio_path = archive / f"{lesson_id}.mp3"
    cues_path = archive / f"{lesson_id}.cues.json"
    marker_path = archive / f"{lesson_id}.provenance.json"
    try:
        archived_marker = json.loads(marker_path.read_text(encoding="utf-8"))
        cues = json.loads(cues_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return "old-generation-json-unreadable"
    if archived_marker != marker or not audio_path.is_file() or not cues_path.is_file():
        return "old-generation-archive-incomplete"
    if marker.get("audioBytes") != audio_path.stat().st_size or marker.get("audioSha256") != sha256_file(audio_path):
        return "old-audio-integrity-mismatch"
    if marker.get("cuesBytes") != cues_path.stat().st_size or marker.get("cuesSha256") != sha256_file(cues_path):
        return "old-cues-integrity-mismatch"
    rows = marker.get("blocks")
    cue_rows = cues.get("blocks") if isinstance(cues, dict) else None
    if not isinstance(rows, list) or not isinstance(cue_rows, list) or cues.get("lessonId") != lesson_id or len(cue_rows) != len(rows):
        return "old-cue-block-count-mismatch"
    cursor = 0.0
    for index, row in enumerate(rows):
        if not isinstance(row, dict) or row.get("index") != index or row.get("file") != f"{lesson_id}-b{index + 1:03d}.mp3":
            return "old-block-row-invalid"
        block_path = archive / lesson_id / row["file"]
        cue = cue_rows[index]
        if not block_path.is_file() or row.get("audioBytes") != block_path.stat().st_size or row.get("audioSha256") != sha256_file(block_path):
            return "old-block-integrity-mismatch"
        if not isinstance(cue, dict) or cue.get("index") != index or cue.get("speaker") != row.get("speaker"):
            return "old-cue-row-invalid"
        if not is_row_speaker(row.get("speaker")):
            return "old-block-row-invalid"
        if index:
            prior_speaker = rows[index - 1].get("speaker")
            if not is_row_speaker(prior_speaker):
                return "old-block-row-invalid"
            cursor += SAME_SPEAKER_SILENCE_MS / 1000 if prior_speaker == row.get("speaker") else SPEAKER_CHANGE_SILENCE_MS / 1000
        try:
            measured = duration_seconds(block_path, find_ffmpeg()[1])
        except (OSError, subprocess.CalledProcessError):
            return "old-block-duration-invalid"
        recorded = finite_duration_seconds(row.get("durationSeconds"))
        cue_start = finite_start_seconds(cue.get("startSeconds"))
        cue_duration = finite_duration_seconds(cue.get("durationSeconds"))
        if recorded is None or finite_duration_seconds(measured) is None or cue_start is None or cue_duration is None:
            return "old-block-duration-invalid"
        if abs(recorded - measured) > 0.05 or abs(cue_start - cursor) > 0.005 or abs(cue_duration - measured) > 0.005:
            return "old-cue-timeline-mismatch"
        cursor += measured
    if not mp3_ok(audio_path, find_ffmpeg()[1]):
        return "old-final-audio-invalid"
    try:
        final_duration = duration_seconds(audio_path, find_ffmpeg()[1])
    except (OSError, subprocess.CalledProcessError):
        return "old-final-duration-unavailable"
    marker_duration = finite_duration_seconds(marker.get("durationSeconds"))
    if marker_duration is None or finite_duration_seconds(final_duration) is None:
        return "old-final-duration-unavailable"
    if abs(cursor - final_duration) > 0.35 or abs(marker_duration - final_duration) > 0.05:
        return "old-final-timeline-mismatch"
    return None


def publish_generation(
    lesson_id: str,
    blocks: list[dict],
    work_dir: Path,
    block_rows: list[dict],
    staged_audio: Path,
    staged_cues: Path,
    duration: float,
) -> dict:
    """Archive old files, invalidate marker, replace pair, then atomically publish provenance last."""
    generation_id = f"{time.strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:10]}"
    archive = OUT_DIR / "_archive" / lesson_id / generation_id
    out_audio = OUT_DIR / f"{lesson_id}.mp3"
    out_cues = OUT_DIR / f"{lesson_id}.cues.json"
    out_marker = OUT_DIR / f"{lesson_id}.provenance.json"
    old_blocks = OUT_DIR / lesson_id
    previous_marker = None
    previous_problem = None
    if out_marker.exists():
        try:
            previous_marker = json.loads(out_marker.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            previous_problem = "old-marker-unreadable"
        if (
            not isinstance(previous_marker, dict)
            or previous_marker.get("schemaVersion") != GENERATION_SCHEMA_VERSION
            or previous_marker.get("lessonId") != lesson_id
            or previous_marker.get("audioFile") != out_audio.name
            or previous_marker.get("cuesFile") != out_cues.name
            or not isinstance(previous_marker.get("blocks"), list)
        ):
            previous_problem = "old-marker-generation-invalid"
            previous_marker = None
    elif out_audio.exists() or out_cues.exists() or (old_blocks.exists() and any(old_blocks.glob(f"{lesson_id}-b*.mp3"))):
        previous_problem = "unproven-prior-files"
    archive_files = [out_audio, out_cues, out_marker]
    # Keep legacy/unreferenced final-index blocks too; the archival write is additive and
    # never removes or overwrites prior outputs.
    if old_blocks.exists():
        archive_files.extend(sorted(old_blocks.glob(f"{lesson_id}-b*.mp3")))
    archive_files = list(dict.fromkeys(archive_files))
    archived_raw_files = []
    for source in archive_files:
        if source.is_file():
            destination = archive / source.relative_to(OUT_DIR)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            if destination.stat().st_size != source.stat().st_size or sha256_file(destination) != sha256_file(source):
                raise RuntimeError(f"Roharchivierung der vorherigen Datei fehlgeschlagen: {source.name}")
            archived_raw_files.append({"path": str(source.relative_to(OUT_DIR)).replace("\\", "/"), "bytes": destination.stat().st_size, "sha256": sha256_file(destination)})

    if previous_marker is not None:
        previous_problem = previous_problem or validate_archived_generation(archive, lesson_id, previous_marker)
    elif out_marker.exists() and previous_problem is None:
        previous_problem = "old-marker-unusable"
    if previous_problem:
        atomic_write_json(archive / "quarantine.json", {
            "schemaVersion": 1,
            "lessonId": lesson_id,
            "classification": "corrupt-prior-generation-raw-copy",
            "reason": previous_problem,
            "files": archived_raw_files,
        })

    if not mp3_ok(staged_audio, find_ffmpeg()[1]):
        raise RuntimeError("Staging-MP3 vor Veröffentlichung ungültig")
    cues_payload = json.loads(staged_cues.read_text(encoding="utf-8"))
    if cues_payload.get("lessonId") != lesson_id or len(cues_payload.get("blocks", [])) != len(blocks):
        raise RuntimeError("Staging-Cues passen nicht zur Lektion")

    # Marker entfernt zuerst: während des Paarwechsels gilt keine Generation als fertig.
    out_marker.unlink(missing_ok=True)
    os.replace(staged_audio, out_audio)
    os.replace(staged_cues, out_cues)

    old_blocks.mkdir(parents=True, exist_ok=True)
    for row in block_rows:
        source = work_dir / row["file"]
        destination = old_blocks / row["file"]
        if not source.is_file() or sha256_file(source) != row.get("audioSha256"):
            raise RuntimeError(f"Block-Provenienz vor Veröffentlichung stimmt nicht: {row['file']}")
        if not destination.is_file() or sha256_file(destination) != row["audioSha256"]:
            partial = destination.with_name(f".{destination.name}.{generation_id}.partial")
            shutil.copy2(source, partial)
            os.replace(partial, destination)

    marker = {
        "schemaVersion": GENERATION_SCHEMA_VERSION,
        "generationId": generation_id,
        "lessonId": lesson_id,
        "speechSha256": speech_sha256(blocks),
        "speechSha256Definition": "SHA256(UTF8(JSON.stringify([{speaker,text}, ...]))); field order speaker,text; compact JSON; lesson block order; Unicode UTF-8",
        "audioFile": out_audio.name,
        "audioBytes": out_audio.stat().st_size,
        "audioSha256": sha256_file(out_audio),
        "cuesFile": out_cues.name,
        "cuesBytes": out_cues.stat().st_size,
        "cuesSha256": sha256_file(out_cues),
        "durationSeconds": duration,
        "blocks": block_rows,
        "provenance": "local-byte-self-consistency; not proof of editorial approval or published-source authenticity",
    }
    atomic_write_json(out_marker, marker)
    if not is_generation_current(lesson_id, blocks, OUT_DIR, find_ffmpeg()[1], mp3_ok, duration_seconds):
        out_marker.unlink(missing_ok=True)
        raise RuntimeError("Veröffentlichte Audio-/Cue-Generation besteht Integritätsprüfung nicht")
    return marker


def render_lesson(model, lesson_id: str, probe_blocks: int | None, device: str) -> None:
    ffmpeg, ffprobe = find_ffmpeg()
    path = LESSONS_DIR / f"{lesson_id}.json"
    if not path.exists():
        raise SystemExit(f"Lektion fehlt: {path}")
    lesson = json.loads(path.read_text(encoding="utf-8"))
    all_blocks = lesson["speechBlocks"]
    if not isinstance(all_blocks, list) or not all_blocks:
        raise RuntimeError(f"Keine speechBlocks für {lesson_id}")
    if not all(isinstance(block, dict) and isinstance(block.get("speaker"), str) and isinstance(block.get("text"), str) for block in all_blocks):
        raise RuntimeError(f"Ungültige speaker/text-Felder in {lesson_id}")
    probe = probe_blocks is not None
    blocks = all_blocks[:probe_blocks] if probe else all_blocks
    if probe:
        log(f"PROBE: nur erste {len(blocks)} Bloecke in isoliertem Verzeichnis")

    full_speech_hash = speech_sha256(blocks)
    if not probe and is_generation_current(lesson_id, blocks, OUT_DIR, ffprobe, mp3_ok, duration_seconds):
        log(f"{lesson_id}: aktuelle gebundene Audio-/Cue-Generation bereits vorhanden")
        write_progress(lessonId=lesson_id, status="already-current", phase="done", speechSha256=full_speech_hash)
        return
    if probe:
        work_dir = OUT_DIR / "_probes" / f"{lesson_id}-{time.strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:8]}"
    else:
        work_dir = OUT_DIR / lesson_id / f".work-{full_speech_hash[:16]}"
    work_dir.mkdir(parents=True, exist_ok=True)
    checksum_path = work_dir / f"{lesson_id}.checksums.json"
    document, ready = verified_work_rows(lesson_id, blocks, work_dir, ffprobe, mp3_ok, duration_seconds)
    prior_blocks = {} if probe else reusable_proven_blocks(lesson_id, blocks, OUT_DIR, ffprobe, mp3_ok, duration_seconds)

    block_paths = [work_dir / row["file"] for row in document["blocks"]]
    t0 = time.time()
    for i, block in enumerate(blocks):
        row = document["blocks"][i]
        bp = block_paths[i]
        if i in ready:
            write_progress(lessonId=lesson_id, block=i + 1, totalBlocks=len(blocks), status="skip-proven", phase="blocks", probe=probe)
            continue

        reusable = prior_blocks.get(row["speechSha256"])
        if reusable is not None and mp3_ok(reusable, ffprobe):
            shutil.copy2(reusable, bp)
            log(f"  Block {i + 1}/{len(blocks)} exakt aus gebundener Provenienz wiederverwendet")
        else:
            log(f"  Block {i + 1}/{len(blocks)} (Sprecher {block['speaker']})")
            exit_if_pause_requested()
            write_progress(lessonId=lesson_id, block=i + 1, totalBlocks=len(blocks), status="rendering", phase="blocks", speaker=block["speaker"], probe=probe)
            speak_block_retry(model, block["text"], block["speaker"], bp, device)

        if not mp3_ok(bp, ffprobe):
            raise RuntimeError(f"Block nach Resume/Render ungueltig: {bp.name}")
        row.update({
            "state": "rendered",
            "audioBytes": bp.stat().st_size,
            "audioSha256": sha256_file(bp),
            "durationSeconds": round(duration_seconds(bp, ffprobe), 6),
        })
        # Full expected index map is replaced atomically after every verified block.
        atomic_write_json(checksum_path, document)
        ready[i] = bp
        write_progress(lessonId=lesson_id, block=i + 1, totalBlocks=len(blocks), status="block-done", phase="blocks", probe=probe)

    if len(ready) != len(blocks):
        raise RuntimeError(f"Unvollständige Blockgeneration {lesson_id}: {len(ready)}/{len(blocks)}")
    if probe:
        atomic_write_json(checksum_path, document)

    staged_audio = work_dir / f"{lesson_id}.mp3"
    staged_cues = work_dir / f"{lesson_id}.cues.json"
    log("  Zusammenfuegen...")
    write_progress(lessonId=lesson_id, status="probe-concat" if probe else "concat", phase="concat", totalBlocks=len(blocks), probe=probe)
    durations = concat_lesson(lesson_id, blocks, block_paths, staged_audio, ffmpeg, ffprobe)
    cues = build_cues(lesson_id, blocks, durations)
    atomic_write_json(staged_cues, cues)
    total = duration_seconds(staged_audio, ffprobe)
    if abs((cues["blocks"][-1]["startSeconds"] + cues["blocks"][-1]["durationSeconds"]) - total) > 0.35:
        raise RuntimeError("Cues stimmen nicht mit echter MP3-Gesamtdauer überein")
    if probe:
        log(f"  Probe fertig (isoliert): {work_dir}")
        write_progress(lessonId=lesson_id, status="probe-complete", phase="done", outMp3=staged_audio.name, durationSeconds=round(total, 3), probeDirectory=str(work_dir))
        return

    marker = publish_generation(lesson_id, blocks, work_dir, document["blocks"], staged_audio, staged_cues, total)
    mins = int(total // 60)
    secs = int(total % 60)
    log(f"  fertig: {lesson_id}.mp3, {marker['audioBytes'] // 1024} KB, {mins:02d}:{secs:02d} Min, {time.time() - t0:.0f}s Wall")
    write_progress(lessonId=lesson_id, status="done", phase="done", outMp3=marker["audioFile"], durationSeconds=round(total, 3), speechSha256=marker["speechSha256"], audioSha256=marker["audioSha256"], cuesSha256=marker["cuesSha256"], wallSeconds=round(time.time() - t0, 1))


def missing_lesson_ids() -> list[str]:
    ids = sorted(p.stem for p in LESSONS_DIR.glob("*.json"))
    return [lesson_id for lesson_id in ids if not lesson_generation_is_current(lesson_id)]


def lesson_generation_is_current(lesson_id: str) -> bool:
    try:
        lesson = json.loads((LESSONS_DIR / f"{lesson_id}.json").read_text(encoding="utf-8"))
        blocks = lesson["speechBlocks"]
        return bool(
            isinstance(blocks, list)
            and blocks
            and all(isinstance(block, dict) and isinstance(block.get("speaker"), str) and isinstance(block.get("text"), str) for block in blocks)
            and is_generation_current(lesson_id, blocks, OUT_DIR, find_ffmpeg()[1], mp3_ok, duration_seconds)
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError, TypeError, KeyError):
        return False


def supervisor_pause_loop() -> None:
    """GPU frei: kein Worker-Start bis desired==run."""
    log("Supervisor: Pause aktiv — warte auf Resume (desired=run)...")
    while read_desired() == "pause":
        refresh_paused_progress()
        time.sleep(5)
    log("Supervisor: Resume — Batch wird fortgesetzt.")


def select_supervised_targets(lesson_id: str | None, all_missing: bool, limit: int | None) -> list[str]:
    if lesson_id:
        return [lesson_id]
    if not all_missing:
        raise ValueError("Supervisor braucht --lesson ID oder --all-missing")
    targets = missing_lesson_ids()
    return targets[:limit] if limit is not None else targets


def run_supervised(target_lesson_ids: list[str], stall_seconds: int, device: str, fail_fast: bool) -> int:
    """Restart workers only for the fixed, initially authorized target set."""
    targets = list(dict.fromkeys(target_lesson_ids))
    if not targets:
        log("Supervisor: Zielmenge ist leer.")
        return 0
    py = sys.executable
    script = str(Path(__file__).resolve())
    backoff = 5
    round_n = 0
    while True:
        missing = [lesson_id for lesson_id in targets if not lesson_generation_is_current(lesson_id)]
        if not missing:
            log("Supervisor: nichts fehlt.")
            return 0
        if read_desired() == "pause":
            supervisor_pause_loop()
            continue
        round_n += 1
        log(f"Supervisor Runde {round_n}: {len(missing)} fehlend, starte Worker...")
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["TQDM_DISABLE"] = "1"
        # Concrete lesson IDs prevent the child from expanding the request to the corpus.
        cmd = [py, "-u", script, "--lesson-ids", *missing, "--device", device]
        if fail_fast:
            cmd.append("--fail-fast")
        proc = subprocess.Popen(cmd, env=env)
        last_seen = time.time()
        last_progress = ""
        while proc.poll() is None:
            time.sleep(5)
            paused = read_desired() == "pause" or read_progress_status() == "paused"
            if paused:
                last_seen = time.time()
                continue
            try:
                raw = PROGRESS_PATH.read_text(encoding="utf-8") if PROGRESS_PATH.exists() else ""
            except OSError:
                raw = ""
            if raw and raw != last_progress:
                last_progress = raw
                last_seen = time.time()
            elif time.time() - last_seen > stall_seconds:
                log(
                    f"Supervisor: Stall >{stall_seconds}s ohne Progress — kill pid={proc.pid}"
                )
                proc.kill()
                try:
                    proc.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    pass
                break
        code = proc.returncode if proc.returncode is not None else -9
        still = [lesson_id for lesson_id in targets if not lesson_generation_is_current(lesson_id)]
        if not still:
            log("Supervisor: alle Lektionen fertig.")
            return 0
        if (
            code == EXIT_PAUSED
            or read_desired() == "pause"
            or read_progress_status() == "paused"
        ):
            supervisor_pause_loop()
            backoff = 5
            continue
        log(f"Supervisor: Worker exit={code}, noch {len(still)} fehlend. Warte {backoff}s...")
        time.sleep(backoff)
        backoff = min(backoff * 2, 120)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lesson", help="Eine Lektions-ID")
    parser.add_argument("--lesson-ids", nargs="+", help=argparse.SUPPRESS)
    parser.add_argument("--all-missing", action="store_true")
    parser.add_argument("--probe-blocks", type=int, default=None)
    parser.add_argument("--report-only", action="store_true", help="Maschinenlesbarer Freshness-Plan ohne Modell/GPU")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--limit", type=int, default=None, help="Max. Lektionen bei --all-missing")
    parser.add_argument(
        "--supervise",
        action="store_true",
        help="Äusserer Watchdog: restart bei Crash/Stall",
    )
    parser.add_argument(
        "--stall-seconds",
        type=int,
        default=900,
        help="Supervisor: Sekunden ohne Progress-Update bis Kill (default 900)",
    )
    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        default=True,
        help="Bei --all-missing nach Lektionsfehler weiter (default an)",
    )
    parser.add_argument(
        "--fail-fast",
        action="store_true",
        help="Bei Lektionsfehler abbrechen",
    )
    args = parser.parse_args()

    if args.lesson and args.lesson_ids:
        raise SystemExit("--lesson und --lesson-ids sind nicht kombinierbar")
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit muss mindestens 1 sein")
    if args.probe_blocks is not None and (
        args.probe_blocks < 1 or not args.lesson or args.all_missing or args.supervise
    ):
        raise SystemExit("--probe-blocks braucht genau --lesson ID; Probe ist nicht mit --all-missing/--supervise kombinierbar")
    if args.report_only and (args.supervise or args.probe_blocks is not None or (not args.lesson and not args.all_missing)):
        raise SystemExit("--report-only braucht --lesson ID oder --all-missing und ist nicht mit Probe/Supervisor kombinierbar")

    if args.report_only:
        if args.lesson:
            try:
                lesson = json.loads((LESSONS_DIR / f"{args.lesson}.json").read_text(encoding="utf-8"))
                blocks = lesson["speechBlocks"]
            except (OSError, UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError):
                blocks = []
            current = isinstance(blocks, list) and blocks and all(isinstance(block, dict) and isinstance(block.get("speaker"), str) and isinstance(block.get("text"), str) for block in blocks) and is_generation_current(args.lesson, blocks, OUT_DIR, find_ffmpeg()[1], mp3_ok, duration_seconds)
            missing = [] if current else [args.lesson]
        else:
            missing = missing_lesson_ids()
        print(json.dumps({"status": "stale-audio-plan", "missingLessonIds": missing, "count": len(missing)}, ensure_ascii=False, indent=2))
        return

    if args.supervise:
        try:
            targets = select_supervised_targets(args.lesson, args.all_missing, args.limit)
        except ValueError as exc:
            raise SystemExit(str(exc)) from exc
        raise SystemExit(run_supervised(targets, args.stall_seconds, args.device, args.fail_fast))

    if not REF_A.exists() or not REF_B.exists():
        raise SystemExit(f"Referenzstimmen fehlen unter {VOICES_DIR}")

    if args.lesson:
        if args.probe_blocks is None:
            try:
                existing = json.loads((LESSONS_DIR / f"{args.lesson}.json").read_text(encoding="utf-8"))["speechBlocks"]
                if is_generation_current(args.lesson, existing, OUT_DIR, find_ffmpeg()[1], mp3_ok, duration_seconds):
                    log(f"{args.lesson}: aktuelle verifizierte Audio-/Cue-Generation vorhanden")
                    return
            except (OSError, UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError):
                pass
        ids = [args.lesson]
    elif args.lesson_ids:
        ids = list(dict.fromkeys(args.lesson_ids))
        missing_files = [lesson_id for lesson_id in ids if not (LESSONS_DIR / f"{lesson_id}.json").is_file()]
        if missing_files:
            raise SystemExit(f"Lektionsdateien fehlen: {', '.join(missing_files)}")
    elif args.all_missing:
        ids = missing_lesson_ids()
        if args.limit is not None:
            ids = ids[: args.limit]
        log(f"{len(ids)} fehlende Lektionen")
    else:
        raise SystemExit("Bitte --lesson ID oder --all-missing")

    import torch

    device = args.device
    if device == "cuda" and not torch.cuda.is_available():
        log("CUDA nicht verfuegbar, Fallback cpu")
        device = "cpu"

    acquire_lock()
    failed: list[str] = []
    try:
        model = load_model(device)
        write_progress(status="model-ready", phase="init", remaining=len(ids))
        for idx, lesson_id in enumerate(ids, start=1):
            exit_if_pause_requested()
            log(f"==== {lesson_id} ({idx}/{len(ids)}) ====")
            write_progress(
                lessonId=lesson_id,
                status="start",
                phase="lesson",
                index=idx,
                remaining=len(ids) - idx + 1,
            )
            try:
                render_lesson(model, lesson_id, args.probe_blocks, device)
            except Exception as exc:  # noqa: BLE001
                failed.append(lesson_id)
                log(f"FEHLER {lesson_id}: {exc}")
                traceback.print_exc()
                write_progress(
                    lessonId=lesson_id,
                    status="error",
                    phase="error",
                    error=str(exc),
                )
                if args.fail_fast or not args.continue_on_error:
                    raise
                # CUDA-Zustand nach schwerem Fehler bereinigen
                if device.startswith("cuda"):
                    try:
                        torch.cuda.empty_cache()
                    except Exception:  # noqa: BLE001
                        pass
        if failed:
            log(f"Batch Ende mit {len(failed)} Fehlern: {', '.join(failed)}")
            raise SystemExit(1)
        log("Batch komplett.")
        write_progress(status="batch-complete", phase="done", remaining=0)
    finally:
        release_lock()


if __name__ == "__main__":
    main()
