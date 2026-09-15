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
reg add "HKLM\SOFTWARE\Policies\Google\Chrome" /v DeveloperToolsAvailability /t REG_DWORD /d 2 /f >nul 2>&1
if errorlevel 1 echo [WARN] Policy Chrome HKLM — esegui come Amministratore per bloccare DevTools a livello macchina.

echo.
echo [OK] Policy applicate. Riavvia Explorer o fai logoff/logon se il comportamento non cambia subito.
echo.
pause
