# tools/publish

Lädt `content/manifest.json` und die geänderten Lektionen aus `content/lessons/`
in den öffentlichen Supabase-Storage-Eimer `content` hoch (lesend öffentlich,
RLS ohne Schreibrechte für Clients, siehe `supabase/migrations/0001_init.sql`),
lädt Hördateien samt Cue-Sidecar in den Eimer `audio` hoch und trägt eine Zeile
in `content_releases` ein.

## Ablauf

1. Liest `content/manifest.json` und jede darin gelistete Lektion, prüft beide
   gegen das Schema aus `@futuredev/content-schema` und gleicht die im
   Manifest eingetragene Prüfsumme mit der tatsächlichen Datei ab. Weicht
   etwas ab, bricht das Werkzeug ab (Rückgabewert 1), ohne etwas zu senden.
2. Lädt jede gegenüber dem zuletzt veröffentlichten Manifest geänderte oder
   neue Lektion nach `lessons/<id>.<sha256-kurz>.json` hoch (`Content-Type
   application/json`, `cacheControl` 31536000s / ein Jahr, weil der Dateiname
   die Prüfsumme trägt und sich damit nie unter demselben Namen ändert).
   Danach, und nur danach, lädt es `manifest.json` hoch (`cacheControl` 300s),
   mit dem Feld `file` je Lektion umgeschrieben auf diesen unveränderlichen
   Pfad. Diese Reihenfolge ist fest: ein Abbruch mitten im Lauf kann so nie ein
   Manifest veröffentlichen, das auf eine Lektionsdatei zeigt, die noch nicht
   im Eimer liegt. Das Manifest wird übersprungen, wenn sich gegenüber dem
   zuletzt veröffentlichten Stand nichts geändert hat.
3. Lädt für jede Lektion mit Audio die MP3 und die Cue-Datei (`<id>.cues.json`,
   erzeugt von der Vertonungspipeline in `tools/audio`) aus dem Ordner, der per
   `--audio-dir` übergeben wird (Standard `tools/audio/out`) in den Eimer
   `audio` hoch, je nur bei geänderter Prüfsumme gegenüber der
   Sidecar-Datei `<id>.sha256` beziehungsweise `<id>.cues.sha256` im Eimer.
   Fehlt die Cue-Datei lokal noch (die Vertonungspipeline hat sie noch nicht
   erzeugt), wird die Lektion übersprungen und gemeldet, nicht ohne Cues
   hochgeladen.
4. Trägt bei einer tatsächlichen Manifest-Änderung eine Zeile in
   `content_releases` ein: Version aus dem Manifest, Manifest-URL, Prüfsumme
   des veröffentlichten Manifest-Textes, Zeitstempel (Standardwert der Tabelle).

Audio geht bis zur Freigabe des Cloudflare-R2-Kontos (Entscheidung
`2026-09-19-futuredev-audio-auf-cloudflare-r2`) in den Supabase-Storage-Eimer
`audio`, danach nach R2 in den Eimer `futuredev-audio`. Die App kennt nur die
Basis-URL aus dem Manifest, der Wechsel ist ein Konfigurationswert, kein
Code-Update.

## Befehle

```bash
# Ganzen Plan anzeigen, nichts senden (funktioniert auch ohne Dienstschlüssel):
pnpm publish:content -- --dry-run

# Wirklich hochladen:
pnpm publish:content

# Anderen Audio-Ordner verwenden:
pnpm publish:content -- --audio-dir tools/audio/out
```

`pnpm publish:content` ruft `pnpm --filter @futuredev/tools-publish run
publish:content` auf (Wurzel-Skript in der Wurzel-`package.json`).

Liegt kein `SUPABASE_SERVICE_ROLE_KEY` vor, zeigt `--dry-run` trotzdem den
vollen Plan an, allerdings so, als wäre noch nichts veröffentlicht (es kann
nicht geprüft werden, was schon im Eimer liegt). Liegt ein Schlüssel vor, plant
auch der Dry-Run gegen den echten zuletzt veröffentlichten Stand, sendet aber
weiterhin nichts. Ohne `--dry-run` und ohne Schlüssel bricht das Werkzeug mit
einer klaren Meldung und Rückgabewert 2 ab, ohne etwas zu senden.

