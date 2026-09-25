# Emulator-QA-APK (Perfect Gate / Pixel-Audit)

Store- und arm64-Release-APKs nutzen `app.json` mit `qaSkipOnboarding: false` und `qaEmulatorBuild: false`. QA-Hilfen laufen nur mit **beidem**: gesetztem Extra-Flag **und** Nicht-Store-Signal (`__DEV__`, `qaEmulatorBuild`, oder `EXPO_PUBLIC_FUTUREDEV_QA=1` zur Bundle-Zeit).

## x86_64 Emulator-Release (QA eingeschaltet)

Vor `expo prebuild` / erneutem JS-Bundle für den x86-Build:

```powershell
$env:FUTUREDEV_QA_EMULATOR = '1'
# optional zusätzlich:
$env:EXPO_PUBLIC_FUTUREDEV_QA = '1'
```

`app.config.js` setzt dann nur für diesen Lauf `extra.qaSkipOnboarding` und `extra.qaEmulatorBuild` auf `true`. **Nicht** für arm64 setzen.

Beispiel (aus `C:\rnb\FutureDev\apps\mobile\android`, nach prebuild):

```powershell
$env:ORG_GRADLE_PROJECT_reactNativeArchitectures = 'x86_64'
$env:FUTUREDEV_QA_EMULATOR = '1'
.\gradlew.bat assembleRelease --no-daemon
Copy-Item -Force app\build\outputs\apk\release\app-release.apk `
  C:\rnb\FutureDev\tmp-qa\apk\futuredev-v0.1.21-x86_64-emulator.apk
```

## arm64 Release (Gerät / GitHub Latest)

Ohne `FUTUREDEV_QA_EMULATOR`. Frische Installation zeigt Onboarding.

```powershell
$env:ORG_GRADLE_PROJECT_reactNativeArchitectures = 'arm64-v8a'
Remove-Item Env:FUTUREDEV_QA_EMULATOR -ErrorAction SilentlyContinue
.\gradlew.bat assembleRelease --no-daemon
```

Verifizieren (embedded config):

```powershell
$aapt = "$env:LOCALAPPDATA\Android\Sdk\build-tools\*\aapt.exe"
& (Get-Item $aapt | Select-Object -First 1).FullName dump badging .\app-release.apk
# assets/app.config sollte qaSkipOnboarding false enthalten
```
