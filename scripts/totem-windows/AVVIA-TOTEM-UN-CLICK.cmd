@echo off
setlocal EnableExtensions
title ENEA Totem - Avvio con un clic
cd /d "%~dp0..\.."
if not exist "package.json" (
 echo [ERRORE] Cartella kioskov3 non trovata.
 pause
 exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
 echo [ERRORE] Installa Node.js e riapri il file.
 pause
 exit /b 1
)
if not exist "node_modules\@angular\cli\bin\ng.js" (
 echo [ERRORE] Dipendenze mancanti: esegui npm ci nella cartella kioskov3.
 pause
 exit /b 1
)
set "TOTEM_AUTO_DEV_SERVER=1"
call "scripts\totem-windows\start-totem-stack.bat"
if errorlevel 1 pause
exit /b %ERRORLEVEL%
