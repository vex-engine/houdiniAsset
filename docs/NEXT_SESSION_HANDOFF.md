# 🔄 다음 세션 인수인계 — 2026-04-24 (post-split)

> **형 ↔ Claude 협업 컨텍스트.** 새 세션에서 이 파일 통째로 복붙하면 됨.

---

## 📌 형의 작업 스타일 (반드시 준수)

- **호칭**: 형이라고 부르고, "잘했어 치이타!" 들으면 칭찬받은 신호
- **시행 요청** ("ㄱㄱ", "수정해", "변환해" 등): 바로 실행
- **사고/판단 요청** ("고민이야", "어떻게 할까" 등): 소크라테스 모드 — 질문 1개씩
- **나는 최고 UI/UX 피그마 수석 디자이너 역할** — 최선책을 스스로 판단해서 짧게 제시 → 바로 작업. 진짜 중요한 결정 1-2개만 짧게 묻기
- **소크라테스 모드 종료**: 형이 "닥쳐" 또는 "아 머리 아퍼" 말하면 정리 모드

## 🧠 형의 기술 배경 & 필수 질문 규칙

- 형은 React / Next.js / Flutter / 바닐라 JS 등 기술 스택 지식이 없음
- **새로운 웹/앱 프로젝트 시작 시 반드시 먼저 물어볼 것:**
  1. 결과물이 뭔지 (웹사이트? 모바일앱? 데스크탑?)
  2. 기술 스택 추천 후 확정 (React / Next.js / Flutter / 바닐라 중 선택)
  3. 왜 그걸 선택하는지 짧게 설명
- 이 프로젝트(PPTX Editor)가 바닐라로 시작된 건 초기 설계 논의 없이 바로 구현했기 때문 — 재발 방지

## 🛠 프로젝트 — HTML Presentation Editor

