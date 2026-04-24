#!/usr/bin/env bash
# ============================================================
# verify_html.sh — HTML 파일 무결성 검증
# 사용법: scripts/verify_html.sh
# 목적:
#   1. PPTX deck HTML 파일들의 script 연결 / 종료 태그 / NUL 바이트 검증
#   2. Edit 툴 사고로 파일이 잘리는 패턴을 조기 감지
#   3. panel-context.js / presentation.js / editor.js 연결 상태 확인
# ============================================================

cd "$(dirname "$0")/.."

FILES=$(find engine presentations -maxdepth 3 -name "*.html" ! -name "*.bak*" ! -path "*/backup/*" 2>/dev/null | sort)

RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'; NC='\033[0m'
FAIL=0
WARN=0

echo "=== PPTX HTML 검증 ==="
echo ""
printf "%-75s | %3s | %3s | %3s | %3s | %4s | %s\n" "파일" "NUL" "PRE" "PCX" "EDT" "</h>" "상태"
echo "--------------------------------------------------------------------------------------------------------------"

for f in $FILES; do
  nul=$(python3 -c "import sys; print(open(sys.argv[1],'rb').read().count(b'\x00'))" "$f" 2>/dev/null || echo "?")

  # presentation 로드 여부: src 참조 또는 인라인 (PRESENTATION ENGINE 주석 또는 function goStep 존재)
  if grep -qE 'script src=.*presentation\.js' "$f" 2>/dev/null || grep -qE 'PRESENTATION ENGINE|function goStep' "$f" 2>/dev/null; then pre=1; else pre=0; fi
  # panel-context 로드 여부
  if grep -qE 'script src=.*panel-context\.js' "$f" 2>/dev/null || grep -qE 'window\.PanelCtx' "$f" 2>/dev/null; then pcx=1; else pcx=0; fi
  # editor 로드 여부
  if grep -qE 'script src=.*editor\.js' "$f" 2>/dev/null || grep -qE 'EA\.toggle|window\.EA' "$f" 2>/dev/null; then edt=1; else edt=0; fi
  # </html> 존재
  if grep -qE '</html>' "$f" 2>/dev/null; then closed=1; else closed=0; fi

  status=""
  issues=""

  if [[ "$nul" != "0" ]]; then issues="${issues}NUL바이트,"; fi
  if [[ "$pre" == "0" ]]; then issues="${issues}presentation누락,"; fi
  if [[ "$closed" == "0" ]]; then issues="${issues}</html>없음,"; fi

  warns=""
  if [[ "$pcx" == "0" ]]; then warns="${warns}panel-context누락,"; fi
  if [[ "$edt" == "0" ]]; then warns="${warns}editor누락,"; fi

  if [[ -n "$issues" ]]; then
    status="${RED}FAIL${NC}"
    FAIL=1
  elif [[ -n "$warns" ]]; then
    status="${YELLOW}WARN${NC}"
    WARN=1
  else
    status="${GREEN}OK${NC}"
  fi

  # 짧은 상대경로 표시
  short="$f"
  printf "%-75s | %3s | %3s | %3s | %3s | %4s | %b" "$short" "$nul" "$pre" "$pcx" "$edt" "$closed" "$status"
  if [[ -n "$issues" ]] || [[ -n "$warns" ]]; then
    printf " (%s)" "${issues}${warns%,}"
  fi
  printf "\n"
done

echo ""
echo "범례: NUL=NUL바이트 / PRE=presentation / PCX=panel-context / EDT=editor (1=로드됨, 0=없음)"
echo "     인라인 임베드도 포함해서 감지 (src + 주석/심볼)"
echo ""
if [[ $FAIL -eq 1 ]]; then
  printf "${RED}✗ 검증 실패 — FAIL 항목 고쳐야 함${NC}\n"
  exit 1
elif [[ $WARN -eq 1 ]]; then
  printf "${YELLOW}△ 경고 있음 — panel-context/editor 누락 파일 검토 필요${NC}\n"
  exit 0
else
  printf "${GREEN}✓ 모든 HTML 검증 통과${NC}\n"
  exit 0
fi