## Basis-URLs im veröffentlichten Manifest

`content/manifest.json` trägt im Repo (Übergangsstand aus Welle 3, Agent C)
`contentBaseUrl`/`audioBaseUrl` auf einen GitHub-Release, weil die Hördatei
und die Cue-Sidecar-Datei dort lagen, bevor Supabase Storage befüllt war.
`buildPublishManifest` in `src/plan.ts` schreibt beide Felder beim
Veröffentlichen immer um, unabhängig vom lokalen Wert: auf
`${SUPABASE_URL}/storage/v1/object/public/content` und
`.../public/audio`. Das veröffentlichte Manifest zeigt damit stets auf die
Eimer, in die dieses Werkzeug selbst hochlädt, nie auf GitHub. `--dry-run`
druckt beide umgeschriebenen Adressen vor dem Plan aus, auch ohne
`SUPABASE_SERVICE_ROLE_KEY` (dafür reicht `SUPABASE_URL` allein, siehe unten);
fehlt `SUPABASE_URL` ganz, bricht das Werkzeug mit Rückgabewert 2 ab, auch im
Dry-Run, weil sonst eine falsche Basis-URL nicht auffiele.

## Umgebungsvariablen (`.env.local` in der Repo-Wurzel)

- `SUPABASE_URL`: Projekt-URL für administrative Aufrufe vom Rechner aus.
- `SUPABASE_SERVICE_ROLE_KEY`: Dienstschlüssel mit vollen Rechten. **Nur für
  dieses Werkzeug auf dem Rechner, niemals in die App, niemals als
  `EXPO_PUBLIC_*`, niemals committet, niemals geloggt oder ausgegeben** (auch
  nicht in einer Fehlermeldung: die enthält höchstens den Variablennamen).
  Braucht in Supabase Storage-Schreibrechte auf den Eimern `content` und
  `audio` sowie Schreibrechte auf `public.content_releases` (RLS wird vom
  Dienstschlüssel serverseitig umgangen, siehe `supabase/migrations/0001_init.sql`).

Der Dienstschlüssel wird bewusst nie in `.env.example` mit einem Platzhalter
scharf gemacht, der versehentlich für echt gehalten werden könnte; die Datei
nennt nur den Variablennamen mit leerem Wert.

## Ohne Dienstschlüssel: Veröffentlichung per MCP (Phase 3, Hauptagent)

In Phase 3 legt der Hauptagent das Supabase-Projekt über den MCP-Zugang an und
trägt `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY` (öffentlich,
darf in die App) in `.env.local` ein, aber **keinen** `SUPABASE_SERVICE_ROLE_KEY`.
Solange dieser Schlüssel fehlt, läuft die erste Veröffentlichung von Manifest,
Lektion und Hörprobe über den Hauptagenten selbst, mit den
Supabase-MCP-Werkzeugen (`execute_sql`, Storage-Uploads über die MCP-Anbindung)
statt über dieses Skript. Erst wenn Domenic einen `service_role`-Schlüssel in
`.env.local` einträgt, übernimmt `pnpm publish:content` die Veröffentlichung
dauerhaft; die Logik in diesem Ordner ändert sich dadurch nicht, nur der
Aufrufweg.

## Tests

`pnpm --filter @futuredev/tools-publish test` (Vitest, ohne Netzwerk): prüft
Diff-Berechnung (`diffLessons`, `manifestChanged`), Reihenfolge
(`planContentUploads`, Lektionen immer vor dem Manifest-Schritt), Pfadbildung
(`lessonStoragePath`), Dry-Run-Textausgabe (`formatContentPlan`,
`formatAudioPlan`) und die eigentliche Ausführung (`executeContentPlan`,
`executeAudioPlan`, `insertContentRelease`) gegen eine Attrappe des
Supabase-Clients (`test/supabase-ops.test.ts`), die Uploads im Speicher hält
statt ins Netz zu gehen.
