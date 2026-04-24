@echo off
REM ===============================================================
REM  git_init.bat - PPTX 프로젝트 Git 저장소 최초 1회 초기화
REM  사용법: F:\Claude\PPTX\scripts\git_init.bat 더블클릭
REM ===============================================================
chcp 65001 >nul
cd /d "%~dp0.."

echo.
echo ==================================================
echo  PPTX Git 저장소 초기화 (v1.3.0 baseline)
echo ==================================================
echo.

REM 0. Git 설치 확인
where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git 이 설치되어 있지 않습니다.
  echo         https://git-scm.com/download/win  에서 설치 후 다시 실행하세요.
  pause
  exit /b 1
)

REM 1. 기존 .git 폴더 있으면 제거 (초기화 실패 잔재)
if exist .git (
  echo [INFO] 기존 .git 폴더 발견 - 제거합니다.
  rmdir /S /Q .git
)

REM 2. git init
echo [1/5] git init...
git init -b main
if errorlevel 1 goto err

REM 3. 사용자 설정 (이 레포에만 적용)
echo [2/5] 사용자 정보 설정...
git config user.name "hyung"
git config user.email "threedz3dz@gmail.com"
git config core.quotepath false
git config core.autocrlf true
git config core.precomposeunicode true

REM 4. 첫 커밋 대상 스테이징
echo [3/5] 파일 스테이징...
git add .
if errorlevel 1 goto err

REM 5. 첫 커밋
echo [4/5] 첫 커밋 생성...
git commit -m "chore: v1.3.0 baseline - editor.js 4-file split complete"
if errorlevel 1 goto err

REM 6. 태그
echo [5/5] v1.3.0 태그 생성...
git tag -a v1.3.0 -m "Engine split release: editor.js into 4 files (core/block/io/main)"

echo.
echo ==================================================
echo  [OK] Git 저장소 초기화 완료!
echo ==================================================
echo.
echo  현재 상태 확인:
git log --oneline -5
echo.
git tag
echo.
echo  이제 일상 사용법:
echo    1) 뭔가 바꾼 뒤: git add . ^&^& git commit -m "설명"
echo    2) 히스토리 보기: git log --oneline
echo    3) 방금 커밋 취소: git reset --hard HEAD~1
echo.
pause
exit /b 0

:err
echo.
echo [ERROR] 초기화 중 오류 발생. 위 메시지를 확인하세요.
pause
exit /b 1
