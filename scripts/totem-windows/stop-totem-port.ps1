param(
  [int]$Port = $(if ($env:TOTEM_PORT) { [int]$env:TOTEM_PORT } else { 8200 })
)

$ErrorActionPreference = 'SilentlyContinue'
$pids = New-Object System.Collections.Generic.HashSet[int]

try {
  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
  foreach ($c in $conns) {
    if ($c.OwningProcess -gt 0) { [void]$pids.Add($c.OwningProcess) }
  }
} catch {
  $pattern = ":$Port\s"
  netstat -ano | ForEach-Object {
    $line = $_.ToString().Trim()
    if ($line -notmatch 'LISTENING') { return }
    if ($line -notmatch $pattern) { return }
    $parts = $line -split '\s+'
    $procId = [int]$parts[-1]
    if ($procId -gt 0) { [void]$pids.Add($procId) }
  }
}

if ($pids.Count -eq 0) {
  Write-Host "[Totem] Nessun processo in ascolto su porta $Port"
  exit 0
}

foreach ($procId in $pids) {
  Write-Host "[Totem] Termino PID $procId (porta $Port)"
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2
exit 0
