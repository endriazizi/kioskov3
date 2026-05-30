@echo off
setlocal EnableExtensions
title ENEA Totem Kiosk (porta 8200)

cd /d "%~dp0"
set "SCRIPT_DIR=%~dp0"
set "REPO_KIOSK=%SCRIPT_DIR%..\.."

if not defined TOTEM_URL set "TOTEM_URL=http://127.0.0.1:8200/tutorial"
if not defined TOTEM_PORT set "TOTEM_PORT=8200"

echo ==========================================================
echo  ENEA Totem — Chrome kiosk (kioskov3 / totemProdProxy)
echo  Dev server atteso: http://localhost:%TOTEM_PORT%/
echo  URL kiosk: %TOTEM_URL%
echo  Uscita staff: Ctrl+Alt+Del oppure exit-kiosk-admin.bat
echo ==========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%wait-totem-port.ps1" -Port %TOTEM_PORT%
if errorlevel 1 (
  echo.
  echo Avvia in un altro terminale (VS Code):
  echo   cd kioskov3
  echo   npm run start:totem:prodproxy
  echo.
  pause
  exit /b 1
)

:watchdog
call "%SCRIPT_DIR%03-start-chrome-kiosk.bat"
echo.
echo [Totem] Chrome chiuso — riavvio tra 3 secondi (watchdog). CTRL+C per fermare.
timeout /t 3 /nobreak >nul
goto watchdog
