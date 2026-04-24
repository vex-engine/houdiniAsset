@echo off
REM ===============================================================
REM  git_commit.bat - 변경사항 한 번에 커밋
REM  사용법 1: 더블클릭 후 메시지 입력
REM  사용법 2: cmd 에서  git_commit.bat "메시지"  (추천)
REM ===============================================================
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0.."

echo.
echo ==================================================
echo  변경된 파일:
echo ==================================================
git status --short
echo.

REM 파라미터로 메시지 받았으면 그거 사용
set "MSG=%~1"

if "%MSG%"=="" (
  echo 커밋 메시지를 입력하세요 ^(공백 가능, 엔터=취소^):
  set /p "MSG=> "
)

if "!MSG!"=="" (
  echo 취소됨 - 메시지 없음.
  pause
  exit /b 0
)

git add .
git commit -m "!MSG!"

if errorlevel 1 (
  echo.
  echo [ERROR] 커밋 실패.
  pause
  exit /b 1
)

echo.
echo [OK] 커밋 완료:
git log --oneline -3
echo.
pause
