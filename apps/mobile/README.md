# FutureDev, Mobile

Expo-SDK 57, React Native 0.86, `expo-router`, TypeScript strict, Android-Paketname
`de.domenicmoran.futuredev`, Slug `futuredev`.

Fünf Reiter unter `app/(tabs)/`: Start (`index`), Lernen (`lernen`), Hören (`hoeren`),
Üben (`ueben`), Ich (`ich`). Onboarding unter `app/onboarding.tsx` (drei Schritte,
Zustand im Speicher). Lektionsroute `app/lesson/[id].tsx` zeigt in dieser Phase nur
eine ehrliche Ladeansicht, Agent B ersetzt sie durch den vollständigen
Lektionsbildschirm.

Inhalt aus `@futuredev/content-schema` (`content/modules.json` für die Modulkarte)
geladen und lokal in SQLite (`expo-sqlite`) sowie Dateisystem (`expo-file-system`)
gehalten, Design aus `@futuredev/design-tokens` (`src/theme/useTheme.ts`), Wiederholung
und Auswertung aus `@futuredev/core`. Sichtbare Texte stehen in `src/i18n/de.ts`.

Icon und Splash sind mit `scripts/make-icons.mjs` aus einer eigenen SVG erzeugt
(Buchstabe „F" aus zwei Formen in Akzentfarbe auf Hintergrundfarbe der Token), kein
Stockbild:

```bash
pnpm --filter @futuredev/mobile run make-icons
```

Bau ohne EAS: lokal mit `expo prebuild --platform android` und
`gradlew assembleRelease`, signiert mit einem Keystore außerhalb dieses Repos unter
`90_Werkstatt/schluessel/futuredev-android/` (siehe Entscheidung
`2026-09-19-futuredev-apk-bau-lokal-ohne-eas` im Vault). Wegen der Windows-
Pfadlänge beim C++-Codegen läuft der Bau über die Junction `C:\rnb\FutureDev`.
CI (`.github/workflows/ci.yml`) baut **keine** APK: nur Typecheck, Lint, Tests,
`content:validate` und Secrets-Scan. Ein optionaler CI-APK-Job mit Keystore als
GitHub-Secret ist nicht implementiert.

### Bauen auf Windows

Die React-Native New Architecture ist in `app.json` (`newArchEnabled: false`)
absichtlich deaktiviert, um C++-Codegen und damit die Windows-Pfadlänge beim
Release-Build zu reduzieren; der Wert überlebt `expo prebuild`.

Drei Dinge zusammen, sonst scheitert der native Bau an der Windows-Pfadlänge
(`ninja: error: manifest 'build.ninja' still dirty after 100 tries` in einem
`.cxx`-Ordner eines nativen Moduls wie `react-native-screens`):

1. **`.npmrc` in der Repo-Wurzel mit `node-linker=hoisted`.** Der Standard-Linker
   von pnpm legt jedes Paket unter `node_modules/.pnpm/<name>@<version>_<hash>/
   node_modules/<name>/...` ab, das kostet rund 80 Zeichen zusätzlich in jedem
   Pfad. Mit `hoisted` liegen die Pakete flach unter `node_modules/<name>/...`.
2. **Bau über die Junction `C:\rnb\FutureDev`**, nie über den langen Pfad unter
   `Dokumente`. `git rev-parse --show-toplevel` zeigt dabei weiterhin den langen
   Pfad (Git löst die Junction zum Realpfad auf), das betrifft aber nur Git,
   nicht die Dateisystemzugriffe von Gradle/Ninja.
3. **Nur die Emulator-Architektur bauen**: Umgebungsvariable
   `ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64` vor `gradlew` setzen,
   das spart eine ganze Ordnerebene je Nicht-Ziel-Architektur.

Ohne diese drei Punkte bricht der Bau mit einem Fehler wie
`ninja: error: Stat([...]\RNGestureHandlerDetectorShadowNode.cpp.o): Filename
longer than 260 characters` ab, weil CMake/Ninja Junctions zum Realpfad
auflösen und der Pfad unter `Dokumente\Projekte\FutureDev` dafür zu lang ist.

Beispiel für einen Debug-Bau aus `C:\rnb\FutureDev\apps\mobile\android`:

```bash
ANDROID_HOME="C:/Users/<user>/AppData/Local/Android/Sdk" \
ANDROID_SDK_ROOT="C:/Users/<user>/AppData/Local/Android/Sdk" \
ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64 \
./gradlew.bat assembleDebug
```

`android/local.properties` (von Git ignoriert) braucht `sdk.dir` mit doppelt
maskierten Backslashes, etwa `sdk.dir=C\:\\Users\\<user>\\AppData\\Local\\Android\\Sdk`.

Befehle (ab Phase 3):

```bash
pnpm --filter @futuredev/mobile run start
pnpm --filter @futuredev/mobile run android
pnpm --filter @futuredev/mobile run typecheck
pnpm --filter @futuredev/mobile run lint
pnpm --filter @futuredev/mobile run test
```

### Relative Importe mit fester ".js"-Endung

Der ganze Workspace schreibt relative Importe im NodeNext-Stil mit fester
`.js`-Endung, auch wenn die Quelle eine `.ts`- oder `.tsx`-Datei ist (siehe
`packages/*`). Metro löst das ohne Zusatzschritt nicht auf, weil es bei einer
angegebenen Endung keine Alternativen mehr probiert und mit
`UnableToResolveError` abbricht. `metro.config.js` fängt genau diesen Fall
mit einem eigenen `resolver.resolveRequest` ab: schlägt eine relative
`.js`-Anfrage fehl, wird dieselbe Anfrage ohne Endung erneut versucht, damit
Metros eigene `sourceExts`-Reihenfolge greift. Kein Quellcode wird dafür
umgeschrieben.

### Emulator-Rezept

Eigener AVD `futuredev_shots` (nicht den fremden AVD `salati_a` verwenden):

```bash
avdmanager create avd -n futuredev_shots -k "system-images;android-36;google_apis;x86_64" -d pixel_7
emulator -avd futuredev_shots -port 5560 -no-snapshot-load -no-boot-anim
adb -s emulator-5560 install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Metro läuft bewusst auf Port 8082, nicht 8081 (ein zweiter, fremder Metro-Lauf
auf 8081 liefert sonst ein fremdes Bundle in die eigene App, siehe
`feedback_metro_port_8081_zeigt_fremde_app.md`):

```bash
npx expo start --dev-client --port 8082
adb -s emulator-5560 reverse tcp:8082 tcp:8082
```

Wichtige Falle: dieser Build enthält kein `expo-dev-client` (bare Build), und
React Native spricht den Bundler auf dem Emulator immer fest unter
`10.0.2.2:8081` an, unabhängig vom `--port`-Wert. `adb reverse` wirkt nur auf
`localhost` des Geräts, nicht auf `10.0.2.2` (das läuft über das eigene
QEMU-Netz direkt zum Host). Ohne Weiteres bekommt die App also immer die
RedBox „Unable to load script“. Abhilfe: ein schlanker TCP-Durchreicher auf
dem Host, der `127.0.0.1:8081` nur an `127.0.0.1:8082` weiterreicht (kein
zweites Metro auf 8081, nur ein Rohr):

```bash
node -e "require('net').createServer(c=>{const u=require('net').connect(8082,'127.0.0.1',()=>{c.pipe(u);u.pipe(c)});u.on('error',()=>c.destroy());c.on('error',()=>u.destroy())}).listen(8081,'127.0.0.1')"
```

Bauzeit für `assembleDebug` bei kaltem Gradle-Daemon: rund 3 Minuten
(gemessen: 3 min 5 s). Bildschirmfotos je Reiter mit
`adb exec-out screencap -p > datei.png` nach dem in der Aufgabe genannten
Zielordner, niemals als Behauptung ohne Datei.

### Fallen

**Schwarzer Bildschirm beim Start, ohne Absturz.** Ursache war nicht der
JavaScript-Code (auch ein leeres Wurzel-Layout ohne jeden Provider blieb
schwarz), sondern Metro selbst: `metro.config.js` hatte `watchFolders` auf
die ganze Repo-Wurzel gesetzt. Dadurch krabbelte Metro auch durch
`apps/web` (eigenes Next.js), `apps/mobile/android` (1,3 GB native
Bauartefakte, gemessen mit `du -sh`), `supabase/` und `tools/`. Der erste
Bündel-Abruf dauerte dadurch bis zu 20 Minuten und endete zuletzt mit
`Metro has encountered an error: Failed to get the SHA-1 for:
[...]\node_modules\react-native\node_modules\@react-native\js-polyfills\
console.js` (ein leerer, verwaister `node_modules`-Rest unter
`react-native`, den ein früherer Installationsstand hinterlassen hatte und
den der breite Crawl in den Haste-Cache aufnahm). Der native Client wartete
auf eine Antwort, die nie kam: kein `ReactNativeJS`-Log nach
`Running "main"`, keine RedBox, keine Absturzmeldung, nur ein leeres
`android.view.View` laut `uiautomator dump`. Ursache belegt mit
`curl -s -o out.json -w "%{http_code} %{time_total}s"
"http://localhost:8082/node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false"`
(erst `500` nach 20 Minuten, Fehlertext wie oben). Behoben durch engere
`watchFolders` (nur die gehobenen `node_modules` und `packages/*`) und eine
`resolver.blockList` für `apps/web`, `apps/mobile/android`,
`apps/mobile/.expo`, `supabase/` und `tools/` (nicht `content/`: das JSON
dort ist mit 73 KB winzig und wird von `src/settings/profile.ts` direkt
importiert). Nach dem Neustart mit `--clear` lieferte derselbe Bündel-Abruf
`200` in rund 2 bis 15 Sekunden. Lehre: ein `watchFolders = [workspaceRoot]`
in einem pnpm-Monorepo mit mehreren Apps und nativen Bauordnern ist keine
harmlose Bequemlichkeit, sondern ein Risiko, das erst bei wachsendem Repo
sichtbar wird.

Ein Timeout bei `adb shell am start -W` (`Status: timeout`, keine
`Drawn`-Zeile) ist bei diesem Build für sich kein Beleg für einen Fehler:
die App ruft `reportFullyDrawn()` nicht auf, darum liefert `-W` hier nie
`Complete`. Beleg für „läuft wirklich" ist stattdessen ein Bildschirmfoto
nach ein paar Sekunden Wartezeit und ein leeres Ergebnis von
`adb logcat -d | grep -iE "UnsatisfiedLinkError|SIGSEGV|FATAL"` nach
mehreren Reloads.

### Klickdurchgang (Prüfrezept)

Vollständiger manueller Durchgang vor jedem Release-Kandidaten, mit Beleg
(Bildschirmfoto) je Schritt nach `Projektordner/90_Werkstatt/futuredev/shots/`,
Logcat-Kontrolle auf `UnsatisfiedLinkError|FATAL|Uncaught` nach jedem Block.
Vor dem Durchgang: `pm clear` für einen echten Erststart, Metro mit `--clear`
frisch starten (siehe oben), nur ein Bauprozess gleichzeitig.

1. **Onboarding** (drei Schritte: Ziel, Lesen/Hören, Tagesziel) bis zum
   Start-Reiter.
2. **Start**: Karten „Weiter" (nach dem ersten Durchgang), „Heute fällig",
   „Nächste Empfehlung" sichtbar und antippbar.
3. **Lernen**: Modulliste → Untermodul → Lektionsliste → Lektion öffnen.
4. **Lektionsbildschirm**: bis ans Ende scrollen, Begriffe-Chip öffnet die
   Glossar-Karte (Begriff antippen, „Schließen"), Lesezeichen an einem Block
   setzen (Symbol wird gefüllt/blau), Notiz-Eingabe öffnen und speichern,
   Praxisaufgabe-Kästchen abhaken, „Im Repo ansehen" öffnet den Browser.
5. **Hören-Umschalter**: aus der Lektion in den Player wechseln, Position und
   Kapitel prüfen; danach „Im Text lesen" zurück in die Lektion.
6. **Vollbild-Player**: Tempo, Sprung 15 s/30 s, Kapitelmarken, Schlaf-Timer,
   Warteschlange; Home-Taste drücken, `dumpsys media_session` zeigt die
   Sitzung weiter aktiv, Benachrichtigung vorhanden.
7. **Quiz**: aus der Lektion starten, alle Fragen beantworten (mindestens
   eine absichtlich falsch), Ergebnisbildschirm, „Zur Lektion".
8. **Üben**: Tagesration, Wiederholungsrunde, Modulprüfung starten und über
   die Zurück-Geste abbrechen (Bestätigungsdialog muss erscheinen).
9. **Ich**: Fortschritt, Jobreife, Notizen, Lesezeichen, Portfolio,
   Checkliste; Einstellungen (Dunkelmodus, Tagesziel, Export — Datei muss im
   Freigabe-Dialog erscheinen), alle vier Rechtstexte öffnen.
10. **Persistenz**: `am force-stop`, App neu starten: Start zeigt
    „Weitermachen" mit der zuletzt gelesenen Blocknummer, Einstellungen und
    Notizen bleiben erhalten.
11. **Offline**: `svc wifi disable && svc data disable`, App neu starten,
    heruntergeladene Lektion lesen/hören, Offline-Banner sichtbar; danach
    Netz wieder aktivieren.

Werkzeuge je Schritt: `adb shell uiautomator dump` plus `bounds` aus dem
XML für exakte Tippkoordinaten (Bildschirmkoordinaten sind 1,2× die im
Screenshot sichtbaren, falls der Screenshot verkleinert angezeigt wird),
`adb exec-out screencap -p > datei.png` für den Beleg, ein bis zwei Sekunden
Wartezeit zwischen Tipp und Bildschirmfoto (sonst zeigt das Foto den Stand
vor der Navigation). Ein Deep-Link (`adb shell am start -a
android.intent.action.VIEW -d "futuredev://<route>" de.domenicmoran.futuredev`)
umgeht eine blockierende Dev-Overlay-Meldung („Open debugger to view
warnings", LogBox, nur im Dev-Build) zuverlässiger als ein Tipp auf die
Reiterleiste.
