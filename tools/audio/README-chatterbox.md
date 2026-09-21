# Chatterbox lokal (FutureDev)

Vertonung ohne ElevenLabs-Kontingent über Chatterbox Multilingual V3.

## Einmalig

```powershell
cd C:\rnb\FutureDev\tools\audio
py -3.12 -m venv .venv-chatterbox
.\.venv-chatterbox\Scripts\python.exe -m pip install -U pip
.\.venv-chatterbox\Scripts\python.exe -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
.\.venv-chatterbox\Scripts\python.exe -m pip install -e .\chatterbox-src --no-deps
.\.venv-chatterbox\Scripts\python.exe -m pip install librosa safetensors transformers diffusers resemble-perth s3tokenizer
# Gewichte (hängt nicht mehr an anonymem Hub-Snapshot):
.\.venv-chatterbox\Scripts\python.exe download_chatterbox_weights.py
```

Optional in Repo-`.env.local`: `HF_TOKEN=...` (nur Name in `.env.example`, nie committen).

Referenzstimmen A/B liegen unter `chatterbox-voices/` (aus bestehendem ElevenLabs-Audio).

## Rendern

```powershell
# eine Lektion
.\.venv-chatterbox\Scripts\python.exe -u render_chatterbox.py --lesson M01-04-03

# alle fehlenden — nachhaltig (Lock, Resume, Retry, Supervisor bei Crash/Stall)
powershell -File .\run_chatterbox_batch.ps1

# oder direkt:
.\.venv-chatterbox\Scripts\python.exe -u render_chatterbox.py --all-missing --supervise
```

Fortschritt live: `out\_chatterbox_progress.json`  
Batch-Log: `%TEMP%\fd-chatterbox-batch.log`

Nachhaltigkeit:
- atomare Block-/Lesson-MP3s (`.partial` → rename)
- Resume validiert vorhandene Bloecke per ffprobe (kein Skip von Schrott)
- Checksums nach jedem Block
- Block-Retry bei CUDA-/Generate-Fehlern, Lektion skippen statt Batch-Abbruch
- `--supervise` killt bei Progress-Stall (default 15 Min) und startet neu
- File-Lock verhindert parallele Batches

Ausgabe wie ElevenLabs-Pipeline: `out/<id>.mp3` + `out/<id>.cues.json`.
