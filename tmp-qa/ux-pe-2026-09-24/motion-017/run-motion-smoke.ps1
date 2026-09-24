$ErrorActionPreference = "Continue"
$root = "C:\rnb\FutureDev"
$adb = "C:\Users\domen\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$ser = "emulator-5560"
$out = "$root\tmp-qa\ux-pe-2026-09-24\motion-017"
$pkg = "de.domenicmoran.futuredev"
$apk = "$root\tmp-qa\apk\futuredev-v0.1.17-x86_64-emulator.apk"

New-Item -ItemType Directory -Force -Path $out | Out-Null

function Shot([string]$name) {
  $remote = "/sdcard/motion-$name.png"
  & $adb -s $ser shell screencap -p $remote | Out-Null
  & $adb -s $ser pull $remote "$out\$name.png" 2>$null | Out-Null
}

function Tap([int]$x, [int]$y) {
  & $adb -s $ser shell input tap $x $y | Out-Null
  Start-Sleep -Seconds 2
}

function TapText([string]$needle) {
  & $adb -s $ser shell uiautomator dump /sdcard/window_dump.xml 2>$null | Out-Null
  & $adb -s $ser pull /sdcard/window_dump.xml "$out\_tmp.xml" 2>$null | Out-Null
  if (-not (Test-Path "$out\_tmp.xml")) { return $false }
  $xml = [IO.File]::ReadAllText("$out\_tmp.xml")
  $esc = [regex]::Escape($needle)
  foreach ($pat in @(
      "text=`"$esc`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`"",
      "content-desc=`"$esc`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
    )) {
    $m = [regex]::Match($xml, $pat)
    if ($m.Success) {
      $x = [int](([int]$m.Groups[1].Value + [int]$m.Groups[3].Value) / 2)
      $y = [int](([int]$m.Groups[2].Value + [int]$m.Groups[4].Value) / 2)
      Tap $x $y
      return $true
    }
  }
  return $false
}

function DismissSystem() {
  TapText "Don't allow" | Out-Null
  TapText "Nicht zulassen" | Out-Null
}

function ScrollDown() {
  & $adb -s $ser shell input swipe 540 1700 540 700 350 | Out-Null
  Start-Sleep -Seconds 1
}

$tabStart = @(108, 2264)
$tabLernen = @(324, 2264)
$tabHoeren = @(540, 2264)
$tabUeben = @(756, 2264)
$tabIch = @(972, 2264)

if (-not (Test-Path $apk)) { throw "APK missing: $apk" }

& $adb -s $ser shell am force-stop com.google.android.youtube | Out-Null
& $adb -s $ser install -r $apk | Out-Null
& $adb -s $ser shell am force-stop $pkg | Out-Null
& $adb -s $ser shell pm clear $pkg | Out-Null
Start-Sleep -Seconds 2
& $adb -s $ser shell monkey -p $pkg -c android.intent.category.LAUNCHER 1 | Out-Null
Start-Sleep -Seconds 6
DismissSystem
Shot "01-onboarding-step1"

if (-not (TapText "Freies Interesse")) {
  if (-not (TapText "Berufsbegleitend upskillen")) { TapText "Berufswechsel" | Out-Null }
}
Start-Sleep -Seconds 1
Shot "02-onboarding-step2"
TapText "Lesen zuerst" | Out-Null
TapText "Abends" | Out-Null
ScrollDown
if (-not (TapText "Weiter")) { Tap 540 2196 }
Start-Sleep -Seconds 2
Shot "03-onboarding-step3"
ScrollDown
if (-not (TapText "40 Minuten")) {
  if (-not (TapText "60 Minuten")) { TapText "90 Minuten" | Out-Null }
}
Start-Sleep -Seconds 1
if (-not (TapText "Los geht")) { TapText "Weiter" | Out-Null }
Start-Sleep -Seconds 8
DismissSystem
Shot "04-start"

Tap $tabLernen[0] $tabLernen[1]
Start-Sleep -Seconds 3
Shot "05-lernen"

& $adb -s $ser shell am start -a android.intent.action.VIEW -d "futuredev://lesson/M01-01-01" $pkg 2>&1 | Out-Null
Start-Sleep -Seconds 6
DismissSystem
Shot "06-lesson"
1..10 | ForEach-Object { ScrollDown }
Shot "07-lesson-sticky"

Tap $tabHoeren[0] $tabHoeren[1]
Start-Sleep -Seconds 3
Shot "08-hoeren"

Tap $tabUeben[0] $tabUeben[1]
Start-Sleep -Seconds 3
Shot "10-ueben"

Tap $tabIch[0] $tabIch[1]
Start-Sleep -Seconds 3
Shot "11-ich"

Tap $tabHoeren[0] $tabHoeren[1]
Start-Sleep -Seconds 2
TapText "Weiterhören" | Out-Null
TapText "Abspielen" | Out-Null
Start-Sleep -Seconds 4
Shot "12-mini-player"

Write-Host "Screenshots in $out"
