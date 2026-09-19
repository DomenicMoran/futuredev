# Contributing

Code (Bezeichner, Dateinamen) in Englisch, Kommentare im Code auf Deutsch,
Commit-Nachrichten in Englisch. README-Dateien auf Deutsch, mit kurzem
englischem Absatz am Anfang für internationale Leser.

## Vor jedem Commit

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm content:validate
pnpm check:secrets
```

Der Pre-Commit-Hook (`simple-git-hooks`) führt `tools/check-secrets.mjs` bereits
automatisch aus. Ein Fund bricht den Commit mit Rückgabewert 1 ab.

## Konventionen

- TypeScript strict überall, keine `any`-Notausgänge ohne Kommentar, warum.
- Keine Platzhalter-Funktionen: lieber ein Paket kleiner lassen als eine leere
  Hülle liefern.
- Tests prüfen echtes Verhalten, keine abgeschwächten Erwartungen.
- Zugangsdaten ausschließlich in `.env.local`, nie im Code, nie in Tests, nie in
  Commit-Nachrichten.
