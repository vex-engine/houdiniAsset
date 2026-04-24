@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo.
echo 주의: 마지막 커밋 + 그 변경사항 전부 날립니다.
echo.
git log --oneline -3
echo.
set /p CONFIRM="정말 되돌릴까요? (y/n): "
if /I not "%CONFIRM%"=="y" (
  echo 취소됨.
  pause
  exit /b 0
)

git reset --hard HEAD~1
echo.
echo [OK] 되돌림 완료.
git log --oneline -3
pause
