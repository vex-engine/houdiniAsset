# CHANGELOG

PPTX 엔진 버전 기록. 최신 버전이 위.

---

## v1.3.3 — 2026-04-30 21:51 KST (프로젝트 컨텍스트 정리 + 미디어 드롭 위치 수정)

> **Tag**: `pptx-project-context-and-media-drop-2026-04-30`
>
> **기준 커밋**: `75ece81` — `Translate agent rules to Korean`
>
> 브랜치 이름과 루트 인계 문서를 정리하고, 탐색기에서 이미지/영상을 드롭할 때 위치가 어긋나거나 한 프레임 튀어 보이던 문제를 수정했다.

### 프로젝트/문서 기준 정리
- GitHub 브랜치를 `codex/push-current-work`에서 `pptx`로 변경했다.
- `AGENTS.md`를 한글 기반으로 전환하고, 문서/인계/변경 요약은 한글로 작성한다는 규칙을 추가했다.
- 루트 `PROJECT_CONTEXT.md`를 추가해 현재 브랜치, 주요 변경, 재발 방지 메모, 검증 기준을 기록했다.
- `apps` 저장소는 유지하고, `main`은 원격 기본 브랜치로 유지한다는 운영 기준을 명시했다.

### 미디어 드롭 위치 수정
- Windows 탐색기에서 이미지/영상을 드롭하면 실제 마우스 위치 중심에 배치되도록 수정했다.
- 에디터 모드의 `[data-step]{transform:none!important}` 때문에 transform 기반 중심 보정이 무력화되는 문제를 피했다.
- 드롭된 미디어의 표시 크기를 기준으로 `left/top`을 직접 계산한다.
- 크기 보정 전 원시 드롭 좌표에 먼저 보이지 않도록 숨긴 뒤 표시해, 좌상단에서 커서 위치로 튀는 한 프레임 깜빡임을 제거했다.

### 현재 작업트리 반영 사항
- 편집 캔버스 zoom/pan API가 추가된 상태다.
- 블럭 이동/복제에는 공용 스냅, Shift 축 잠금, 선택 핸들 정리가 들어간 상태다.
- 서버와 `index.html`은 Git 메타데이터 표시를 지원한다.
- `presentations/미드저니_나노바나나_그록_활용2/` 발표 복사본과 미디어가 추가됐다.

### 검증
- `node --check engine/editor/editor.core.js`
- `bash scripts/verify_engine.sh` — ALL GREEN

### 변경 파일
- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `engine/editor/editor.core.js`
- `docs/VERSION.md`
- `docs/CHANGELOG.md`

### 버전 기록 규칙
- 이후 버전 기록은 `YYYY-MM-DD HH:mm KST` 형식으로 시간까지 남긴다.
- `docs/VERSION.md`와 `docs/CHANGELOG.md`를 함께 갱신한다.
- 기준 커밋 해시와 커밋 제목을 함께 적는다.

---

## v1.3.2 — 2026-04-28 (블럭 드래그/Alt 복제 안정화)

> **Tag**: `block-drag-alt-duplicate-2026-04-28`
>
> 텍스트 블럭 드래그와 Alt 복제 시 기존 레이아웃 텍스트가 흐트러지거나 복제본/이전 선택 블럭이 함께 움직이는 문제를 공통 블럭 로직으로 정리.

### 블럭 이동/복제 규칙 정리
- 일반 드래그: 원본 텍스트 블럭은 `relative + left/top`으로 이동한다.
- Alt + 드래그: 원본은 건드리지 않고 복제본만 `absolute` 좌표로 생성해 이동한다.
- Ctrl+D: Alt 복제와 같은 `cloneBlockForDuplicate()` / `placeDuplicateBlockAtSource()` 경로를 사용한다.
- 복제 시 선택/편집/드래그/리사이즈/component/instance/runtime 상태와 editor artifact를 제거한다.
- resize/drag 핸들은 선택된 블럭에만 붙도록 정리했다.

### 하드코딩 정리
- 블럭 핸들 대상 선택자를 `BLOCK.TARGET_SEL`로 이동.
- 재발 방지 문서 추가: `docs/블럭_드래그_복제_회귀방지.md`

### 검증
- `node --check engine/editor/editor.block.js`
- `node --check engine/editor/editor.main.js`

