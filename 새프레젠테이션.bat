@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
  ) else (
    echo.
    echo  ! Node.js를 찾을 수 없습니다.
    echo    Node.js 설치 후 다시 실행하거나 PATH를 확인하세요.
    echo.
    pause
    exit /b 1
  )
)
echo.
echo  ==========================================
echo   새 프레젠테이션 브리프 생성
echo  ==========================================
echo.
"%NODE_EXE%" new-presentation.js
if errorlevel 1 (
  echo.
  echo  ! 새 프레젠테이션 브리프 생성 중 오류가 발생했습니다.
)
echo.
pause
