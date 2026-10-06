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

:: Policy Chrome (utente). I flag --kiosk non bastano per DevTools / Incognito / download.
set "CHROME_POL=HKCU\SOFTWARE\Policies\Google\Chrome"
reg add "%CHROME_POL%" /v DeveloperToolsAvailability /t REG_DWORD /d 2 /f >nul 2>&1
reg add "%CHROME_POL%" /v IncognitoModeAvailability /t REG_DWORD /d 1 /f >nul 2>&1
reg add "%CHROME_POL%" /v BrowserAddPersonEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "%CHROME_POL%" /v BrowserGuestModeEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "%CHROME_POL%" /v BrowserSignin /t REG_DWORD /d 0 /f >nul 2>&1
reg add "%CHROME_POL%" /v SyncDisabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "%CHROME_POL%" /v PasswordManagerEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "%CHROME_POL%" /v AutofillAddressEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "%CHROME_POL%" /v AutofillCreditCardEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "%CHROME_POL%" /v TranslateEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "%CHROME_POL%" /v BookmarkBarEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "%CHROME_POL%" /v DefaultPopupsSetting /t REG_DWORD /d 2 /f >nul 2>&1
reg add "%CHROME_POL%" /v DefaultNotificationsSetting /t REG_DWORD /d 2 /f >nul 2>&1
reg add "%CHROME_POL%" /v DownloadRestrictions /t REG_DWORD /d 3 /f >nul 2>&1
reg add "%CHROME_POL%" /v AllowFileSelectionDialogs /t REG_DWORD /d 0 /f >nul 2>&1
reg add "%CHROME_POL%" /v PrintingEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "%CHROME_POL%" /v PromptForDownloadLocation /t REG_DWORD /d 0 /f >nul 2>&1
reg add "%CHROME_POL%" /v BackgroundModeEnabled /t REG_DWORD /d 0 /f >nul 2>&1

:: Whitelist URL: blocca ogni navigazione (anche dentro iframe annidati, es. player YouTube
:: incorporati nei siti news) tranne totem locale e siti mostrati in-app.
:: Verifica su chrome://policy dopo il riavvio di Chrome.
reg delete "%CHROME_POL%\URLBlocklist" /f >nul 2>&1
reg delete "%CHROME_POL%\URLAllowlist" /f >nul 2>&1
reg add "%CHROME_POL%\URLBlocklist" /v 1 /t REG_SZ /d "*" /f >nul 2>&1
set "CHROME_ALLOW=%CHROME_POL%\URLAllowlist"
:: Totem locale (ng serve 8200) + backend locale (config totem 127.0.0.1:3000)
reg add "%CHROME_ALLOW%" /v 1 /t REG_SZ /d "localhost:8200" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 2 /t REG_SZ /d "127.0.0.1:8200" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 3 /t REG_SZ /d "localhost:3000" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 4 /t REG_SZ /d "127.0.0.1:3000" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 5 /t REG_SZ /d "about:blank" /f >nul 2>&1
:: API + sito (sottodomini inclusi: api., prenota.)
reg add "%CHROME_ALLOW%" /v 10 /t REG_SZ /d "pizzerialalanterna.it" /f >nul 2>&1
:: Siti mostrati in iframe dalle pagine del totem
reg add "%CHROME_ALLOW%" /v 20 /t REG_SZ /d "castelraimondoturismo.it" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 21 /t REG_SZ /d "infioratadicastelraimondo.it" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 22 /t REG_SZ /d "comune.castelraimondo.mc.it" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 23 /t REG_SZ /d "cosmariambiente.it" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 24 /t REG_SZ /d "viverecamerino.it" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 25 /t REG_SZ /d "cronachemaceratesi.it" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 26 /t REG_SZ /d "picchionews.it" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 27 /t REG_SZ /d "ludwigstrasse.plateform.app" /f >nul 2>&1
:: Risorse tecniche usate dall'app (font, mappa, meteo, widget Elfsight)
reg add "%CHROME_ALLOW%" /v 40 /t REG_SZ /d "fonts.googleapis.com" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 41 /t REG_SZ /d "fonts.gstatic.com" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 42 /t REG_SZ /d "tile.openstreetmap.org" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 43 /t REG_SZ /d "unpkg.com" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 44 /t REG_SZ /d "api.open-meteo.com" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 45 /t REG_SZ /d "geocoding-api.open-meteo.com" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 46 /t REG_SZ /d "api.openweathermap.org" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 47 /t REG_SZ /d "elfsightcdn.com" /f >nul 2>&1
reg add "%CHROME_ALLOW%" /v 48 /t REG_SZ /d "elfsight.com" /f >nul 2>&1
reg query "%CHROME_POL%\URLBlocklist" >nul 2>&1
if errorlevel 1 echo [WARN] URLBlocklist non scritta — verifica permessi registro.
reg add "HKLM\SOFTWARE\Policies\Google\Chrome" /v DeveloperToolsAvailability /t REG_DWORD /d 2 /f >nul 2>&1
if errorlevel 1 echo [WARN] Policy Chrome HKLM — esegui come Amministratore per bloccare DevTools a livello macchina.

echo.
echo [OK] Policy applicate. Riavvia Explorer o fai logoff/logon se il comportamento non cambia subito.
echo.
pause
