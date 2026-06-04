param(
  [int]$Port = $(if ($env:TOTEM_PORT) { [int]$env:TOTEM_PORT } else { 8200 }),
  [int]$PollSec = $(if ($env:TOTEM_CHROME_KICK_POLL_SEC) { [int]$env:TOTEM_CHROME_KICK_POLL_SEC } else { 120 }),
  [int]$FailsBeforeKick = $(if ($env:TOTEM_CHROME_KICK_FAILS) { [int]$env:TOTEM_CHROME_KICK_FAILS } else { 2 }),
  [string]$HostName = '127.0.0.1'
)

$ErrorActionPreference = 'SilentlyContinue'
$HealthScript = Join-Path $PSScriptRoot 'totem-http-health.ps1'
$failures = 0

function Test-TotemHttpHealthy {
  if (-not (Test-Path $HealthScript)) { return $false }
  & powershell -NoProfile -ExecutionPolicy Bypass -File $HealthScript -Port $Port -HostName $HostName
  return ($LASTEXITCODE -eq 0)
}

Write-Host "[Totem] Chrome kick - se HTTP :$Port fallisce $FailsBeforeKick volte, chiude Chrome (watchdog lo riapre)"

while ($true) {
  if (Test-TotemHttpHealthy) {
    $failures = 0
  } else {
    $failures += 1
    Write-Host "[Totem] $(Get-Date -Format 'HH:mm:ss') - HTTP KO ($failures/$FailsBeforeKick)"
    if ($failures -ge $FailsBeforeKick) {
      Write-Host "[Totem] Riavvio Chrome (taskkill) per uscire da pagina errore connessione"
      taskkill /IM chrome.exe /F 2>$null
      $failures = 0
      Start-Sleep -Seconds 8
    }
  }
  Start-Sleep -Seconds $PollSec
}
