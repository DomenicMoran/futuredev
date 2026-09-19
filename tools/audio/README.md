# tools/audio

Vertont die Sprechblöcke einer Lektion über ElevenLabs zu einer fertigen
Audiodatei. Das Skript selbst schreibt der Hörprobe-Agent in Phase 2, hier steht
nur der geplante Ablauf, als Vorbild dient die BitDojo-Pipeline
(`C:\Users\domen\Documents\Projekte\BitDojo\werkzeug\podcast-skripte.mjs`,
`podcast-vertonen.mjs`, `podcast-hochladen.mjs`).

## Ablauf

1. Eine Lektion (`content/lessons/<Kennung>.json`) einlesen, gegen
   `@futuredev/content-schema` prüfen.
2. Je Sprechblock eine MP3-Datei erzeugen: Sprecher A über `VOICE_ID_ERKLAERT`,
   Sprecher B über `VOICE_ID_FRAGT`, Modell `eleven_multilingual_v2`, Sprache
   Deutsch. Ausgabe je Block unter `tools/audio/out/<Kennung>-b001.mp3` und so
   weiter, damit ein zweiter Lauf schon vorhandene Blöcke überspringt
   (abbruchfest, gleiches Muster wie `podcast-vertonen.mjs`).
3. Alle Blockdateien einer Lektion mit `ffmpeg` zu `<Kennung>.mp3`
   zusammenfügen.
4. Ergebnis bleibt unter `tools/audio/out/`, das Verzeichnis ist per `.gitignore`
   ausgeschlossen: Audio wird nie versioniert.

## Kennzeichnung

Jede erzeugte Datei ist KI-Sprache (EU AI Act Art. 50). Das Feld `audio.aiGenerated`
im Lektionsschema ist deshalb als Literal `true` festgeschrieben, nicht optional.

## Umgebung

Braucht `ELEVENLABS_API_KEY`, `VOICE_ID_ERKLAERT`, `VOICE_ID_FRAGT` aus `.env.local`
im Repo-Wurzelverzeichnis (siehe `.env.example`). Der Schlüssel kann nur sprechen,
nicht das Kontingent auslesen; Verbrauch daher am Zeichencount im eigenen Lauf
mitzählen, nicht bei ElevenLabs abfragen.
