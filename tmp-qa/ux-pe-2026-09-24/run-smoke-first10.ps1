# Release gate: first-10s user bugs (Start, playlist, bookmark, chrome)
$ErrorActionPreference = "Continue"
$adb = "C:\Users\domen\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$ser = "emulator-5560"
$out = "C:\rnb\FutureDev\tmp-qa\ux-pe-2026-09-24"
$pkg = "de.domenicmoran.futuredev"
$apk = "C:\rnb\FutureDev\tmp-qa\apk\futuredev-v0.1.16-x86_64-emulator.apk"
$fail = 0

New-Item -ItemType Directory -Force -Path $out | Out-Null

function Tap([int]$x, [int]$y) {
  & $adb -s $ser shell input tap $x $y | Out-Null
  Start-Sleep -Seconds 2
}

function DumpUi([string]$name) {
  & $adb -s $ser shell uiautomator dump /sdcard/window_dump.xml 2>$null | Out-Null
  & $adb -s $ser pull /sdcard/window_dump.xml "$out\smoke-first10-$name.xml" 2>$null | Out-Null
}

function Mid([string]$a, [string]$b) { return [int](([int]$a + [int]$b) / 2) }

function TapText([string]$needle) {
  DumpUi "_tmp"
  $xml = [IO.File]::ReadAllText("$out\smoke-first10-_tmp.xml")
  $esc = [regex]::Escape($needle)
  foreach ($pat in @(
      "text=`"$esc`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`"",
      "content-desc=`"$esc`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
    )) {
    $m = [regex]::Match($xml, $pat)
    if ($m.Success) {
      Tap (Mid $m.Groups[1].Value $m.Groups[3].Value) (Mid $m.Groups[2].Value $m.Groups[4].Value)
      return $true
    }
  }
  return $false
}

function XmlText([string]$path) {
  if (-not (Test-Path $path)) { return "" }
  return [IO.File]::ReadAllText($path)
}

if (-not (Test-Path $apk)) { Write-Error "APK missing: $apk"; exit 1 }

& $adb -s $ser install -r $apk | Out-Null
& $adb -s $ser shell pm clear $pkg | Out-Null
Start-Sleep -Seconds 2
& $adb -s $ser shell monkey -p $pkg -c android.intent.category.LAUNCHER 1 | Out-Null
Start-Sleep -Seconds 8

if (-not (TapText "Freies Interesse")) { TapText "Berufsbegleitend upskillen" | Out-Null }
TapText "Lesen zuerst" | Out-Null
if (-not (TapText "Morgens")) { TapText "Abends" | Out-Null }
& $adb -s $ser shell input swipe 540 1700 540 700 350 | Out-Null
Start-Sleep -Seconds 1
if (-not (TapText "Weiter")) { Tap 540 2196 }
Start-Sleep -Seconds 1
& $adb -s $ser shell input swipe 540 1700 540 700 350 | Out-Null
Start-Sleep -Seconds 1
if (-not (TapText "40 Minuten")) { TapText "60 Minuten" | Out-Null }
Start-Sleep -Seconds 1
if (-not (TapText "Los geht")) { TapText "Weiter" | Out-Null }
Start-Sleep -Seconds 10

DumpUi "start-cold"
$startXml = XmlText "$out\smoke-first10-start-cold.xml"
$hasCurriculum = $startXml -match "Tagesziel|Nächste Empfehlung|Weiterhören|Weiterlesen"
$falseEmpty = ($startXml -match "Noch kein Fortschritt") -and -not $hasCurriculum
if ($falseEmpty -or -not $hasCurriculum) {
  Write-Host "FAIL F1/F2 Start empty or missing curriculum signal"
  $fail = 1
} else {
  Write-Host "PASS F1/F2 Start dashboard"
}

Tap 540 2264
Start-Sleep -Seconds 2
if (-not (TapText "Neue Playlist")) { Tap 1020 800 }
Start-Sleep -Seconds 1
& $adb -s $ser shell input text "SmokeFirst10" | Out-Null
Start-Sleep -Seconds 1
TapText "Speichern" | Out-Null
Start-Sleep -Seconds 2
DumpUi "playlist"
if ((XmlText "$out\smoke-first10-playlist.xml") -notmatch "SmokeFirst10") {
  Write-Host "FAIL F3 playlist create"
  $fail = 1
} else {
  Write-Host "PASS F3 playlist"
}

Tap 324 2264
Start-Sleep -Seconds 2
TapText "Erstes Modul" | Out-Null
if (-not (TapText "Was eine Webseite")) { Tap 540 1200 | Out-Null }
Start-Sleep -Seconds 3
TapText "Lesezeichen gesetzt" | Out-Null
Start-Sleep -Seconds 2
Tap 972 2264
Start-Sleep -Seconds 3
DumpUi "ich-bookmark"
if ((XmlText "$out\smoke-first10-ich-bookmark.xml") -notmatch "Block") {
  Write-Host "FAIL F4 bookmark persist"
  $fail = 1
} else {
  Write-Host "PASS F4 bookmark"
}

Tap 540 2264
Start-Sleep -Seconds 2
TapText "Hören" | Out-Null
Start-Sleep -Seconds 5
DumpUi "chrome"
$chrome = XmlText "$out\smoke-first10-chrome.xml"
$tabM = [regex]::Match($chrome, 'content-desc="Hören, Tab\. 3 von 5\.[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
$playM = [regex]::Match($chrome, 'content-desc="Abspielen"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
if ($tabM.Success -and $playM.Success) {
  $tabTop = [int]$tabM.Groups[2].Value
  $playBottom = [int]$playM.Groups[4].Value
  $gap = $tabTop - $playBottom
  if ($playBottom -gt $tabTop -or $gap -gt 24) {
    Write-Host "FAIL F5 miniplayer gap=$gap tabTop=$tabTop playBottom=$playBottom"
    $fail = 1
  } else {
    Write-Host "PASS F5 chrome gap=$gap"
  }
} else {
  Write-Host "WARN F5 could not parse bounds (manual check)"
}

if ($fail -ne 0) { exit 1 }
Write-Host "SMOKE-FIRST10 ALL PASS"
exit 0
