@echo off
setlocal EnableExtensions
rem Stack completo totem: watchdog ng serve (8200) + Chrome kiosk
set "TOTEM_AUTO_DEV_SERVER=1"
call "%~dp0start-totem-kiosk.bat"
exit /b %ERRORLEVEL%