### 변경 파일
- `engine/editor/editor.block.js`
- `engine/editor/editor.main.js`
- `docs/단축키.md`
- `docs/블럭_이동_규칙.md`
- `docs/블럭_드래그_복제_회귀방지.md`
- `docs/CHANGELOG.md`

---

## v1.3.1 — 2026-04-27 (미디어 우하단 핸들 Scale 동기화)

> **Tag**: `media-scale-handle-2026-04-27`
>
> 이미지/영상 선택 시 뷰포트 우측 하단 핸들이 우측 패널의 `Scale`과 같은 방식으로 동작하도록 수정한 패치 릴리스.

### 🖼️ 이미지/영상 리사이즈 핸들 수정
- 기존: 뷰포트 우하단 핸들이 `media.style.width`만 직접 변경 → 프레임/크롭 상태와 패널 `Scale` 값이 분리됨.
- 변경: 공용 `_startMediaScaleDrag(wrap,e)` 추가. 드래그 값이 `data-crop-scale`로 반영되고 `_cropApply()`를 통해 프레임과 미디어가 함께 갱신됨.
- 우측 패널 `Scale` 입력/슬라이더와 뷰포트 핸들이 같은 상태 경로를 공유.
- 저장된 HTML에서 복구되는 `.ed-resize-handle`도 동일한 공용 로직으로 연결.

### 🧪 검증
- `node --check engine/editor/editor.core.js`
- `node --check engine/editor/editor.main.js`
- `bash scripts/verify_engine.sh` — ALL GREEN

### 변경 파일
- `engine/editor/editor.core.js`
- `engine/editor/editor.main.js`
- `VERSION.md`
- `CHANGELOG.md`

---

## v1.3 — 2026-04-24 (엔진 물리 분할 — `editor.js` 4파일로 쪼갬)

> **Tag**: `engine-split-2026-04-24`  ·  **Rollback**: `bash scripts/rollback_split.sh`
>
> v1.2 에서 같은 날 이어진 구조 개편. 2858줄 단일 `editor.js` 를 **책임 단위 4개 파일**로 물리 분할. 외부 동작은 100% 동일 (`window.EA` API 54키 byte-exact).

### 🧱 4파일 분할 (엔진 내부 재조직)
- `engine/editor/editor.core.js` (604줄) — CONFIG / STATE / DOM 주입 / PALETTE / HELPERS / NAV / SLIDE OPS / EDITABLES / MEDIA WRAP / I/O / TOOLBAR / SELECTION OVERLAY / UNDO
- `engine/editor/editor.block.js` (612줄) — BLOCK SYSTEM v2 / AUTO STEP / ANIMATION PRESETS
- `engine/editor/editor.io.js` (902줄) — SAVE / EXPORT / FileSystemDirectoryHandle / SAVE AS
- `engine/editor/editor.main.js` (787줄) — DRAG HANDLES / TOGGLE / EVENT HANDLERS / PUBLIC API / PANEL RESIZER (←`window.EA` 정의는 여기)

로드 순서는 반드시 `core → block → io → main`. `main.js` 가 맨 끝에서 공개 API 를 확정.

### 🔧 기술적 해결
- **외곽 IIFE `(()=>Ellipsis)();` 제거** — 원본은 하나의 IIFE 로 감싸져 있었음. 파일 분할하려면 같은 script-level scope 공유가 필요 → 외곽 제거 + 각 파일 `'use strict'` 개별 선언.
- **내부 IIFE 2개 (`_prefetchAssets`, `initPanelResizer`) 는 그대로 유지** — 파일 경계와 무관.
- **경계 재조정** — 1차 분할 시 L495-501 (`$`, `toolbar`, `deck`, `origHTML` 등 DOM 핸들) 을 block 에 두었다가 core 에서 TDZ 에러 발생. core 로 이동 후 해결.
- **원본 라인 추적 마커** — 각 파일 본문에 `/* >>> editor.js original lines A-B >>> */` 주석 삽입. 4파일 concat + marker 제거 시 원본과 byte-exact 일치 (md5 확인).

### 🧪 검증 절차 (3단계)
1. **정적 검증** — `node --check` 각 파일 + `iconv` UTF-8 무결성.
2. **합체 byte-exact** — 4파일 마커 제거 후 cat → 원본 editor.js 와 md5 일치.
3. **런타임 동치성** — jsdom 에서 원본 vs 분할본 각각 로드 후 `Object.keys(window.EA)` 비교 → **54개 키 완전 일치**, 차이 0개.

