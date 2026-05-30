@echo off
title ENEA Totem — ripristino policy Windows
echo [Totem] Rimozione policy kiosk...
reg delete "HKCU\Software\Policies\Microsoft\Windows\Explorer" /v DisableNotificationCenter /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\EdgeUI" /v AllowEdgeSwipe /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v ShowTaskViewButton /t REG_DWORD /d 1 /f >nul 2>&1
echo [OK] Ripristino completato (valori default dove possibile).
pause
