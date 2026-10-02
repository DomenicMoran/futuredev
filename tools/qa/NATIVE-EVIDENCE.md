# Native QA mit überprüfbarer Herkunft

Die beiden historischen Ablaufskripte sind **Smoke-/Capture-Werkzeuge**, keine Zusicherung einer perfekten App. Visuelle Prüfung, TalkBack, Schrift-/Gerätematrix, Datenmigration, Nebenläufigkeit und Audioqualität benötigen eigene Nachweise.

## Sicherer Aufruf

Beide Skripte verlangen alle folgenden Flags. Keine automatische Auswahl eines Emulators, einer APK oder eines alten Ausgabeordners:

```powershell
$Apk = 'C:\Pfad\zur\tatsaechlich-geprueften.apk'
$Sha = (Get-FileHash -LiteralPath $Apk -Algorithm SHA256).Hash
node tools/qa/run-perfect-gate.cjs `
  --serial emulator-5562 --avd futuredev_audit_20260925 `
  --apk $Apk --sha256 $Sha --version 0.1.22 --version-code 22 `
  --out tmp-qa/eindeutig-neuer-lauf --mode upgrade
```

Version, Versioncode, dedizierte Serial und AVD müssen zum tatsächlichen eigenen Prüflauf passen. Die Beispielversion ist keine Behauptung über ein bereits gebautes oder veröffentlichtes Artefakt. `run-ux-pixel-audit.cjs` nutzt dieselben Flags.

- `upgrade` erhält vorhandene Appdaten. Es ist kein Cleaninstall-Nachweis.
- `clean` führt nach geprüftem Installieren **pm clear** auf der ausdrücklich gewählten App/Instanz aus. Upgrade-Ausgangsdaten vorher außerhalb der App sichern. Niemals die einzige Upgrade-Testbasis löschen.
- Vor jeglicher Geräteänderung werden lokale APK-SHA, Emulatorbereitschaft, tatsächlicher AVD-Name und ein neuer Ausgabeordner geprüft. Der alte Koordinatenablauf verlangt 1080x2400, Dichte420, Schriftfaktor1; andere Konfigurationen nicht heimlich zurücksetzen, sondern separat prüfen.
- Nach Installation werden Versionsname/-code geprüft und die tatsächlich installierte base.apk zurückgelesen und gehasht. Gleiche Versionsnummer allein beweist nicht dasselbe Artefakt.
- Jede UI-Abfrage verwendet einen neuen UUID-Dateinamen. Fehler, fehlende Bestätigung, ungültige/abgebrochene Hierarchie oder Screenshotfehler brechen ab. Es gibt keinen historischen XML-Fallback.
- Aktive Playeranimation kann UIAutomator am Idle-Dump hindern. Das ist ein fehlender Dump, kein bestandener Test. Frische Screenshots und native Medienzustände separat erfassen und ihren begrenzten Aussageumfang nennen.
- Ausgabeordner und benannte Screens dürfen nicht wiederverwendet/überschrieben werden. Abgebrochene Läufe bleiben als `incomplete-or-failed` erhalten.
- Vom Aufrufer gesetzte CI-Umgebungswerte sind lediglich ungeprüfte Metadaten, keine selbst ausgeführten CI-Belege. Bilder müssen tatsächlich angesehen werden; XML kann ellipsierte Schrift trotzdem vollständig wiedergeben.

## Regressionstests der Prüfwerkzeuge

```powershell
node --test tools/qa/native-evidence.test.cjs
pnpm exec eslint tools/qa eslint.config.mjs
```

Die Tests prüfen unter anderem einen fehlgeschlagenen frischen Dump trotz vorhandenem alten XML, falschen Emulator, gleiche Version bei falschen APK-Bytes, wiederverwendete Belegpfade und nicht unterstützte Koordinatengeometrie. Sie ändern kein Gerät.
