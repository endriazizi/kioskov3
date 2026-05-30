@echo off
title ENEA Totem — uscita staff
echo [Totem] Chiusura Chrome...
taskkill /IM chrome.exe /F >nul 2>&1
echo [OK] Chrome terminato. Il watchdog in start-totem-kiosk.bat va interrotto con CTRL+C nel suo terminale.
pause
