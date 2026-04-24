@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ==========================================
echo   새 프레젠테이션 브리프 생성
echo  ==========================================
echo.
"C:\Program Files\nodejs\node.exe" new-presentation.js
echo.
pause
