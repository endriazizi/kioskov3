@echo off
:: Richiede Esegui come amministratore (HKLM + alcune HKCU machine-wide)
title ENEA Totem — install policy Windows
echo.
echo [Totem] Installazione policy kiosk (notifiche, edge swipe, taskbar)...
echo.

reg add "HKCU\Software\Policies\Microsoft\Windows\Explorer" /v DisableNotificationCenter /t REG_DWORD /d 1 /f
if errorlevel 1 (
  echo [WARN] DisableNotificationCenter — verifica permessi utente.
)

reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\EdgeUI" /v AllowEdgeSwipe /t REG_DWORD /d 0 /f
if errorlevel 1 (
  echo [ERR] AllowEdgeSwipe HKLM — esegui questo file come Amministratore.
  pause
  exit /b 1
)

:: Nasconde pulsante Task View (Win+Tab) su alcune build
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v ShowTaskViewButton /t REG_DWORD /d 0 /f >nul 2>&1

:: Disabilita suggerimenti/notifiche lock (best-effort)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" /v SubscribedContent-338389Enabled /t REG_DWORD /d 0 /f >nul 2>&1

echo.
echo [OK] Policy applicate. Riavvia Explorer o fai logoff/logon se il comportamento non cambia subito.
echo.
pause
