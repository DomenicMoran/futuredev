# Startet das lokale Chatterbox-Dashboard (127.0.0.1:8765) und oeffnet den Browser.
$ErrorActionPreference = "Stop"
$AudioDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DashPy = Join-Path $AudioDir "chatterbox_dashboard.py"
$Url = "http://127.0.0.1:8765/"
$Port = 8765

function Test-PortListening {
    param([int]$LocalPort)
    try {
        $c = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue |
            Where-Object { $_.LocalAddress -eq "127.0.0.1" -or $_.LocalAddress -eq "0.0.0.0" }
        return [bool]$c
    } catch {
        return $false
    }
}

if (-not (Test-PortListening -LocalPort $Port)) {
    $py = $null
    if (Test-Path (Join-Path $AudioDir ".venv-chatterbox\Scripts\python.exe")) {
        $py = Join-Path $AudioDir ".venv-chatterbox\Scripts\python.exe"
    } else {
        $py = "python"
    }
    Start-Process -FilePath $py -ArgumentList @("-u", $DashPy) `
        -WorkingDirectory $AudioDir -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 1
}

Start-Process $Url
Write-Host "Dashboard: $Url"
