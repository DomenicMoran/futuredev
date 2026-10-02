# Resume: desired=run; startet Batch-Launcher falls kein render_chatterbox laeuft.
$ErrorActionPreference = "Stop"
$AudioDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Control = Join-Path $AudioDir "out\_chatterbox_control.json"
$Batch = Join-Path $AudioDir "run_chatterbox_batch.ps1"
$stamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
$payload = @{
    desired   = "run"
    updatedAt = $stamp
    reason    = ""
} | ConvertTo-Json
New-Item -ItemType Directory -Force -Path (Split-Path $Control) | Out-Null
[System.IO.File]::WriteAllText($Control, $payload + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Host "Resume gesetzt -> $Control"

$alive = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*render_chatterbox.py*" }
if (-not $alive) {
    Write-Host "Kein Worker/Supervisor - starte $Batch"
    Start-Process powershell -ArgumentList @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $Batch
    ) -WorkingDirectory $AudioDir -WindowStyle Hidden
} else {
    $pids = ($alive | ForEach-Object { $_.ProcessId }) -join ", "
    Write-Host "render_chatterbox laeuft bereits, PIDs: $pids"
}
