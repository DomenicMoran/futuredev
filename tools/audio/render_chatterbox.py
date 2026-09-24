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
import hashlib
import json
import os
import subprocess
import sys
import time
import traceback
from pathlib import Path

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
    return hashlib.sha256(f"{speaker}\n{text}".encode("utf-8")).hexdigest()[:16]


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
        return
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
            str(path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


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
            for key in (
                "lessonId",
                "block",
                "totalBlocks",
                "speaker",
                "index",
                "remaining",
                "phase",
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
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if LOCK_PATH.exists():
        try:
            data = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
            old_pid = int(data.get("pid", 0))
            if old_pid and _pid_alive(old_pid):
                raise SystemExit(
                    f"Anderer Batch laeuft bereits (pid={old_pid}). "
                    f"Lock: {LOCK_PATH}"
                )
        except (json.JSONDecodeError, OSError, ValueError):
            pass
    LOCK_PATH.write_text(
        json.dumps({"pid": os.getpid(), "startedAt": time.strftime("%Y-%m-%dT%H:%M:%S")}) + "\n",
        encoding="utf-8",
    )


def release_lock() -> None:
    try:
        if LOCK_PATH.exists():
            data = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
            if int(data.get("pid", 0)) == os.getpid():
                LOCK_PATH.unlink(missing_ok=True)
    except (json.JSONDecodeError, OSError, ValueError):
        LOCK_PATH.unlink(missing_ok=True)


def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if sys.platform == "win32":
        try:
            out = subprocess.check_output(
                ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            return str(pid) in out
        except (subprocess.CalledProcessError, OSError):
            return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


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


def render_lesson(model, lesson_id: str, probe_blocks: int | None, device: str) -> None:
    ffmpeg, ffprobe = find_ffmpeg()
    path = LESSONS_DIR / f"{lesson_id}.json"
    if not path.exists():
        raise SystemExit(f"Lektion fehlt: {path}")
    lesson = json.loads(path.read_text(encoding="utf-8"))
    blocks = lesson["speechBlocks"]
    if probe_blocks is not None:
        blocks = blocks[:probe_blocks]
        log(f"PROBE: nur erste {len(blocks)} Bloecke")

    lesson_out = OUT_DIR / lesson_id
    lesson_out.mkdir(parents=True, exist_ok=True)
    checksum_path = lesson_out / f"{lesson_id}.checksums.json"
    previous = json.loads(checksum_path.read_text(encoding="utf-8")) if checksum_path.exists() else {}
    current: dict[str, str] = {}

    block_paths: list[Path] = []
    t0 = time.time()
    for i, block in enumerate(blocks):
        speaker = block["speaker"]
        text = block["text"]
        checksum = block_checksum(speaker, text)
        current[str(i)] = checksum
        bp = lesson_out / f"{lesson_id}-b{i + 1:03d}.mp3"
        block_paths.append(bp)
        known_changed = str(i) in previous and previous[str(i)] != checksum
        if bp.exists() and not known_changed and mp3_ok(bp, ffprobe):
            write_progress(
                lessonId=lesson_id,
                block=i + 1,
                totalBlocks=len(blocks),
                status="skip-ok",
                phase="blocks",
            )
            continue
        if bp.exists() and (known_changed or not mp3_ok(bp, ffprobe)):
            log(f"  Block {i + 1}/{len(blocks)} neu (ungültig/geändert)")
            bp.unlink(missing_ok=True)
        log(f"  Block {i + 1}/{len(blocks)} (Sprecher {speaker})")
        exit_if_pause_requested()
        write_progress(
            lessonId=lesson_id,
            block=i + 1,
            totalBlocks=len(blocks),
            status="rendering",
            phase="blocks",
            speaker=speaker,
        )
        speak_block_retry(model, text, speaker, bp, device)
        # Nach jedem Block speichern — Resume nach Crash
        checksum_path.write_text(json.dumps(current, indent=2) + "\n", encoding="utf-8")
        write_progress(
            lessonId=lesson_id,
            block=i + 1,
            totalBlocks=len(blocks),
            status="block-done",
            phase="blocks",
        )

    checksum_path.write_text(json.dumps(current, indent=2) + "\n", encoding="utf-8")

    out_mp3 = OUT_DIR / f"{lesson_id}.mp3"
    out_cues = OUT_DIR / f"{lesson_id}.cues.json"
    log("  Zusammenfuegen...")
    write_progress(lessonId=lesson_id, status="concat", phase="concat", totalBlocks=len(blocks))
    durations = concat_lesson(lesson_id, blocks, block_paths, out_mp3, ffmpeg, ffprobe)
    cues = build_cues(lesson_id, blocks, durations)
    out_cues.write_text(json.dumps(cues, indent=2) + "\n", encoding="utf-8")
    total = duration_seconds(out_mp3, ffprobe)
    mins = int(total // 60)
    secs = int(total % 60)
    log(
        f"  fertig: {out_mp3.name}, {out_mp3.stat().st_size // 1024} KB, "
        f"{mins:02d}:{secs:02d} Min, {time.time() - t0:.0f}s Wall"
    )
    write_progress(
        lessonId=lesson_id,
        status="done",
        phase="done",
        outMp3=out_mp3.name,
        durationSeconds=round(total, 2),
        wallSeconds=round(time.time() - t0, 1),
    )


def missing_lesson_ids() -> list[str]:
    have = {p.stem for p in OUT_DIR.glob("*.mp3")}
    ids = sorted(p.stem for p in LESSONS_DIR.glob("*.json"))
    return [i for i in ids if i not in have]


def supervisor_pause_loop() -> None:
    """GPU frei: kein Worker-Start bis desired==run."""
    log("Supervisor: Pause aktiv — warte auf Resume (desired=run)...")
    while read_desired() == "pause":
        refresh_paused_progress()
        time.sleep(5)
    log("Supervisor: Resume — Batch wird fortgesetzt.")


def run_supervised(argv_without_supervise: list[str], stall_seconds: int) -> int:
    """Äusserer Supervisor: startet Worker neu bei Crash oder Progress-Stall."""
    py = sys.executable
    script = str(Path(__file__).resolve())
    backoff = 5
    round_n = 0
    while True:
        missing = missing_lesson_ids()
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
        # Worker ohne --supervise
        cmd = [py, "-u", script, *argv_without_supervise]
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
        still = missing_lesson_ids()
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
    parser.add_argument("--all-missing", action="store_true")
    parser.add_argument("--probe-blocks", type=int, default=None)
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

    if args.supervise:
        # Rebuild argv ohne --supervise fuer Worker
        worker_argv: list[str] = []
        if args.lesson:
            worker_argv.extend(["--lesson", args.lesson])
        if args.all_missing:
            worker_argv.append("--all-missing")
        if args.probe_blocks is not None:
            worker_argv.extend(["--probe-blocks", str(args.probe_blocks)])
        if args.device:
            worker_argv.extend(["--device", args.device])
        if args.limit is not None:
            worker_argv.extend(["--limit", str(args.limit)])
        if args.fail_fast:
            worker_argv.append("--fail-fast")
        raise SystemExit(run_supervised(worker_argv, args.stall_seconds))

    if not REF_A.exists() or not REF_B.exists():
        raise SystemExit(f"Referenzstimmen fehlen unter {VOICES_DIR}")

    if args.lesson:
        ids = [args.lesson]
    elif args.all_missing:
        ids = missing_lesson_ids()
        if args.limit:
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
