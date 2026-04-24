@echo off
chcp 65001 >nul
cd /d "%~dp0"
title HTML Presentation Server

echo.
echo  ==========================================
echo   HTML Presentation - Save/Export Server
echo  ==========================================
echo.

echo  [1/3] Release ports 3000 / 3001 if occupied...
for %%P in (3000 3001) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    echo        - killing PID %%A on port %%P
    taskkill /F /PID %%A >nul 2>&1
  )
)

ping -n 1 -w 500 127.0.0.1 >nul

echo  [2/3] Starting server...
echo.
echo   Static Server : http://localhost:3000
echo   Save API      : http://localhost:3001
echo.
echo   Close window to stop. Running bat again replaces previous server.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000/"

echo  [3/3] Node running...
"C:\Program Files\nodejs\node.exe" save-server.js
echo.
echo  === Server stopped ===
pause
