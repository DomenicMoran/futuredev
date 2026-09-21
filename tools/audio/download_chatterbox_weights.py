#!/usr/bin/env python3
"""
Chatterbox-Gewichte robust und abbruchfest laden.

Probleme vorher: huggingface_hub hing bei anonymen Downloads (0-Byte incomplete).
Diese Variante:
1. Liest HF_TOKEN optional aus tools/audio/.env bzw. Repo-.env.local
2. Laedt Datei fuer Datei per HTTPS (Resume), mit Timeout
3. Prueft Mindestgroessen
4. Schreibt nach tools/audio/chatterbox-weights/ fuer from_local()

Umgebung:
  HF_TOKEN          optional, schneller / hoeheres Rate-Limit
  HF_ENDPOINT       optional, z.B. https://hf-mirror.com
  CHATTERBOX_REPO   default ResembleAI/chatterbox
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIO = Path(__file__).resolve().parent
DEST = AUDIO / "chatterbox-weights"
REPO = os.environ.get("CHATTERBOX_REPO", "ResembleAI/chatterbox")

# Genau die Dateien, die ChatterboxMultilingualTTS.from_local + t3_model=v3 braucht
# (siehe chatterbox-src/.../mtl_tts.py allow_patterns / from_local).
FILES: dict[str, int] = {
    # name -> Mindestgroesse in Bytes (untergrenze, Schutz vor abgebrochenen Downloads)
    "ve.pt": 5_000_000,
    "s3gen.pt": 900_000_000,
    "t3_mtl23ls_v3.safetensors": 2_000_000_000,  # ~2144 MB laut HF API
    "conds.pt": 50_000,
    "grapheme_mtl_merged_expanded_v1.json": 10_000,
    "Cangjie5_TC.json": 10_000,
}

CONNECT_TIMEOUT = 30
READ_TIMEOUT = 120
MAX_RETRIES = 8
CHUNK = 1024 * 1024


def load_dotenv() -> None:
    for path in (ROOT / ".env.local", AUDIO / ".env.local", AUDIO / ".env"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key, val = key.strip(), val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


def endpoints() -> list[str]:
    custom = os.environ.get("HF_ENDPOINT", "").rstrip("/")
    ordered = []
    if custom:
        ordered.append(custom)
    # Offiziell zuerst, wenn Token da; sonst Mirror zuerst (weniger Rate-Limit-Haenger)
    official = "https://huggingface.co"
    mirror = "https://hf-mirror.com"
    if os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN"):
        ordered.extend([official, mirror])
    else:
        ordered.extend([mirror, official])
    # unique preserve order
    seen = set()
    out = []
    for e in ordered:
        if e not in seen:
            seen.add(e)
            out.append(e)
    return out


def file_url(endpoint: str, name: str) -> str:
    return f"{endpoint}/{REPO}/resolve/main/{name}"


def expected_remote_size(name: str) -> int | None:
    """HF API-Größe; None wenn nicht erreichbar."""
    try:
        url = f"https://huggingface.co/api/models/{REPO}/tree/main"
        req = urllib.request.Request(url, headers={"User-Agent": "futuredev-chatterbox-downloader/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        for item in data:
            if item.get("type") == "file" and item.get("path") == name:
                return int(item["size"])
    except Exception:  # noqa: BLE001
        return None
    return None


def download_one(name: str, dest: Path) -> None:
    min_size = FILES[name]
    remote = expected_remote_size(name)
    if remote:
        min_size = max(min_size, int(remote * 0.98))
    if dest.exists() and dest.stat().st_size >= min_size:
        print(f"OK  {name} ({dest.stat().st_size // 1_000_000} MB)", flush=True)
        return
    if dest.exists() and dest.stat().st_size < min_size:
        print(
            f"UNVOLLSTAENDIG {name}: {dest.stat().st_size // 1_000_000} MB, "
            f"erwartet >= {min_size // 1_000_000} MB — neu laden",
            flush=True,
        )
        dest.unlink()

    partial = dest.with_suffix(dest.suffix + ".part")
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    headers = {"User-Agent": "futuredev-chatterbox-downloader/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    last_err: Exception | None = None
    for endpoint in endpoints():
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                existing = partial.stat().st_size if partial.exists() else 0
                req_headers = dict(headers)
                if existing:
                    req_headers["Range"] = f"bytes={existing}-"
                url = file_url(endpoint, name)
                print(
                    f"GET {name} via {endpoint} attempt {attempt}/{MAX_RETRIES} "
                    f"(resume={existing})",
                    flush=True,
                )
                req = urllib.request.Request(url, headers=req_headers)
                with urllib.request.urlopen(req, timeout=CONNECT_TIMEOUT) as resp:
                    mode = "ab" if existing and resp.status == 206 else "wb"
                    if mode == "wb" and partial.exists():
                        partial.unlink()
                        existing = 0
                    # socket read timeout
                    resp.fp.raw._sock.settimeout(READ_TIMEOUT)  # type: ignore[attr-defined]
                    written = existing
                    t0 = time.time()
                    last_log = t0
                    with open(partial, mode) as out:
                        while True:
                            chunk = resp.read(CHUNK)
                            if not chunk:
                                break
                            out.write(chunk)
                            written += len(chunk)
                            now = time.time()
                            if now - last_log >= 5:
                                mb = written / 1_000_000
                                speed = (written - existing) / max(now - t0, 1) / 1_000_000
                                print(f"  ... {mb:.1f} MB ({speed:.2f} MB/s)", flush=True)
                                last_log = now
                if partial.stat().st_size < min_size:
                    raise RuntimeError(
                        f"{name} zu klein: {partial.stat().st_size} < {min_size}"
                    )
                partial.replace(dest)
                print(f"OK  {name} ({dest.stat().st_size // 1_000_000} MB)", flush=True)
                return
            except Exception as exc:  # noqa: BLE001 - bewusst breit, Retry
                last_err = exc
                print(f"  FAIL {type(exc).__name__}: {exc}", flush=True)
                time.sleep(min(2**attempt, 30))
    raise SystemExit(f"Konnte {name} nicht laden: {last_err}")


def main() -> None:
    load_dotenv()
    DEST.mkdir(parents=True, exist_ok=True)
    token_set = bool(os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN"))
    print(f"Ziel: {DEST}", flush=True)
    print(f"HF_TOKEN gesetzt: {token_set}", flush=True)
    print(f"Endpoints: {', '.join(endpoints())}", flush=True)
    for name in FILES:
        download_one(name, DEST / name)
    print("ALLE GEWICHTE BEREIT", flush=True)


if __name__ == "__main__":
    main()
