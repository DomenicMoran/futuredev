# FutureDev, Mobile

Noch kein Code. Der App-Gerüst-Agent legt hier in Phase 3 ein Expo-Projekt an
(aktuelles stabiles SDK, React Native, `expo-router`, TypeScript strict), Android-
Paketname `de.domenicmoran.futuredev`, Slug `futuredev`.

Geplanter Aufbau (Phase 3 ff.): fünf Reiter (Start, Lernen, Hören, Üben, Ich), Inhalt
aus `@futuredev/content-schema` geladen und lokal in SQLite (`expo-sqlite`) sowie
Dateisystem (`expo-file-system`) gehalten, Design aus `@futuredev/design-tokens`,
Wiederholung und Auswertung aus `@futuredev/core`.

Bau ohne EAS: lokal mit `expo prebuild --platform android` und
`gradlew assembleRelease`, signiert mit einem Keystore außerhalb dieses Repos unter
`90_Werkstatt/schluessel/futuredev-android/` (siehe Entscheidung
`2026-09-19-futuredev-apk-bau-lokal-ohne-eas` im Vault). Wegen der Windows-
Pfadlänge beim C++-Codegen läuft der Bau über die Junction `C:\rnb\FutureDev`.

Befehle (ab Phase 3):

```bash
pnpm --filter @futuredev/mobile start
pnpm --filter @futuredev/mobile android
```
