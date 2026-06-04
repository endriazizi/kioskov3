param(
  [int]$Port = $(if ($env:TOTEM_PORT) { [int]$env:TOTEM_PORT } else { 8200 }),
  [string]$HostName = '127.0.0.1',
  [int]$TimeoutSec = 8
)

$uri = "http://${HostName}:${Port}/"
try {
  $r = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec $TimeoutSec -Method Get
  if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 }
  exit 1
} catch {
  exit 1
}