### 🔁 롤백 시스템 (안전망)
- `scripts/rollback_split.sh` — **원클릭 복원**. `editor.js.before_split.bak` → `editor.js`, `engine/editor/` → `_editor_rolledback_<timestamp>`, HTML 5개 + `template.html` + `verify_engine.sh` 전체 되돌림 후 verify 실행.
- `engine/editor.js.before_split.bak` — 원본 128,391 bytes 그대로 보관.
- `scripts/verify_engine.sh.before_split.bak` — pre-split 버전의 verify 스크립트.
- `engine/_milestones/v2026-04-24_pre_split/` — 분할 직전 스냅샷.
- `engine/_milestones/v2026-04-24_post_split/` — 분할 직후 스냅샷 (현재).

### 📝 HTML 6개 업데이트
- 모든 presentation + `engine/template.html` 의 `<script src=".../editor.js">` 1줄 → `editor/editor.*.js` 4줄로 교체.
- 각 파일별 `.before_split.bak` 백업 남김.
- `presentations/claude_for_beginners`, `prompt_engineering/japan`, `prompt_engineering/prompt_engineering`, `미드저니_나노바나나_그록_활용`, `engine/template.html`, +prompt_lecture 계열은 인라인 임베드라 변경 없음.

### 🧰 `editor.io.js` 저장/내보내기 로직 확장
- 기존: `src.endsWith('editor.js')` 단일 매칭으로 export 시 에디터 script 제거.
- 변경: `src.indexOf('editor/editor.')>=0` 도 함께 매칭 → 4파일 모두 export 결과물에서 제거됨. panel-context 재주입 로직도 동일 패턴 확장.

### 🛡️ `verify_engine.sh` 업데이트
- 검사 대상: `engine/editor.js` 단일 → `engine/editor/editor.{core,block,io,main}.js` 4파일.
- HTML 엔진 참조 체크 리스트: `editor.js` → `editor.core.js` `editor.block.js` `editor.io.js` `editor.main.js` (6개 JS 모두 필요).

### ⚠️ Known Issues / TODO
- `editor.core.js` 가 여전히 604줄로 가장 큼 → 필요 시 helpers / palette / slide-ops 로 추가 세분 여지.
- Git 도입 시 `.before_split.bak` / `.bak` 시스템 폐기 예정.
- Playwright 회귀 테스트 5 시나리오 (이 릴리스를 baseline 으로).
- 실제 브라우저 스모크는 형이 `서버시작.bat` 실행 후 수동 확인 필요.

### 🔥 사고 이력 (재발 방지)
| # | 사고 | 원인 | 대책 |
|---|---|---|---|
| 1 | 첫 분할 시 4파일 모두 syntax error | 원본이 외곽 IIFE `(()=>{})();` 로 감싸져 있음을 1차 판단에서 놓침 | 외곽 IIFE 명시적 제거 + 각 파일 독립 `'use strict'` |
| 2 | 런타임 `$ is not defined` TDZ | `$=document.getElementById` (L496) 을 block 영역으로 분류 → core 가 먼저 로드되며 접근 실패 | 경계 재조정: L495-502 을 core 로 이동 |
| 3 | `verify_engine.sh` Edit 후 파일 끝 잘림 (한글 직전) | 알려진 Edit 툴 버그 (v1.2 에서도 기록된 함정) | Python heredoc 으로 전체 재작성 |
| 4 | io.js 재분할 시 export 패치 소실 | 1차 분할 후 io 에 수동 패치했는데 경계 재조정하며 재생성 → 덮임 | 필수 패치 목록화 후 재적용 루틴 |

---

## v1.2 — 2026-04-24 (패널 컨텍스트 전환 + 재생 순서 · 단축키 통일 · 안정성)

> v1.1 이후 같은 날 이어진 대규모 세션. **오른쪽 패널 리팩토링** 완료 + **휠/키/재생 순서** 통합 정책 확정 + **운영 안정성**(HTML 검증, 엔진 self-check, 서버 중복 실행 해제).
>
> 관련 문서: `PANEL_REDESIGN_HANDOFF_v4.md`, `에러이슈노트.md`, `단축키.md`, `scripts/verify_html.sh`

