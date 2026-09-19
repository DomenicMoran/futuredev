# FutureDev, Inhalte

For English readers: this folder holds the German learning content (lessons as JSON
files plus a manifest) under CC BY-NC-SA 4.0. See `LICENSE` in this folder.

Hier liegt der Lehrinhalt von FutureDev, getrennt vom Code der App. Eine Lektion ist
eine JSON-Datei unter `lessons/`, benannt nach ihrer Kennung, zum Beispiel
`lessons/M01-01-01.json`. Das Schema dafür steht in `packages/content-schema`, die
Regeln dahinter erklärt die Vault-Notiz `inhaltsformat.md`
(`10_Projekte/FutureDev/Wissen/inhaltsformat.md`, nicht Teil dieses Repos).

## Lizenz

Text und Audio unter `content/` stehen unter CC BY-NC-SA 4.0 (Namensnennung, nicht
kommerziell, Weitergabe unter gleichen Bedingungen). Der Code der App und der
Werkzeuge steht unter MIT, siehe `LICENSE` im Wurzelverzeichnis des Repos. Beide
Lizenzen gelten unabhängig voneinander für ihren jeweiligen Teil.

## Eine Lektion schreiben

1. Kennung nach dem Muster `M00-00-00` wählen (Modul, Untermodul, Lektion), passend
   zur Liste der Module.
2. Datei `lessons/<Kennung>.json` anlegen, Felder wie im Schema aus
   `packages/content-schema/src/lesson.ts`: Titel, Dauer in Minuten,
   Voraussetzungen, eingeführte Begriffe, Sprechblöcke (Sprecher A oder B, ein
   Kernsatz je Lektion, je Block eine `role`), Praxisbeispiel mit Verweis auf
   eine der elf Repo-Notizen, mindestens zehn Quizfragen mit je vier Optionen,
   Praxisaufgabe, mindestens fünf `faq`-Einträge, Audio-Verweis.
3. `pnpm content:validate` ausführen. Jede Verletzung nennt Datei und Regel.

## Sprechblock-Rollen (`role`)

Seit AP-4.1 trägt jeder Sprechblock eine Pflicht-Rolle (`role`), eine aus
`image`, `explain`, `term`, `example`, `why`, `question`, `key`, `terms_list`,
`faq`. Sie sagt, welche Funktion der Block im Fünf-Schritt-Muster (AW-046,
Vault-Notiz `10_Projekte/FutureDev/Wissen/anweisungen.md` AW-046) erfüllt:
Alltagsbild, Erklärung, Fachausdruck, zweites Beispiel, Warum-Satz, Frage von
Sprecher B, der eine Kernsatz der Lektion, die Begriffsliste am Ende oder ein
vertonter FAQ-Block. Der Cue-Sidecar (`tools/audio/src/cues.ts`) leitet daraus
den Kapitelmarken-Abschnitt (`section`) ab, den `apps/mobile` liest: `faq` →
`faq`, `terms_list` → `terms`, `example` → `example`, jede andere Rolle →
`body`.

## faq-Pflichtfeld

Jede Lektion braucht mindestens fünf `faq`-Einträge (Frage endet mit `?`,
Antwort mit mindestens zwei vollständigen Sätzen, AW-045). Diese Einträge
müssen sich wortgleich als vertonte Sprechblöcke am Lektionsende wiederfinden:
je Eintrag ein B-Block mit dem Fragetext (`role: "faq"`), danach ein A-Block
mit dem Antworttext (`role: "faq"`), damit Text und Audio dasselbe sagen.

## Wie geprüft wird

`pnpm content:validate` liest alle Dateien unter `lessons/` und `manifest.json`,
prüft sie gegen das Zod-Schema und zusätzlich gegen die Regeln aus
`packages/content-schema/src/rules.ts`: genau eine richtige Quizoption, die
längste Option höchstens in 40 Prozent der Fragen einer Lektion richtig, der
Kernsatz genau einmal je Lektion (und trägt `role: "key"`), kein Begriff aus
einer Lektion, die keine Voraussetzung ist, kein Ablenker, der wörtlich ein
Begriff aus einem fremden Modul ist, die `role: "faq"`-Blöcke spiegeln die
`faq`-Einträge, die `role: "terms_list"`-Blöcke nennen jeden Begriff aus
`terms`, je Begriff aus `terms` nennt ihn mindestens ein `image`- oder
`example`-Block wörtlich, jeder `term`-Block hat innerhalb der nächsten drei
Blöcke ein `example` oder `image`, die mittlere Satzlänge über alle
Sprechblöcke liegt unter 20 Wörtern und kein Satz über 35 Wörtern (Regeln aus
der Vault-Notiz `10_Projekte/FutureDev/Wissen/inhaltsformat.md`, Prüfregeln 1
bis 14). Zusätzlich meldet der Lauf eine Warnung, wenn eine Lektion unter 2.500
Wörtern gesprochenem Text bleibt; das wird erst ab Manifest-Version 0.2.0 zum
Fehler, weil `M01-01-01` selbst noch darunter liegt (siehe
`checkMinimumWordCount` in `packages/content-schema/src/rules.ts`). Der Lauf
endet mit Rückgabewert 1 bei jeder Fehler-Verletzung, sonst mit 0 und einer
Zusammenfassung aus Lektionen-, Fragen- und Warnungszahl.

## Manifest

`manifest.json` fehlt in diesem Stand des Repos bewusst: eine leere Lektionenliste
wäre kein gültiger erster Stand, und `pnpm content:validate` meldet ohne Lektionen
unter `lessons/` deutlich "keine Lektionen gefunden" mit Rückgabewert 1. Sobald die
erste Lektion unter `lessons/` liegt, erzeugt `pnpm content:manifest` das Manifest
aus dem Ordnerinhalt: Prüfsumme je Datei, Zeitpunkt aus dem letzten Git-Commit der
Datei, Version aus einem vorhandenen Manifest oder `0.1.0` beim ersten Lauf.
