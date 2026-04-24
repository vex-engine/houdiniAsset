#!/usr/bin/env bash
# ============================================================
# verify_engine.sh — 엔진 + HTML 통합 무결성 검사
# 변경 후 무조건 실행. 30초 안전망.
# 사용법: bash scripts/verify_engine.sh
# ============================================================
set -e
cd "$(dirname "$0")/.."

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'; NC='\033[0m'
fail=0

echo "=========================================="
echo " ENGINE INTEGRITY CHECK"
echo "=========================================="

# --- 1. JS 파일 UTF-8 + 문법 ---
echo ""
echo "▶ 1/3  JS 파일 UTF-8 + 문법 검사"
for f in engine/editor/editor.core.js engine/editor/editor.block.js engine/editor/editor.io.js engine/editor/editor.main.js engine/panel-context.js engine/presentation.js; do
  if [ ! -f "$f" ]; then
    echo -e "  ${RED}❌${NC} $f — 파일 없음"
    fail=1; continue
  fi
  printf "  "
  if ! iconv -f UTF-8 -t UTF-8 "$f" >/dev/null 2>&1; then
    echo -e "${RED}❌ UTF-8${NC}  $f"
    fail=1; continue
  fi
  cp "$f" /tmp/__verify_chk.js
  if ! node --check /tmp/__verify_chk.js >/dev/null 2>&1; then
    err=$(node --check /tmp/__verify_chk.js 2>&1 | head -3 | tr '\n' ' ')
    echo -e "${RED}❌ 문법${NC}  $f"
    echo "      $err"
    fail=1; continue
  fi
  lines=$(wc -l < "$f")
  size=$(stat -c%s "$f")
  echo -e "${GRN}✅${NC}  $f  (${lines} lines, ${size} bytes)"
done
rm -f /tmp/__verify_chk.js

# --- 2. CSS UTF-8 ---
echo ""
echo "▶ 2/3  CSS UTF-8 검사"
for f in engine/engine.css; do
  printf "  "
  if iconv -f UTF-8 -t UTF-8 "$f" >/dev/null 2>&1; then
    lines=$(wc -l < "$f")
    echo -e "${GRN}✅${NC}  $f  (${lines} lines)"
  else
    echo -e "${RED}❌ UTF-8${NC}  $f"
    fail=1
  fi
done

# --- 3. HTML 파일 무결성 ---
echo ""
echo "▶ 3/3  HTML 무결성 검사 (잘림/script 누락 감지)"
while IFS= read -r f; do
  case "$f" in
    *.bak*|*backup*|*origin*) continue ;;
  esac
  printf "  "
  if ! iconv -f UTF-8 -t UTF-8 "$f" >/dev/null 2>&1; then
    echo -e "${RED}❌ UTF-8${NC}  $f"
    fail=1; continue
  fi
  tail_chunk=$(tail -c 200 "$f")
  if ! echo "$tail_chunk" | grep -q '</html>'; then
    echo -e "${RED}❌ 잘림${NC}  $f"
    echo "      마지막: ...$(echo "$tail_chunk" | tail -c 60)"
    fail=1; continue
  fi
  has_inline_engine=$(grep -c 'PRESENTATION ENGINE\|window.EA\s*=' "$f" 2>/dev/null || echo 0)
  if [ "$has_inline_engine" = "0" ]; then
    missing=""
    for js in presentation.js panel-context.js editor.core.js editor.block.js editor.io.js editor.main.js; do
      grep -q "$js" "$f" || missing="$missing $js"
    done
    if [ -n "$missing" ]; then
      echo -e "${YLW}⚠ 엔진 누락${NC}  $f → $missing"
      fail=1; continue
    fi
  fi
  echo -e "${GRN}✅${NC}  $f"
done < <(find presentations engine samples -name "*.html" -type f 2>/dev/null)

# --- 결과 ---
echo ""
echo "=========================================="
if [ "$fail" = "0" ]; then
  echo -e " ${GRN}✅ ALL GREEN — 안전하게 진행${NC}"
  exit 0
else
  echo -e " ${RED}❌ FAIL — 위 항목 수정 필요${NC}"
  exit 1
fi
