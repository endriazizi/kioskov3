@echo off
setlocal EnableExtensions
:: Chiude solo il Chrome del totem (user-data-dir ENEATotemChrome).
:: TOTEM_KILL_ALL_CHROME=1 → termina ogni chrome.exe (account Totem dedicato).

if not defined TOTEM_CHROME_DATA set "TOTEM_CHROME_DATA=%LOCALAPPDATA%\ENEATotemChrome"

if "%TOTEM_KILL_ALL_CHROME%"=="1" (
  taskkill /IM chrome.exe /F >nul 2>&1
  goto :eof
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$m='ENEATotemChrome'; Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -like ('*'+$m+'*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

if exist "%TOTEM_CHROME_DATA%\SingletonLock" del /f /q "%TOTEM_CHROME_DATA%\SingletonLock" >nul 2>&1
if exist "%TOTEM_CHROME_DATA%\SingletonCookie" del /f /q "%TOTEM_CHROME_DATA%\SingletonCookie" >nul 2>&1
if exist "%TOTEM_CHROME_DATA%\SingletonSocket" del /f /q "%TOTEM_CHROME_DATA%\SingletonSocket" >nul 2>&1
exit /b 0
