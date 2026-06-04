param(
  [int]$Port = $(if ($env:TOTEM_PORT) { [int]$env:TOTEM_PORT } else { 8200 }),
  [int]$TimeoutSec = 180,
  [string]$HostName = '127.0.0.1'
)

$deadline = (Get-Date).AddSeconds($TimeoutSec)
Write-Host "[Totem] Attendo http://${HostName}:${Port}/ ..."

while ((Get-Date) -lt $deadline) {
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect($HostName, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(800, $false)
    if ($ok -and $tcp.Connected) {
      $tcp.EndConnect($iar)
      $tcp.Close()
      Write-Host "[Totem] Porta $Port raggiungibile."
      exit 0
    }
    $tcp.Close()
  } catch {
    # dev server non ancora in ascolto
  }
  Start-Sleep -Milliseconds 500
}

Write-Host "[ERR] Timeout ${TimeoutSec}s - avvia prima: cd kioskov3; npm run start:totem:prodproxy"
Write-Host "[ERR] Oppure: npm run kiosk:windows:stack"
exit 1
