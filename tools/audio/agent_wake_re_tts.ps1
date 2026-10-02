# Durable Re-TTS wake loop — survives Cursor shell aborts.
# Writes ticks to %TEMP%\fd-chatterbox-agent-wake.log every 30 minutes.
$ErrorActionPreference = 'Continue'
$Progress = 'C:\Users\domen\Documents\Projekte\FutureDev\tools\audio\out\_chatterbox_progress.json'
$OutDir = 'C:\Users\domen\Documents\Projekte\FutureDev\tools\audio\out'
$WakeLog = Join-Path $env:TEMP 'fd-chatterbox-agent-wake.log'
$PidFile = Join-Path $env:TEMP 'fd-chatterbox-agent-wake.pid'
Set-Content -Path $PidFile -Value $PID -Encoding ascii
Add-Content -Path $WakeLog -Value "$(Get-Date -Format o) wake-loop-start pid=$PID"
while ($true) {
  Start-Sleep -Seconds 1800
  $status = 'unknown'
  if (Test-Path $Progress) {
    try {
      $p = Get-Content $Progress -Raw | ConvertFrom-Json
      $status = "$($p.status)|$($p.lessonId)|$($p.block)/$($p.totalBlocks)"
    } catch { $status = 'parse-fail' }
  }
  $prov = @(Get-ChildItem (Join-Path $OutDir '*.provenance.json') -ErrorAction SilentlyContinue).Count
  $line = "$(Get-Date -Format o) AGENT_LOOP_TICK_re-tts status=$status prov=$prov/197"
  Add-Content -Path $WakeLog -Value $line
  Write-Output $line
  if ($status -match 'batch-complete') {
    Add-Content -Path $WakeLog -Value "$(Get-Date -Format o) batch-complete - exit wake loop"
    break
  }
}