### 🧩 오른쪽 패널 — 컨텍스트 전환
- `engine/panel-context.js` 신규 (248 라인). IIFE. `window.PanelCtx.refresh(el, selBlocks, selBlock)` 노출.
- 선택 대상에 따라 5개 컨텍스트 자동 교체: **none / text / image / video / multi**.
- `editor.js` 의 `_setSel` 끝에 1줄 호출. `window.EA`/`sel`/`selBlocks` IIFE 스코프 문제는 인자로 전달해 해결.
- 영상 패널에 **재생 / 자동재생 / 반복 / 음소거** 4버튼. 재생 중에도 상태 즉시 동기화.
- 'none' 컨텍스트에 **"↕ Y좌표 기준 재배정"** 버튼 추가 (data-step 자동 재정렬).
- HTML 5개에 `<script src="panel-context.js">` 주입. 구버전 파일은 saveAs 시 자동 주입.

### 🎬 재생 순서 (data-step) 개선
- `addMedia()` 자동 data-step 부여 — 삽입 시 현재 슬라이드 max+1.
- `autoStepBySlide(slide)` 신규 — 슬라이드 내 최상위 블록 Y 좌표 기준 재배정 (±40px 은 동시 등장).
- `mkVid()` 기본값 autoplay **OFF** — 영상이 DOM 들어오자마자 재생되던 현상 해소.

### ⌨️ 단축키 · 휠 통합 정책 (v2.1)
- **스텝 단위 (블록 하나씩)**: 휠 · 스페이스 · 방향키 ← → ↑ ↓ → `advanceStep(dir)` 공용 진입점.
- **슬라이드 단위 (페이지 통째)**: PageUp · PageDown.
- **점프**: Home · End.
- 이전엔 화살표가 슬라이드 단위였음 — **1회 키로 통일된 의미 정책**으로 변경.

### ⚡ Flash 방지 (페이지 전환 시 한 프레임 깜빡임 제거)
- `goStep`/`go`: step 상태 먼저 세팅 → 강제 reflow → active 전환.
- CSS 안전망: `.slide:not(.active) [data-step], .ed-media-wrap` 강제 숨김 (editor-mode 예외).
- 경계 동작: 첫/마지막 슬라이드 경계에서 `_wheelLock`/`_wheelAcc` 리셋 — 연쇄 발사 차단.

### 🎚️ 레이어 순서 (zIndex) — 미디어 vs 미디어 버그 수정
- 기존 `zIndex()` 가 media-wrap 형제를 SKIP 에 포함해 비교군이 비어있었음 → **미디어 vs 미디어 순서 변경 작동 안 함**.
- 수정: 형제를 `textSibs` + `mediaSibs` 로 분리, 앞으로/뒤로 각각 올바른 대조군 기준 z-index 계산.

### 🛡️ 운영 안정성 (근본 대안)
- **`scripts/verify_html.sh`** 신규 — HTML 무결성 검증. NUL 바이트, 필수 script (presentation/panel-context/editor), `</html>` 종료 체크. 세션 시작/수정 후 매번 실행 권장.
- **런타임 self-check** — `presentation.js` 로드 300ms 뒤 `EA`/`PanelCtx` 확인. 누락 시 콘솔 경고 + 화면 상단 빨간 배너. Export 모드는 `<meta name="engine-mode" content="presentation">` 주입해 스킵.
- **서버시작.bat 포트 강제 해제** — 중복 실행 시 이전 Node 프로세스를 `netstat`+`taskkill`로 정리 후 시작. 로딩 지연 문제 해소.

