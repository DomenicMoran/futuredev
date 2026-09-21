# Durable Chatterbox batch launcher for FutureDev.
# - single instance (Python lock)
# - unbuffered logs to %TEMP%
# - Python --supervise restarts on crash / progress stall
#
# Usage:
#   powershell -File C:\rnb\FutureDev\tools\audio\run_chatterbox_batch.ps1
#   powershell -File C:\rnb\FutureDev\tools\audio\run_chatterbox_batch.ps1 -Limit 5

param(
    [int]$Limit = 0,
    [int]$StallSeconds = 900
)

$ErrorActionPreference = "Stop"
$AudioDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPy = Join-Path $AudioDir ".venv-chatterbox\Scripts\python.exe"
$Script = Join-Path $AudioDir "render_chatterbox.py"
$Log = Join-Path $env:TEMP "fd-chatterbox-batch.log"
$ErrLog = Join-Path $env:TEMP "fd-chatterbox-batch.err.log"
$Progress = Join-Path $AudioDir "out\_chatterbox_progress.json"
$Lock = Join-Path $AudioDir "out\_chatterbox_batch.lock"

if (-not (Test-Path $VenvPy)) {
    throw "venv fehlt: $VenvPy"
}

# Stop leftover workers (same script only)
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*render_chatterbox.py*" } |
    ForEach-Object {
        Write-Host "Stoppe alten Worker pid=$($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
Start-Sleep -Seconds 2
if (Test-Path $Lock) { Remove-Item $Lock -Force -ErrorAction SilentlyContinue }

$argsList = @("-u", $Script, "--all-missing", "--supervise", "--stall-seconds", "$StallSeconds")
if ($Limit -gt 0) {
    $argsList += @("--limit", "$Limit")
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $Log -Value "`n==== batch start $stamp ====`n"
Write-Host "Log: $Log"
Write-Host "Progress: $Progress"
Write-Host "Start: $VenvPy $($argsList -join ' ')"

$p = Start-Process -FilePath $VenvPy -ArgumentList $argsList `
    -WorkingDirectory $AudioDir `
    -RedirectStandardOutput $Log `
    -RedirectStandardError $ErrLog `
    -WindowStyle Hidden `
    -PassThru

Write-Host "Supervisor pid=$($p.Id) gestartet."
Write-Host "Status: Get-Content $Progress ; Get-Content $Log -Tail 30"
