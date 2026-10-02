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

Pipeline-Regressionstests ohne Chatterbox/GPU (einschließlich kleiner echter FFmpeg-Montage):

```powershell
pnpm --dir tools/audio test:chatterbox
```

```powershell
# eine Lektion (nach redaktioneller Freigabe)
.\.venv-chatterbox\Scripts\python.exe -u render_chatterbox.py --lesson M01-04-03

# Bericht ohne Modell/GPU: welche Generationen fehlen oder sind veraltet?
.\.venv-chatterbox\Scripts\python.exe -u render_chatterbox.py --all-missing --report-only
.\.venv-chatterbox\Scripts\python.exe -u render_chatterbox.py --lesson M01-04-03 --report-only

# isolierte Hör-/Stimmenprobe; erzeugt nur out/_probes/<id>-<zeit>-<nonce>/
# (kein finaler MP3-/Cue-/Provenienzmarker; nicht mit --all-missing kombinierbar)
.\.venv-chatterbox\Scripts\python.exe -u render_chatterbox.py --lesson M01-04-03 --probe-blocks 4

# alle fehlenden — nachhaltig (Lock, Resume, Retry, Supervisor bei Crash/Stall)
powershell -File .\run_chatterbox_batch.ps1

# oder direkt:
.\.venv-chatterbox\Scripts\python.exe -u render_chatterbox.py --all-missing --supervise
```

Fortschritt live: `out\_chatterbox_progress.json`  
Batch-Log: `%TEMP%\fd-chatterbox-batch.log`

Nachhaltigkeit und Grenzen:
- Resume verwendet einen Block nur, wenn eine vollständige v2-Provenienz Sprecher und exakten UTF-8-Text bindet und zusätzlich Bytegröße/SHA256/ffprobe der MP3 übereinstimmen. Fehlende oder alte 16-stellige Hashes gelten nie als Beweis.
- Vollständige Checksum-Dokumente (alle aktuellen Blockpositionen einschließlich pending/rendered) werden nach jedem verifizierten Block per temp-file + fsync + atomic replace gespeichert. Ein Resume behält spätere, weiterhin passend gebundene Blöcke; Indexverschiebung wird per vollständiger Sprecher-/Text-Bindung abgeglichen.
- Vorhandene Lektion-MP3/Cue-Paare ohne aktuelle Provenienz, oder mit veraltetem Text/SHA/Dauer/Cues, gelten als fehlend; Supervisor und `--all-missing` prüfen dasselbe statt nur nach Dateinamen zu sehen. `--report-only` erstellt dafür einen GPU-freien JSON-Plan.
- Alte finale MP3s, Cues und ersetzte Blockdateien werden vor Veröffentlichung unter `out/_archive/<id>/<generation>/` kopiert. Alte Dateien werden nicht pauschal gelöscht.
- Ein vollständiger neuer Satz wird erst im Work-Verzeichnis montiert und geprüft. Beim Wechsel wird der bisherige Provenienzmarker zuerst entfernt; MP3, Cue-Datei und verifizierte Blockdateien werden ersetzt und der kleine `<id>.provenance.json`-Marker zuletzt atomar geschrieben. Bei Zwischenfehler gilt keine Generation als aktuell; die archivierte Vorgängergeneration bleibt verfügbar. Leser/Publisher müssen Marker+SHA prüfen; der lokale Marker beweist nur Dateiselbstkonsistenz, keine redaktionelle Freigabe oder Echtheit gegenüber einer veröffentlichten Quelle.
- Finaler Descriptor enthält `lessonId`, `speechSha256`, `audioFile/audioBytes/audioSha256`, `cuesFile/cuesBytes/cuesSha256`, `durationSeconds` aus ffprobe und vollständige Blockprovenienz.
- Kanonischer Speech-Hash (cross-language): `SHA256(UTF8(JSON.stringify([{speaker,text}, ...])))`; Feldreihenfolge `speaker`, dann `text`; kompaktes JSON ohne ASCII-Escaping; die originale speechBlock-Reihenfolge bleibt erhalten. Gemeinsamer Python/JS-Testvektor: Payload `[{"speaker":"A","text":"Grüße\nMünchen"},{"speaker":"B","text":"Wörter"}]` (der Textwert `Grüße\nMünchen` enthält einen echten Zeilenumbruch, in der serialisierten Zeichenfolge escaped als `\n`) ergibt `f7e0f913227c01d78dcff19d9402c7989adb07755a137366675ad794edc18ef3`.
- Ein normaler vollständiger Renderbatch darf erst nach ausdrücklichem Redaktions-Freeze gestartet werden. Der frische Plan umfasst auch bisherige MP3s ohne volle Provenienz; diese bleiben erhalten und müssen neu gebunden werden.
- Checksums nach jedem Block; ffprobe-validierte Block- und Gesamt-MP3s; Cues aus echten Blockdauern, mit tatsächlicher Gesamtdauer verglichen.
- Block-Retry bei CUDA-/Generate-Fehlern, Lektion skippen statt Batch-Abbruch
- `--supervise` killt bei Progress-Stall (default 15 Min) und startet neu. Seine anfängliche, konkrete Zielliste bleibt über Restarts fix; `--all-missing --limit N --supervise` beaufsichtigt höchstens die ersten N aktuell fehlenden Lektionen und weitet den Auftrag nach deren Abschluss nicht aus. `--lesson ID --supervise` bleibt genau auf diese ID begrenzt.
- Der Batch-Lock ist ein exklusiver OS-Dateilock (Windows Byte-Range-Lock bzw. POSIX `flock`) über eine dauerhaft vorhandene Lockdatei. Nach Prozessabsturz gibt das Betriebssystem den Lock automatisch frei; ein alter PID-Text blockiert keinen neuen Worker. Die Datei wird absichtlich nicht gelöscht, damit parallele Prozesse immer dasselbe Lock-Objekt öffnen.
- PID-File-Lock verhindert parallele Batches; der PowerShell-Launcher tötet keine vorhandenen Dashboard-/Workerprozesse und entfernt keine Locks.

Ausgabe wie ElevenLabs-Pipeline: `out/<id>.mp3` + `out/<id>.cues.json`.

## Pause / Gaming (GPU frei)

Soft-Pause: `out\_chatterbox_control.json` mit `desired: pause` — Worker beendet nach dem aktuellen Block (Exit 75), Supervisor startet nicht neu bis `desired: run`. **Hinweis:** Ein bereits laufender Worker ohne Pause-Code rendert ggf. noch den aktuellen Block; erst nach Neustart (Supervisor mit aktuellem `render_chatterbox.py`) liest der Batch die Control-Datei zuverlässig zwischen Blöcken.

```powershell
powershell -File .\open_chatterbox_dashboard.ps1   # http://127.0.0.1:8765/
powershell -File .\chatterbox_pause.ps1              # vor Gaming
powershell -File .\chatterbox_resume.ps1             # danach (startet Batch ggf. neu)
```

Dashboard **Stop** = Pause + sofortiger Kill aller `render_chatterbox.py`-Prozesse.