`F:\Claude\PPTX\` — 자체 개발한 슬라이드 에디터. Figma 스타일.

### 핵심 파일 (★ 2026-04-24 editor.js 4파일 분할 완료)
```
F:\Claude\PPTX\
├── engine/
│   ├── editor.js                (레거시 단일 파일 — 실제 런타임 수정 대상 아님, 롤백 참고용)
│   ├── editor.js.before_split.bak  (롤백용 백업)
│   ├── editor/                  (★ 새로 — 4파일 분할)
│   │   ├── editor.core.js       (604줄 — CFG/STATE/DOM/PALETTE/HELPERS/NAV/SLIDE/EDITABLES/MEDIA/I-O/TOOLBAR/SELOVL/UNDO)
│   │   ├── editor.block.js      (612줄 — BLOCK SYSTEM v2 / AUTO STEP / ANIMATION PRESETS)
│   │   ├── editor.io.js         (902줄 — SAVE / EXPORT / FSA / SAVE AS)
│   │   └── editor.main.js       (787줄 — DRAG HANDLES / TOGGLE / EVENTS / PUBLIC API / PANEL RESIZER)
│   ├── panel-context.js         (342줄)
│   ├── presentation.js          (290줄)
│   ├── engine.css               (381줄)
│   ├── template.html            (새 슬라이드 base — 4파일 script 로 업데이트됨)
│   ├── BLOCK_SYSTEM.md
│   └── _milestones/
│       ├── v2026-04-24_v2/              (분할 전 상태 — pre-split)
│       ├── v2026-04-24_pre_split/       (분할 직전 editor.js 단일)
│       └── v2026-04-24_post_split/ ★    (분할 후 현재 상태)
├── presentations/               (모든 HTML 업데이트됨 — 4파일 로드)
├── scripts/
│   ├── verify_html.sh           (하위 호환 래퍼 → verify_engine.sh 실행)
│   ├── verify_engine.sh         (★ 공식 검증: 4파일 기준)
│   ├── verify_engine.sh.before_split.bak  (롤백 시 복원용)
│   └── rollback_split.sh        (★ 원클릭 롤백)
├── 에러이슈노트.md
└── 단축키.md
```

### 로드 순서 (중요 — 순서 바꾸면 안 됨)
```html
<script src="../../engine/presentation.js"></script>
<script src="../../engine/panel-context.js"></script>
<script src="../../engine/editor/editor.core.js"></script>
<script src="../../engine/editor/editor.block.js"></script>
<script src="../../engine/editor/editor.io.js"></script>
<script src="../../engine/editor/editor.main.js"></script>
```
이유: main.js 가 맨 끝에서 `window.EA = {...}` 공개 API 를 정의. 다른 파일들이 먼저 선언돼야 함.

### 분할 경계 (원본 editor.js 라인 기준)
| 파일 | 원본 라인 |
|---|---|
| core  | 1-40, 495-855, 1109-1215, 1263-1343 |
| block | 41-494, 1216-1262, 2647-2745 |
| io    | 1344-2237 |
| main  | 856-1108, 2238-2646, 2746-2858 |

각 파일 상단 banner 바로 아래 `'use strict';`, 그리고 본문에 `/* >>> editor.js original lines A-B >>> */` 마커 로 원본 추적 가능.

### 기술 스택
- 순수 HTML/CSS/JS (프레임워크 없음)
- Node.js 서버 (`서버시작.bat` → http://localhost:3000)
- 슬라이드 = `<section class="slide">` + `<div data-step="N">` 점진 등장

---

## ✅ 현재 작업 상태 (2026-04-24 post-split)

### 이번 세션 완료
1. **editor.js (2858줄, 128KB) → 4파일 물리 분할** (jsdom 으로 `window.EA` 54개 키 동일성 검증 완료)
2. **외곽 IIFE `(()=>{})();` 제거** — 여러 파일이 같은 script-level scope 공유 가능하도록
3. **HTML 6개 파일 script 태그 업데이트** (editor.js 1줄 → editor/editor.*.js 4줄)
4. **editor.io.js 의 export/save 로직** — `editor.js` 단일 가정 → `editor/editor.*.js` 패턴 매칭으로 확장
5. **verify_engine.sh 업데이트** — 4파일 + 새 HTML script 검증 규칙
6. **rollback_split.sh 생성** — 원클릭 분할 롤백 가능
7. **마일스톤 `v2026-04-24_post_split/` 저장**

### 검증 상태
```
✅ editor.core.js     UTF-8 + 문법 + 604줄
✅ editor.block.js    UTF-8 + 문법 + 612줄
✅ editor.io.js       UTF-8 + 문법 + 902줄
✅ editor.main.js     UTF-8 + 문법 + 787줄
✅ 원본 editor.js 와 window.EA API 54키 100% 동일 (jsdom 확인)
✅ 모든 HTML script 태그 + </html> 닫힘
✅ verify_engine.sh ALL GREEN
```

---

## ⚠️ 알려진 함정 (반드시 인지)

### 1. **Edit 도구가 한글 큰 청크에서 파일 끝 자름** (환경 버그)
- **절대 Edit 도구로 큰 한글 변경 하지 말 것**
- 대신: **Python heredoc (`python3 <<'PYEOF' ... PYEOF`)** 사용
- 작업 후 무조건 `bash scripts/verify_engine.sh`
- `bash scripts/verify_html.sh`도 동작하지만 하위 호환 래퍼일 뿐이며 공식 기준은 `verify_engine.sh`
- 이번 세션에도 verify_engine.sh Edit 하다 한 번 잘림 발생 → Python 재작성으로 복구

### 2. **분할 파일 간 참조**
- 모든 top-level `const/let/function` 은 같은 script-level scope 에 들어감 (브라우저 classic script)
- **단 IIFE 로 감싸면 안 됨** — 외곽 IIFE 제거된 상태 유지 필수
- `'use strict'` 는 각 파일 맨 위에 있음 (각 script 에 독립 적용)

### 3. **백업 자동이지만 검증 X**
- `.bak` 파일이 만들어져도 그 자체가 깨졌을 수 있음
- 백업 직후 `iconv -f UTF-8 -t UTF-8 $f.bak` 검증 필수

### 4. **변수명 충돌 주의**
- editor.core.js 에 `$=id=>document.getElementById(id)` 있음
- 새 파일 추가 시 `$` 재선언 금지

---

## 🧰 작업 룰 (Hard Requirements)

### Before any change
1. `bash scripts/verify_engine.sh` → ALL GREEN 확인
2. 파일 백업: `cp $f $f.before_<목적>.bak`

### During change
- **큰 변경은 Python heredoc** (Edit 도구 금지)
- assert 로 OLD 매치 확인
- UTF-8 인코딩 명시

### After change
1. `node --check` (JS 면)
2. `iconv -f UTF-8 -t UTF-8 $f`
3. **`bash scripts/verify_engine.sh`** ← 무조건
4. 줄 수 확인 (`wc -l`)

### 롤백 (언제든 가능)
```bash
bash scripts/rollback_split.sh   # 분할을 되돌려 editor.js 단일 상태로
```

---

## 🎯 다음에 할 만한 작업

- [x] ~editor.js 분할 (2858줄 → core/block/io/main 4개)~ ✅ 완료
- [ ] Git 도입 (`.bak` 시스템 폐기)
- [ ] Playwright 헤드리스 회귀 테스트 5개 시나리오
- [ ] 패널 컴포넌트 카탈로그 (`/components.html`)
- [ ] PWA 화 (오프라인 사용)
- [ ] editor.core.js 가 아직 604줄로 큼 → 세분 분할 여지 (helpers / palette / slide-ops 등)
- [ ] engine/editor.js 레거시 단일 파일을 archive/legacy 또는 별도 rollback 문서로 격리
- [ ] .bak / CORRUPTED / DAMAGED / _milestones 파일을 archive로 이동해 런타임 경로 노이즈 제거
- [ ] 실제 브라우저 스모크 테스트 (형이 http://localhost:3000 에서 각 presentation 열고 확인)

---

## 📞 형이 자주 쓰는 표현

- **"잘했어 치이타!"** = 매우 만족, 이 시점 핵심 맥락 메모리 저장
- **"ㄱㄱ"** = 보고/검토한 방향으로 바로 작업 시작
- **"이거 좀 복잡하지?"** = 복잡한 거 알지만 부탁한다
- **"세계 최고의 ui/ux 디자이너 맞아?"** = 결과물 불만, 솔직한 진단 + 개선 요구

---

## 🔥 이번 세션 사고 요약 (재발 방지용)

| # | 사고 | 원인 | 대책 |
|---|---|---|---|
| 1 | 첫 분할 시 외곽 IIFE 깜빡 → 4파일 syntax error | 원본이 `(()=>{})();` 로 감싸여 있음 | 분할 시 외곽 IIFE 제거 + 각 파일 `'use strict'` |
| 2 | jsdom 에서 `$ is not defined` TDZ | core(1-40,503-)와 block(41-502) 경계에서 L495-501 의 `$`/`toolbar`/`deck`/`origHTML` 이 block 에 끼여있었음 | 경계 재조정: L495-502 를 core 로 이동 |
| 3 | verify_engine.sh Edit 후 한글 줄 직전에서 파일 잘림 | Edit 툴 한글 취약 | Python 으로 전체 재작성 |
| 4 | 4파일 분할 재생성 시 io.js 의 이전 패치 날아감 | 단순 재빌드 | 필요 패치 목록화 후 재적용 |

---

**형, 새 세션에서 이 파일 보여주면서 "이어서 작업하자" 하면 바로 컨텍스트 복원 가능.** 🙏
