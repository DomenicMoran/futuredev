# FutureDev

For English readers: FutureDev is a German-language Android learning app that takes a
career changer with no prior knowledge to job-ready product engineer level. Content and
code are strictly separated: text and AI-narrated audio live under `content/` (CC
BY-NC-SA 4.0), the code lives everywhere else (MIT). Details below are in German, the
audience for the app itself.

FutureDev bringt einen Quereinsteiger ohne Vorwissen bis zur Jobreife als Product
Engineer, in einer Android-App mit Lesetext, Hörbuch und Quiz. Lehrinhalt und Code sind
getrennt: der Inhalt liegt unter `content/`, der Code überall sonst.

## Für wen

Für jemanden, der noch nie programmiert hat und in einem konkreten, planbaren Weg
lernen will, was ein Product Engineer heute können muss: von Terminal und Netzwerk über
Web, Datenbanken und Mobile bis zu Architektur, Sicherheit, KI-Engineering und der
eigenen Bewerbung.

## Was am Ende existiert

Eine signierte Android-APK (GitHub-Release-Asset), eine Landingpage unter
`futuredev.domenicmoran.de`, ein Lehrplan mit zehn Modulen als Text und
KI-Hörbuch, ein Quiz- und Wiederholungssystem, eine Jobreife-Anzeige und eine
Portfolio-Begleitung mit eigenen Praxisbeispielen. Keine Job-Garantie: die
Jobreife-Anzeige zeigt Vorbereitung, keine Zusage eines Arbeitgebers.

## Aufbau des Repos

```
apps/mobile/          Die Android-App (Expo, React Native, TypeScript strict)
apps/web/              Die Landingpage (Next.js, statischer Export, Vercel)
packages/content-schema/  Zod-Schema für Lektion und Manifest, Prüfregeln, Tests
packages/design-tokens/   Farben, Abstände, Typografie, Bewegung, für Mobile und Web
packages/core/            Plattformfreie Logik: Wiederholung, Quizziehung, Jobreife
content/                   Lektionen als JSON, Manifest, Lizenz der Inhalte
tools/audio/                Vertonungspipeline über ElevenLabs
tools/publish/               Veröffentlichung von Inhalten nach Supabase und R2
supabase/                     Datenbank-Migrationen und Row-Level-Security
tools/check-secrets.mjs        Schutz vor versehentlich committeten Zugangsdaten
```

## Befehle

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm content:validate
pnpm check:secrets
```

## Wie Inhalte geprüft werden

Jede Lektion ist eine JSON-Datei unter `content/lessons/`. `pnpm content:validate`
prüft sie gegen das Schema aus `packages/content-schema` und gegen zusätzliche
Regeln: genau eine richtige Quizoption, die längste Option höchstens in 40 Prozent
der Fragen einer Lektion richtig, der Kernsatz genau einmal je Lektion, keine
Begriffe aus Lektionen, die keine Voraussetzung sind, keine Ablenker, die wörtlich
Begriffe aus einem fremden Modul sind. Details in `content/README.md`.

## Lizenz

Der Code in diesem Repo steht unter MIT (`LICENSE`). Die Lehrinhalte unter
`content/` stehen unter CC BY-NC-SA 4.0 (`content/LICENSE`): Namensnennung, nicht
kommerziell, Weitergabe unter gleichen Bedingungen.

## Hinweis zu Audio

Das Hörbuch ist KI-generierte Sprache (ElevenLabs, zwei Stimmen). Jede Lektion
kennzeichnet das im Feld `audio.aiGenerated` des Lektionsschemas, nach EU AI Act
Art. 50.

## Landingpage

`futuredev.domenicmoran.de` ist in Vorbereitung.