### 🐛 사이드 버그 수정
- **Save As 파일명 URL 인코딩** — `location.pathname` 디코딩 누락 버그 (같은 패턴이 `exportHTML`엔 이미 있었음). `decodeURIComponent` + try/catch fallback.
- **saveAs 한글 파일명 미반영** 문제 해소.
- `_inlineAssets` 가 panel-context.js 를 자동 인라인 + 누락 시 강제 주입.
- `_prefetchAssets` 에 panel-context.js 강제 프리페치 (file:// 환경 대응).

### 🗂️ 문서 통합
- `에러이슈노트.md` 를 **단일 진실의 원천** 으로 승격. 이슈 #1~6 + 공통 체크리스트.
- `단축키.md` — v2.1 통합 정책 반영, 코드 위치 참조 추가.
- `scripts/` 디렉터리 신설.

### 🧭 Known Issues / TODO
- Export HTML 이 `file://` 에서 직접 열릴 때 CORS 경고 (외부 리소스 로드 시도). 추가 조사 필요.
- `go()`/`goStep()`/`jump()` 3경로 중복 → 다음 세션에 `transitionTo()` 하나로 통합 예정.
- 다중 선택 정렬 버그 — `EA.alignEl` 이 `selBlocks` 순회 안 함.

---

## v1.1 — 2026-04-24 (블럭 시스템 v2 — 피그마 방식 확정)

> v1.0 → v1.1 동안 내부적으로 Block System v2 설계를 반복 개편했다(임시 v2.0/v2.1/v2.2로 작업하며 누적). 공식 릴리스로는 **v1.1** 하나로 통합 기록한다.
>
> 관련 문서: `블럭_이동_규칙.md`, `engine/BLOCK_SYSTEM.md`

### 🎯 피그마 4대 철칙 (코드에 각인, 재발 방지)
1. **한 번에 하나만 선택** — 렌더링 단에서 강제. `_clearBlockClasses(except)`가 매 상태 변경 시 `.ed-selected-block` · `.ed-editing-block` · `.ed-selected`(구) · `contenteditable` **4가지 전부** 한 방에 청소.
2. **레이아웃 래퍼는 블럭 아님** — `.principle-grid2` · `.joka-grid` · `.num-grid` · `.flow` · `.demo-wrap` · `.demo-info` 는 `BLOCK.LAYOUT_WRAPPER_SEL`로 명시. `isBlock()`이 거부.
3. **빈 공간 클릭 = 무조건 IDLE** — `clickBlockAt()` 진입 시 `findBlock(target)==null`이면 즉시 선택 해제.
4. **자식도 블럭** — `.p-kor` · `.j-char` 등 리프 div도 개별 선택/편집 가능 (LEAF_CLASS_PREFIXES: `p-, j-, n-, f-, uc-, jf-`).

### 🧠 3가지 상태
| 상태 | 외관 | 할 수 있는 일 |
|---|---|---|
| IDLE | 아무 표시 없음 | 보는 상태 |
| SELECTED | 진한 녹색 outline (2.5px solid) | 이동, 삭제, 복제, 감싸기 |
| EDITING | 연한 녹색 점선 (1.5px dashed) + 커서 | 글자 입력/수정 |

### 🖱️ 선택 규칙 (D안 + Figma 한 겹 파고들기)
- Click: 첫 클릭 = 최상위 부모 블럭 선택 / 같은 블럭 재클릭 = 한 겹 안으로 파고들기 / 리프에서 또 클릭 = EDITING 진입
- Double-click: 리프까지 즉시 파고들어 EDITING
- Shift+Click: 다중 선택 토글
- ESC: EDITING→SELECTED / SELECTED→부모 / 최상위→IDLE
- Enter / F2: SELECTED → EDITING

### 🚚 이동 규칙 (A3 + B2 + C1 확정)
- **A3**: 그냥 드래그로는 이동 안 됨. **Space+드래그** 또는 **Alt+드래그**로만 이동 (피그마 Hand tool).
- **B2**: 작은 블럭(카드 안쪽 텍스트)도 자유 이동. `Ctrl+0` 또는 툴바 `⟲ 원 위치` 버튼으로 top/left 리셋.
- **C1**: 다중 선택 시 Space+드래그 → 모두 같은 델타로 함께 이동.
- 화살표 키 Nudge: 1px / Shift+화살표: 10px (다중 선택 시 함께 이동).
- Space 홀드 중 커서 grab 모양으로 변함 (`body.ed-move-mode`).

### ✨ 추가 기능
- 깔끔한 삭제 (`deleteBlockClean`): UI 찌꺼기(드래그/리사이즈 핸들) 자동 정리 후 `attachHandles()` 재동기화.
- 블럭 추가 — 사이드바 `+ 텍스트 / + 제목 / + 카드` 버튼 (`EA.insertBlock`).
- `Ctrl+G` 감싸기 / `Ctrl+Shift+G` 풀기 — 카드 컨테이너로 감싸고 풀기.
- `Ctrl+D` 복제 — 찌꺼기 없는 cloneNode.
- 사이드바에 "블럭 이동 안내" 상시 표시 (Space+드래그, 화살표, ESC 등).

### 🗑️ 제거
- 드래그 핸들 `⠿` 완전 숨김 (`display:none !important`) — A3 방식 채택으로 불필요.
- `.ed-media-wrap` 자동 드래그 제거 — 클릭은 선택만, 이동은 Space/Alt+드래그로 통일.

### 🐛 수정된 주요 버그
- **부모-자식 동시 녹색** — `setBlockState()`가 `_clearBlockClasses(null)` 선행 호출로 "한 번에 하나만" 강제.
- **빈 공간 클릭해도 선택 안 풀림** — `.principle-grid2`가 블럭으로 등록돼 있어서 그리드 전체가 새로 선택되던 문제. LAYOUT_WRAPPER로 이관하여 해결.
- **중첩 블럭 편집 불가** — `on()`의 구 필터 로직이 자식 div 포함 요소를 전부 건너뛰던 문제. 블럭 시스템 v2로 재설계.
- **CSS `[contenteditable="true"]`의 자동 hover/focus outline**이 여러 블럭 동시 녹색으로 보이게 하던 문제 — outline 규칙 제거, `.ed-selected-block` / `.ed-editing-block` 클래스만 outline 표시.
- 구 `.ed-selected`와 새 `.ed-selected-block` 이중 outline — `_setSel()`이 media-wrap에만 구 클래스 부여하도록 한정.
- Space 눌렀을 때 페이지 스크롤 방지 + 창 포커스 잃었을 때 `moveKeyHeld` 리셋.
- `on()` 자동 contenteditable 부여 제거 → 실수로 클릭해서 편집 모드 진입하는 문제 해결.

### 🏗️ 아키텍처
- `editor.js` 상단 **BLOCK SYSTEM v2 섹션** — `BLOCK` 상수, `isBlock` · `findBlock` · `parentBlock` · `drillDownBlock` · `isLeafBlock` · `setBlockState` · `clickBlockAt` · `deleteBlockClean` · `groupBlocksWrap` · `ungroupBlockUnwrap` · `insertBlockAfter` · `toggleBlockSelection` · `currentBlock` · `startMoveDrag` · `resetBlockPosition` · `nudgeBlocks`.
- 블럭 판별은 단일 함수 `isBlock()`에 집중. selector 하드코딩은 `BLOCK.CONTAINER_SEL` / `BLOCK.LAYOUT_WRAPPER_SEL` / `BLOCK.TEXT_TAGS_SEL` / `BLOCK.LEAF_CLASS_PREFIXES` 네 곳에만.
- 기존 `sel` / `_setSel` 시스템은 media-wrap 호환용으로 유지, 일반 블럭은 `selBlock` · `editingBlock` · `selBlocks` 사용.
- `hideBar` / `closeBar` / `off()`에서 블럭 상태 자동 정리.

### ⌨️ 키보드 매핑 전체
| 키 | 동작 |
|---|---|
| Click | 한 겹 파고들기 선택 |
| Double-click | EDITING 즉시 진입 |
| Shift+Click | 다중 선택 토글 |
| ESC | 한 단계 뒤로 (편집→선택→부모→IDLE) |
| Enter / F2 | SELECTED → EDITING |
| Space+드래그 / Alt+드래그 | 블럭 이동 |
| ↑↓←→ | 1px 이동 / Shift+화살표 10px |
| Ctrl+0 | 원 위치 복귀 |
| Delete / Backspace | SELECTED면 블럭 삭제, EDITING이면 글자 삭제 |
| Ctrl/Shift+Delete | EDITING 중에도 블럭 통째 삭제 |
| Ctrl+D | 복제 |
| Ctrl+G / Ctrl+Shift+G | 감싸기 / 풀기 |
| Ctrl+Z / Ctrl+Shift+Z | 실행취소 / 재실행 |

---

## v1.0 — 2026-04-24

**첫 공식 버전 기록.** 지금까지 누적된 에디터/프레젠테이션 엔진의 전체 동작을 v1.0으로 확정.

### 🆕 이번 릴리스에서 새로 추가된 변경 (최근 작업)

**프레젠테이션 모드 (익스포트된 HTML)**
- 마우스 휠 네비게이션 추가: 휠 한 번 = 스텝(블록) 한 개 전진/후진
  - 슬라이드 끝에 도달하면 다음/이전 페이지로
  - 다음 슬라이드 진입 시 `step=0` (아무 블록도 안 보임) → 휠 굴리면 블록 하나씩 등장
  - 이전 슬라이드 진입 시 `step=max` (전체 블록 보임) → 위로 굴리면 블록 하나씩 사라짐
  - 첫 슬라이드는 항상 전체 표시 + 휠 위로 동작 안 함
- 키보드 `PageDown` / `PageUp` → **페이지 단위 이동**으로 변경 (기존엔 스텝 기반)
- `Space`는 기존처럼 블록 단위 스텝 진행 유지

**에디터 모드**
- 마우스 휠 네비게이션 추가: 슬라이드 프레임 위에서 휠로 페이지 단위 이동 + 사이드바 동기화
- 안전장치:
  - `contenteditable` 텍스트 편집 중엔 휠 이동 방지 (스크롤 허용)
  - 블록 드래그/리사이즈 중 동작 안 함
  - `<input>` / `<textarea>` 포커스 중 무시
  - 휠 throttle 180ms + 누적 40px 필터 (트랙패드 관성 대응)

**문서**
- `단축키.md` 신규 작성 — 전체 단축키 레퍼런스
- `CHANGELOG.md` 신규 작성 — 버전 기록 시작

### 📦 v1.0 현 시점 핵심 기능 (누적)

**엔진 구조**
- `engine/presentation.js` — 프레젠테이션 런타임 (슬라이드 전환, 스텝 애니메이션, 입력 핸들링)
- `engine/editor.js` — 에디터 모드 (편집, 드래그, 리사이즈, 애니메이션 프리셋, 저장/익스포트)
- `engine/engine.css` — 공통 스타일 (슬라이드 레이아웃, 스텝 트랜지션, 에디터 UI)
- `engine/template.html` — 신규 프레젠테이션 템플릿
- `save-server.js` — 로컬 저장/익스포트 서버
- `new-presentation.js` — 신규 프레젠테이션 생성 스크립트

**프레젠테이션 기능**
- 슬라이드 전환 애니메이션 (slide-out left/right, 600ms cubic-bezier)
- `data-step` 기반 블록 순차 등장 (stagger 지원)
- 전체화면 (`F`), 발표자 노트 토글 (`N`)
- 터치 스와이프 지원 (모바일)
- 슬라이드 URL 해시 (`#slide-3`) 복원
- LocalStorage 자동 편집 저장 복원 (deck hash 기반 무효화)

**에디터 기능**
- 클릭 편집 (contenteditable)
- 블록 드래그 이동 + 스냅 (가이드라인, 그리드, SNAP_PX)
- 블록 리사이즈 (각 모서리 + 좌우)
- 이미지/비디오/iframe 삽입 (드래그 앤 드롭, 붙여넣기, 파일 선택)
- 팔레트 (green/pink/custom) + 저장/불러오기
- 문자 단위 애니메이션 프리셋 (jiggle, blink, pulse - slow/mid/fast)
- Undo/Redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y)
- 복제 (Ctrl+D)
- 방향키로 선택 요소 이동 (1px / Shift+ 10px)
- 슬라이드 네비게이션 사이드바 (드래그 순서 변경, 복제, 삭제)
- 그리드 표시 (G)
- 저장 (Ctrl+S) / 익스포트 (Ctrl+Shift+S)

### 💾 스냅샷 위치

`backup/v1.0/` 폴더에 다음 파일 보관:
- `engine/editor.js`, `engine/presentation.js`, `engine/engine.css`, `engine/template.html`
- `engine/EDITOR_DEV.md`, `engine/EXPORT_CONTRACT.md`, `engine/RESEARCH.md`
- `단축키.md`, `00_START.md`, `에러이슈노트.md`
- `save-server.js`, `new-presentation.js`, `index.html`

롤백이 필요하면 `backup/v1.0/`의 해당 파일을 원위치에 복사.

---

## 버전 네이밍 규칙

- **v1.x** — 마이너 업데이트 (기능 추가, 개선)
- **v1.x.y** — 패치 (버그 수정)
- **v2.0** — 메이저 (구조 변경, 하위 호환 깨짐)

각 릴리스는 `backup/v{version}/`에 스냅샷 저장.
