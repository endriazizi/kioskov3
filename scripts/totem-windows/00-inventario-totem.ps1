<#
  ENEA Totem - inventario in sola lettura.
  Non modifica nulla: stampa edizione e build di Windows, Chrome, account, autologon,
  policy Chrome effettive, Assigned Access, alimentazione e porte. Nessun segreto in output.

  Uso (PowerShell come amministratore, per leggere tutte le chiavi):
    powershell -NoProfile -ExecutionPolicy Bypass -File .\00-inventario-totem.ps1 > inventario.txt
#>
$ErrorActionPreference = 'SilentlyContinue'

function Section($t) { Write-Output ''; Write-Output "=== $t ===" }

Section 'Windows'
$cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
Write-Output ("Edizione: {0}" -f $cv.EditionID)
Write-Output ("Prodotto: {0}" -f $cv.ProductName)
Write-Output ("Versione: {0}  Build: {1}.{2}" -f $cv.DisplayVersion, $cv.CurrentBuild, $cv.UBR)
Write-Output ("Architettura: {0}" -f $env:PROCESSOR_ARCHITECTURE)
Write-Output ("Secure Boot: {0}" -f (Confirm-SecureBootUEFI))
$bl = Get-BitLockerVolume -MountPoint $env:SystemDrive
if ($bl) { Write-Output ("BitLocker {0}: {1}" -f $env:SystemDrive, $bl.ProtectionStatus) } else { Write-Output 'BitLocker: non disponibile o non leggibile' }

Section 'Chrome'
foreach ($p in @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe")) {
  if (Test-Path $p) { Write-Output ("{0}  versione {1}" -f $p, (Get-Item $p).VersionInfo.ProductVersion) }
}
Write-Output 'Policy Google Update (HKLM\SOFTWARE\Policies\Google\Update):'
Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Google\Update' | Select-Object * -ExcludeProperty PS* | Format-List | Out-String | Write-Output

Section 'Account locali'
Get-LocalUser | Select-Object Name, Enabled, LastLogon, PasswordRequired | Format-Table -AutoSize | Out-String | Write-Output
Write-Output 'Membri del gruppo Administrators:'
Get-LocalGroupMember -SID 'S-1-5-32-544' | Select-Object Name, ObjectClass | Format-Table -AutoSize | Out-String | Write-Output

Section 'Autologon'
$wl = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
Write-Output ("AutoAdminLogon: {0}  DefaultUserName: {1}" -f $wl.AutoAdminLogon, $wl.DefaultUserName)
Write-Output ("Password in chiaro nel registro (DefaultPassword presente): {0}" -f [bool]($wl.PSObject.Properties.Name -contains 'DefaultPassword'))

Section 'Assigned Access / Shell Launcher'
$aa = Get-CimInstance -Namespace 'root\cimv2\mdm\dmmap' -ClassName 'MDM_AssignedAccess'
if ($aa) { Write-Output ("MDM_AssignedAccess disponibile. Configurazione presente: {0}" -f [bool]$aa.Configuration) } else { Write-Output 'MDM_AssignedAccess non leggibile (serve SYSTEM) o non disponibile' }
$sl = Get-WindowsOptionalFeature -Online -FeatureName 'Client-EmbeddedShellLauncher'
if ($sl) { Write-Output ("Shell Launcher: {0}" -f $sl.State) } else { Write-Output 'Shell Launcher: non disponibile in questa edizione' }
$kf = Get-WindowsOptionalFeature -Online -FeatureName 'Client-KeyboardFilter'
if ($kf) { Write-Output ("Keyboard Filter: {0}" -f $kf.State) } else { Write-Output 'Keyboard Filter: non disponibile in questa edizione' }
Write-Output ("Shell corrente (Winlogon\Shell): {0}" -f $wl.Shell)

Section 'Policy Chrome effettive'
foreach ($root in 'HKLM:\SOFTWARE\Policies\Google\Chrome', 'HKCU:\SOFTWARE\Policies\Google\Chrome') {
  Write-Output "[$root]"
  if (Test-Path $root) {
    Get-ItemProperty $root | Select-Object * -ExcludeProperty PS* | Format-List | Out-String | Write-Output
    foreach ($sub in 'URLAllowlist', 'URLBlocklist') {
      if (Test-Path "$root\$sub") {
        Write-Output "  $sub"
        (Get-ItemProperty "$root\$sub" | Select-Object * -ExcludeProperty PS*).PSObject.Properties | ForEach-Object { Write-Output ("    {0} = {1}" -f $_.Name, $_.Value) }
      }
    }
  } else { Write-Output '  (assente)' }
}
Write-Output 'Nota: se le policy sono solo in HKCU, valgono per l''utente che ha eseguito lo script, non per gli altri.'

Section 'Policy Windows utili'
Write-Output ("AllowEdgeSwipe (HKLM): {0}" -f (Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\EdgeUI').AllowEdgeSwipe)
Write-Output ("Deny removable storage (HKLM): {0}" -f (Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices').Deny_All)
Write-Output ("Task Manager disattivato (HKCU): {0}" -f (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System').DisableTaskMgr)

Section 'Alimentazione'
powercfg /getactivescheme
powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE | Select-String 'Current AC Power Setting Index'
powercfg /a

Section 'Attivita pianificate del totem'
Get-ScheduledTask | Where-Object { $_.TaskName -match 'totem|kiosk|chrome' } | Select-Object TaskName, State, @{n='Utente';e={$_.Principal.UserId}} | Format-Table -AutoSize | Out-String | Write-Output

Section 'Processi del totem'
Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'chrome|node|powershell|cmd' } |
  Select-Object Name, ProcessId, @{n='Sessione';e={$_.SessionId}} | Format-Table -AutoSize | Out-String | Write-Output

Section 'Dispositivi di input e USB'
Get-PnpDevice -PresentOnly -Class Keyboard, Mouse, HIDClass | Select-Object Class, FriendlyName, Status | Format-Table -AutoSize | Out-String | Write-Output
Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -match 'touch' } | Select-Object FriendlyName, Status | Format-Table -AutoSize | Out-String | Write-Output

Section 'Schermi'
Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorBasicDisplayParams | ForEach-Object {
  $d = [math]::Round([math]::Sqrt([math]::Pow($_.MaxHorizontalImageSize, 2) + [math]::Pow($_.MaxVerticalImageSize, 2)) / 2.54, 1)
  Write-Output ("Diagonale stimata: {0} pollici" -f $d)
}
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::AllScreens | ForEach-Object { Write-Output ("Risoluzione: {0}x{1}  primario: {2}" -f $_.Bounds.Width, $_.Bounds.Height, $_.Primary) }

Write-Output ''
Write-Output 'Fine inventario. Nessuna impostazione e stata modificata.'
