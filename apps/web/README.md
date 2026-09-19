# FutureDev, Landingpage

Noch kein Code. Entsteht in Phase 7 (Release) als Next.js-App (aktuelle Version),
statischer Export, gehostet auf Vercel unter `futuredev.domenicmoran.de`, gleicher
Stack wie domenicmoran.de.

Aufgabe der Seite: FutureDev vorstellen, die jeweils neueste APK als GitHub-Release-
Asset verlinken (kein Vercel-Hosting der APK, GitHub-Releases sind bis 2 GB je Datei
kostenlos), Rechtstexte (Impressum, Datenschutz, KI-Audio-Hinweis nach EU AI Act
Art. 50) als eigene Seiten, von Domenic geprüft vor Veröffentlichung.

Design aus `@futuredev/design-tokens`, wie in `apps/mobile`.

Befehle (ab Phase 7):

```bash
pnpm --filter @futuredev/web dev
pnpm --filter @futuredev/web build
```
