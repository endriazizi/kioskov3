param(
  [int]$Port = $(if ($env:TOTEM_PORT) { [int]$env:TOTEM_PORT } else { 8200 }),
  [int]$PollSec = $(if ($env:TOTEM_DEV_POLL_SEC) { [int]$env:TOTEM_DEV_POLL_SEC } else { 15 }),
  [int]$StartGraceSec = $(if ($env:TOTEM_DEV_START_GRACE_SEC) { [int]$env:TOTEM_DEV_START_GRACE_SEC } else { 90 }),
  [string]$HostName = '127.0.0.1'
)

$ErrorActionPreference = 'SilentlyContinue'
$KioskRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$HealthScript = Join-Path $PSScriptRoot 'totem-http-health.ps1'
$StopPortScript = Join-Path $PSScriptRoot 'stop-totem-port.ps1'

if (-not (Test-Path (Join-Path $KioskRoot 'package.json'))) {
  Write-Host "[ERR] package.json non trovato in $KioskRoot"
  exit 1
}

function Test-TotemHttpHealthy {
  if (-not (Test-Path $HealthScript)) { return $false }
  & powershell -NoProfile -ExecutionPolicy Bypass -File $HealthScript -Port $Port -HostName $HostName
  return ($LASTEXITCODE -eq 0)
}

$devStartInFlight = $false
$lastStartAt = [datetime]::MinValue

function Start-TotemDevServer {
  if ($devStartInFlight) { return }
  if (((Get-Date) - $lastStartAt).TotalSeconds -lt 60) { return }
  $devStartInFlight = $true
  $lastStartAt = Get-Date
  Write-Host "[Totem] Dev server non healthy - stop porta $Port e riavvio npm run start:totem:prodproxy ..."
  if (Test-Path $StopPortScript) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $StopPortScript -Port $Port
  }
  Start-Process -FilePath 'cmd.exe' -WorkingDirectory $KioskRoot -WindowStyle Minimized `
    -ArgumentList '/c', 'npm run start:totem:prodproxy'
  Start-Sleep -Seconds $StartGraceSec
  $devStartInFlight = $false
}

Write-Host "[Totem] Watchdog dev server (HTTP health) - poll ${PollSec}s su http://${HostName}:${Port}/"
Write-Host "[Totem] Cartella: $KioskRoot"

if (-not (Test-TotemHttpHealthy)) {
  Start-TotemDevServer
}

while ($true) {
  if (-not (Test-TotemHttpHealthy)) {
    Write-Host "[Totem] $(Get-Date -Format 'HH:mm:ss') - dev server non risponde (HTTP)"
    Start-TotemDevServer
  }
  Start-Sleep -Seconds $PollSec
}
