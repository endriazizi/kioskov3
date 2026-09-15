@echo off
title ENEA Totem — uscita staff
echo [Totem] Chiusura Chrome totem...
call "%~dp0kill-totem-chrome.bat"
echo [OK] Chrome totem terminato. Il watchdog in start-totem-kiosk.bat va interrotto con CTRL+C nel suo terminale.
pause
