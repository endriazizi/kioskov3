@echo off
setlocal EnableExtensions
title ENEA Totem Kiosk (porta 8200)

cd /d "%~dp0"
set "SCRIPT_DIR=%~dp0"
set "REPO_KIOSK=%SCRIPT_DIR%..\.."

if not defined TOTEM_URL set "TOTEM_URL=http://127.0.0.1:8200/tutorial"
if not defined TOTEM_PORT set "TOTEM_PORT=8200"

echo ==========================================================
echo  ENEA Totem - Chrome kiosk (kioskov3 / totemProdProxy)
echo  Dev server atteso: http://localhost:%TOTEM_PORT%/
echo  URL kiosk: %TOTEM_URL%
if "%TOTEM_AUTO_DEV_SERVER%"=="1" (
  echo  Watchdog ng serve: ATTIVO ^(poll porta %TOTEM_PORT%^)
) else (
  echo  Watchdog ng serve: off - usa start-totem-stack.bat per auto-avvio
)
echo  Uscita staff: Ctrl+Alt+Del oppure exit-kiosk-admin.bat
echo ==========================================================
echo.

if "%TOTEM_AUTO_DEV_SERVER%"=="1" (
  echo [Totem] Avvio watchdog dev server in finestra separata...
  start "TotemDevWatch" powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%watch-totem-dev-server.ps1" -Port %TOTEM_PORT%
  timeout /t 2 /nobreak >nul
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%wait-totem-port.ps1" -Port %TOTEM_PORT% -TimeoutSec 300
if errorlevel 1 (
  if "%TOTEM_AUTO_DEV_SERVER%"=="1" (
    echo [Totem] Attendo ancora il dev server avviato dal watchdog...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%wait-totem-port.ps1" -Port %TOTEM_PORT% -TimeoutSec 300
  )
)
if errorlevel 1 (
  echo.
  echo Avvia in un altro terminale (VS Code^) oppure:
  echo   set TOTEM_AUTO_DEV_SERVER=1
  echo   scripts\totem-windows\start-totem-stack.bat
  echo   cd kioskov3
  echo   npm run start:totem:prodproxy
  echo.
  pause
  exit /b 1
)

if not defined TOTEM_CHROME_KICK set "TOTEM_CHROME_KICK=1"
if "%TOTEM_CHROME_KICK%"=="1" (
  echo [Totem] Watchdog Chrome kick - chiude Chrome se :%TOTEM_PORT% non risponde HTTP
  start "TotemChromeKick" powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%watch-totem-chrome-kick.ps1" -Port %TOTEM_PORT%
)

:watchdog
call "%SCRIPT_DIR%03-start-chrome-kiosk.bat"
echo.
echo [Totem] Chrome chiuso - riavvio tra 3 secondi (watchdog). CTRL+C per fermare.
timeout /t 3 /nobreak >nul
goto watchdog
