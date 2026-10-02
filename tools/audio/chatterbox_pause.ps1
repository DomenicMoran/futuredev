# Soft-Pause: GPU wird nach aktuellem Block frei; Supervisor startet nicht neu.
param(
    [string]$Reason = "gaming"
)
$ErrorActionPreference = "Stop"
$AudioDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Control = Join-Path $AudioDir "out\_chatterbox_control.json"
$stamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
$payload = @{
    desired   = "pause"
    updatedAt = $stamp
    reason    = $Reason
} | ConvertTo-Json
New-Item -ItemType Directory -Force -Path (Split-Path $Control) | Out-Null
[System.IO.File]::WriteAllText($Control, $payload + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Host "Pause gesetzt -> $Control"
Get-Content $Control
