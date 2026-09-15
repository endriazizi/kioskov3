@echo off
setlocal EnableExtensions
:: Totem: Chrome in --kiosk vero (processo isolato).
:: Buco classico: se esiste già un Chrome, `chrome --kiosk URL` apre solo una tab
:: e F11/Alt+Tab restano usabili. Si evita con --user-data-dir dedicato.

if not defined TOTEM_URL set "TOTEM_URL=http://127.0.0.1:8200/tutorial"
if not defined TOTEM_CHROME set "TOTEM_CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%TOTEM_CHROME%" set "TOTEM_CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%TOTEM_CHROME%" (
  echo [ERR] Chrome non trovato. Imposta TOTEM_CHROME=percorso\chrome.exe
  exit /b 1
)
if not defined TOTEM_CHROME_DATA set "TOTEM_CHROME_DATA=%LOCALAPPDATA%\ENEATotemChrome"
if not exist "%TOTEM_CHROME_DATA%" mkdir "%TOTEM_CHROME_DATA%" >nul 2>&1

call "%~dp0kill-totem-chrome.bat"
timeout /t 2 /nobreak >nul

echo [Totem] Chrome kiosk → %TOTEM_URL%
echo [Totem] Profilo isolato → %TOTEM_CHROME_DATA%

:: Niente --start-fullscreen: con --kiosk è ridondante e F11 può uscire dal FS.
:: Niente profilo default: estensioni / account Google / session restore = vie d'uscita.
start "" "%TOTEM_CHROME%" ^
  --kiosk "%TOTEM_URL%" ^
  --user-data-dir="%TOTEM_CHROME_DATA%" ^
  --no-first-run ^
  --no-default-browser-check ^
  --noerrdialogs ^
  --disable-infobars ^
  --hide-crash-restore-bubble ^
  --disable-session-crashed-bubble ^
  --disable-restore-session-state ^
  --overscroll-history-navigation=0 ^
  --disable-pinch ^
  --disable-translate ^
  --disable-sync ^
  --disable-extensions ^
  --disable-component-extensions-with-background-pages ^
  --disable-component-update ^
  --disable-background-networking ^
  --disable-background-mode ^
  --disable-default-apps ^
  --disable-domain-reliability ^
  --disable-client-side-phishing-detection ^
  --disable-hang-monitor ^
  --disable-prompt-on-repost ^
  --disable-save-password-bubble ^
  --disable-notifications ^
  --disable-renderer-backgrounding ^
  --disable-backgrounding-occluded-windows ^
  --metrics-recording-only ^
  --no-service-autorun ^
  --check-for-update-interval=31536000 ^
  --password-store=basic ^
  --autoplay-policy=no-user-gesture-required ^
  --disable-features=TranslateUI,Translate,HardwareMediaKeyHandling,ExtensionsToolbarMenu,MediaRouter,DialMediaRouteProvider,OverscrollHistoryNavigation,TouchpadOverscrollHistoryNavigation,InfiniteSessionRestore,GlobalMediaControls,PasswordManagerOnboarding,AutofillServerCommunication,InterestFeedContentSuggestions,DownloadBubble,DownloadBubbleV2

timeout /t 2 /nobreak >nul
tasklist /FI "IMAGENAME eq chrome.exe" | find /I "chrome.exe" >nul
if errorlevel 1 (
  echo [ERR] Chrome non e' partito. Controlla TOTEM_CHROME e i log Windows.
  exit /b 1
)

exit /b 0
