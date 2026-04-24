#!/usr/bin/env bash
# ============================================================
# rollback_split.sh — editor.js 분할을 되돌림 (pre-split 상태 복원)
# 사용법: bash scripts/rollback_split.sh
# ------------------------------------------------------------
# 하는 일:
#  1) engine/editor.js.before_split.bak  →  engine/editor.js 로 복원
#  2) engine/editor/ 하위 파일들 제거 (혹은 _rolledback 으로 rename)
#  3) 모든 HTML 의 <script src=".../editor/editor.*.js"> 4줄을
#     <script src=".../editor.js"> 1줄로 되돌림
#  4) scripts/verify_engine.sh 를 pre-split 버전(_milestones) 에서 복원
#  5) verify_engine.sh 로 ALL GREEN 확인
# ============================================================
set -e
cd "$(dirname "$0")/.."

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'; NC='\033[0m'

echo -e "${YLW}▶ editor.js 분할 롤백 시작${NC}"

# 1. editor.js 복원
if [ ! -f engine/editor.js.before_split.bak ]; then
  echo -e "${RED}❌ engine/editor.js.before_split.bak 없음 — 롤백 불가${NC}"
  exit 1
fi
cp engine/editor.js.before_split.bak engine/editor.js
echo -e "  ${GRN}✅${NC} engine/editor.js 복원 (128,391 bytes 예상)"

# 2. engine/editor/ 디렉토리 → _rolledback 으로 rename (삭제 대신)
if [ -d engine/editor ]; then
  TS=$(date +%Y%m%d_%H%M%S)
  mv engine/editor "engine/_editor_rolledback_$TS"
  echo -e "  ${GRN}✅${NC} engine/editor/ → engine/_editor_rolledback_$TS"
fi

# 3. HTML 되돌리기: 각 HTML 의 .before_split.bak 있으면 복원
TARGETS=(
  "presentations/claude_for_beginners/claude_for_beginners.html"
  "presentations/prompt_engineering/japan.html"
  "presentations/prompt_engineering/prompt_engineering.html"
  "presentations/미드저니_나노바나나_그록_활용/미드저니_나노바나나_그록_활용.html"
  "engine/template.html"
)
for f in "${TARGETS[@]}"; do
  if [ -f "$f.before_split.bak" ]; then
    cp "$f.before_split.bak" "$f"
    echo -e "  ${GRN}✅${NC} $f 복원"
  else
    echo -e "  ${YLW}⚠${NC}  $f.before_split.bak 없음 — 스킵"
  fi
done

# 4. verify_engine.sh 복원 (가능하면)
if [ -f scripts/verify_engine.sh.before_split.bak ]; then
  cp scripts/verify_engine.sh.before_split.bak scripts/verify_engine.sh
  echo -e "  ${GRN}✅${NC} scripts/verify_engine.sh 복원"
else
  echo -e "  ${YLW}⚠${NC}  verify_engine.sh.before_split.bak 없음 — 수동으로 editor.js 1파일 기준으로 편집 필요"
fi

# 5. 검증
echo ""
echo -e "${YLW}▶ 최종 검증${NC}"
bash scripts/verify_engine.sh
