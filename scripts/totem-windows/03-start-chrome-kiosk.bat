@echo off
setlocal EnableExtensions

if not defined TOTEM_URL set "TOTEM_URL=http://127.0.0.1:8200/tutorial"
if not defined TOTEM_CHROME set "TOTEM_CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%TOTEM_CHROME%" set "TOTEM_CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%TOTEM_CHROME%" (
  echo [ERR] Chrome non trovato. Imposta TOTEM_CHROME=percorso\chrome.exe
  exit /b 1
)

taskkill /IM chrome.exe /F >nul 2>&1
timeout /t 1 /nobreak >nul

echo [Totem] Chrome kiosk → %TOTEM_URL%

start "" "%TOTEM_CHROME%" --kiosk "%TOTEM_URL%" ^
  --no-first-run ^
  --disable-infobars ^
  --overscroll-history-navigation=0 ^
  --disable-pinch ^
  --disable-session-crashed-bubble ^
  --noerrdialogs ^
  --no-default-browser-check ^
  --disable-translate ^
  --disable-component-update ^
  --disable-prompt-on-repost ^
  --disable-save-password-bubble ^
  --disable-restore-session-state ^
  --disable-features=TranslateUI,HardwareMediaKeyHandling,ExtensionsToolbarMenu ^
  --autoplay-policy=no-user-gesture-required ^
  --start-fullscreen ^
  --disable-background-networking

exit /b 0
