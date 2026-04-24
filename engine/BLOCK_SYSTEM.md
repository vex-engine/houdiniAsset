# 블럭 시스템 설계 문서 (엔진 v1.1)

> 중첩 블럭, 선택/편집 상태 분리, 깔끔한 삭제, 합치기/분리, 다중 선택을 통합한 블럭 시스템.
> 피그마 방식을 충실히 따른다.
>
> 작성: 2026-04-24 / 확정: 2026-04-24 (v1.1 릴리스)
>
> 대상: editor.js
>
> 관련 문서: `../블럭_이동_규칙.md` (형이 까먹지 않게 남긴 사용자 매뉴얼)

---

## 🔑 피그마 4대 철칙 (재발 방지 — 이거 깨지면 버그가 돌아온다)

1. **"한 번에 하나만 선택"** — 렌더링 단에서 강제
   - `setBlockState()` 호출 시 `_clearBlockClasses()`가 모든 잔재 전면 청소
   - `.ed-selected-block`, `.ed-editing-block`, `.ed-selected`(구), `contenteditable` 4가지를 한 방에 정리
   - 부모-자식 양쪽에 녹색 테두리 붙는 사고 원천 차단

2. **"레이아웃 래퍼는 블럭이 아니다"**
   - `BLOCK.LAYOUT_WRAPPER_SEL`에 `.principle-grid2`, `.joka-grid`, `.num-grid`, `.flow`, `.demo-wrap`, `.demo-info` 명시
   - `isBlock()`이 이들을 명시적으로 거부 → 클릭 시 IDLE
   - 레이아웃 그리드 공간의 빈 영역을 클릭하면 **진짜 빈 공간**으로 취급

3. **"빈 공간 클릭 = 무조건 선택 해제"**
   - `clickBlockAt()` 초반에 `findBlock(target)==null` 체크 → 바로 IDLE
   - 피그마의 황금 규칙

4. **"자식도 블럭이다"**
   - `.p-kor`, `.p-eng`, `.j-char` 등 리프 div는 개별 선택/편집 가능
   - 단, 선택 상태는 한 번에 하나만 (철칙 1)

---

## 1. 블럭(Block)의 정의

**블럭 = 에디터가 "단위"로 다루는 DOM 요소.**

- 슬라이드(`section.slide`) 안에 존재하는 요소 중, 다음 조건을 만족하면 블럭:
  - `[data-step]` 속성이 있거나
  - 아래 클래스 중 하나에 해당: `.principle-card, .principle-grid2, .joka-cell, .joka-grid, .card, .num-item, .num-grid, .flow, .flow-step, .two-col, .code-block, .ed-media-wrap, table`
  - 또는 위 컨테이너의 자식인 **리프 텍스트 div** (`.p-kor`, `.p-eng`, `.p-desc`, `.p-num`, `.p-extra`, `.j-char`, `.j-word`, `.j-eng`, `.j-ex` 등 — 자식으로 또 다른 블럭이 없는 div)
  - 또는 기본 텍스트 태그(`h1/h2/h3/p/li/td/th`) — 단 `.speaker-notes`, `.code-block` 내부는 제외

**블럭이 아닌 것**: 
- 에디터 UI artifact (`.ed-drag-handle`, `.ed-block-resize*`, `.ed-resize-handle`, `.ed-media-del`, `.ed-selected-block` 클래스)
- `<br>`, `<span>`, `<b>`, `<i>`, `<em>`, `<strong>` 등 inline 요소 (글자 편집 대상일 뿐)

이 판별은 **한 함수에서만** 수행: `isBlock(el)`. 선택자 하드코딩을 여기 한 곳에 집중.

---

## 2. 블럭의 3가지 상태

| 상태 | 시각 | 의미 | 조작 |
|---|---|---|---|
| **IDLE** | 아무 표시 없음 | 선택 안 됨 | — |
| **SELECTED** | 진한 녹색 outline (2px solid) | "이 블럭을 움직이거나 지우고 싶다" | 드래그, 삭제, 복제, 자르기/붙이기, 감싸기/풀기 |
| **EDITING** | 연한 녹색 outline (1px dashed) + 커서 | "이 블럭 안 글자를 고치고 싶다" | 텍스트 입력, 서식 |

**한 번에 한 블럭만** SELECTED 또는 EDITING 상태가 됨 (Phase 3에서 다중 선택 추가 시 SELECTED는 배열로 확장).

### 상태 전이 (D안 + Figma 방식)

```
IDLE ──click──▶ SELECTED (가장 바깥 부모 먼저)
SELECTED ──click on same──▶ SELECTED 자식 (한 겹 파고들기)
SELECTED ──click on leaf──▶ EDITING (리프 도달 시 다음 클릭 = 편집)
SELECTED ──Enter / F2 / double-click──▶ EDITING
SELECTED ──ESC──▶ SELECTED 부모 (한 겹 바깥으로)
SELECTED ──click outside──▶ IDLE
EDITING ──ESC──▶ SELECTED (같은 블럭)
EDITING ──click outside──▶ IDLE
```

**"한 겹씩 파고들기" 규칙 (Figma 방식)**:
- 처음 클릭: `curSlide()`의 직계 자식 중 클릭 지점을 포함하는 블럭 선택
- 이미 선택된 블럭을 다시 클릭: 클릭 지점을 포함하는 **선택된 블럭의 자식 블럭**으로 내려감
- 더 이상 자식이 없는 리프에 도달한 뒤 또 클릭: EDITING 진입

---

## 3. 조작(Action) 명세

모든 조작은 **단일 진입점 함수**로 통일. 하드코딩된 DOM 조작 금지.

### 3.1 삭제 (`deleteBlock`)
- 블럭 자체 + 해당 블럭 내부의 모든 **에디터 UI artifact** 정리
- 삭제 후 `attachHandles()` 재실행 (핸들 재동기화)
- 부모 컨테이너가 비게 되면 (`principle-grid2` 안에 카드가 하나도 안 남음 등) **부모는 남김** — 사용자가 새 블럭 추가할 공간
- `push()` 호출로 undo 스냅샷 생성

### 3.2 이동 (드래그)
- 현재 `startDrag()` 사용 — OK
- 드래그 시작 시 `push()`, 끝날 때 또 스냅샷 필요 없음 (상태는 이미 바뀌었고 다음 push 전까지 undo 대상)

### 3.3 추가 (`insertBlock`)
- 툴바 "+ 블럭 추가" 버튼 → 타입 선택 (텍스트/제목/카드/이미지)
- 현재 선택된 블럭이 있으면 **그 블럭 바로 뒤**에 삽입
- 선택된 게 없으면 슬라이드 끝에 삽입
- 자동으로 새 블럭이 SELECTED 상태로

### 3.4 감싸기 (`groupBlocks`)
- 선택된 블럭(들)을 새 `<div class="card ed-group">` 안으로 이동
- Ctrl+G
- 단일 블럭이어도 동작 (나중에 옆에 뭘 더 넣을 수 있게 껍데기 제공)

### 3.5 풀기 (`ungroupBlock`)
- 선택된 컨테이너 블럭의 자식들을 조부모 위치로 승격, 컨테이너 자체는 삭제
- Ctrl+Shift+G
- 리프 블럭에는 적용 불가(비활성)

### 3.6 다중 선택 (`addToSelection`)
- Shift+클릭: 이미 선택된 블럭에 추가/제거
- 여러 블럭 선택 시 `SELECTED` 상태를 배열로 관리
- 다중 선택 상태에서 가능한 조작: 삭제(전부), 감싸기(전부 한 카드로), 이동(전부 같은 델타)
- 다중 선택 상태에서 불가: EDITING 진입(의미 없음)

---

## 4. 시각 표현 (CSS)

```css
body.editor-mode .ed-selected-block {
  outline: 2px solid var(--g) !important;
  outline-offset: 3px !important;
  background: rgba(62,207,142,.06);
}
body.editor-mode .ed-editing-block {
  outline: 1px dashed var(--g) !important;
  outline-offset: 2px !important;
  background: transparent;
}
```

**주의**: 기존 `.ed-selected`는 점진적 마이그레이션 위해 유지. 새 코드는 `.ed-selected-block` / `.ed-editing-block` 사용.

---

## 5. Undo/Redo 통합

현재 `push()` 함수가 deck 전체 스냅샷 저장. 아래 조작에서 **반드시** `push()` 먼저:
- 삭제
- 이동 시작
- 추가
- 감싸기 / 풀기
- 텍스트 편집 시작 (focus 시 1회)
- 스타일 변경 (색, 폰트, 크기)
- 정렬, z-index 변경

이동 완료 후에는 **별도 push 불필요** — 다음 액션 시작 시점의 `push()`가 이전 상태를 기록하게 되니까.

---

## 6. 키보드 매핑

| 키 | 동작 |
|---|---|
| Click | 한 겹 파고들기 선택 |
| Double-click | EDITING 진입 (= 리프까지 즉시 파고들기) |
| ESC | EDITING→SELECTED, SELECTED→부모 SELECTED, 최상단에서 한 번 더 → IDLE |
| Enter / F2 | SELECTED → EDITING |
| Delete / Backspace | SELECTED면 블럭 삭제 / EDITING이면 글자 삭제 |
| Ctrl/Shift + Delete | EDITING 중에도 블럭 전체 삭제 |
| Ctrl+G | 감싸기 |
| Ctrl+Shift+G | 풀기 |
| Shift+Click | 다중 선택 토글 |
| Ctrl+D | 복제 |
| Ctrl+Z / Ctrl+Shift+Z | undo / redo |

---

## 7. 구현 파일 구조

editor.js 내부에 **블럭 시스템 전용 섹션** 신설:

```
/* ============================================================
   BLOCK SYSTEM v2 — Figma-style nested block selection/editing
   ============================================================ */
const BLOCK = {
  SEL: 'ed-selected-block',
  EDIT: 'ed-editing-block',
  /* 블럭으로 인정하는 selector */
  CONTAINER: '.principle-card, .principle-grid2, .joka-cell, .joka-grid, .card, .num-item, .num-grid, .flow, .flow-step, .two-col, .code-block, .ed-media-wrap',
  LEAF_CLASS: /^(p-|j-)/, /* className 접두사로 리프 감지 */
  TEXT_TAGS: 'h1,h2,h3,p,li,td,th',
};

function isBlock(el) { ... }
function getParentBlock(el) { ... }
function getChildBlockAt(parent, x, y) { ... }
function setSelectedBlock(el, mode='select') { ... }   // mode: 'select' | 'edit'
function clearSelection() { ... }
function deleteBlock(el) { ... }
function insertBlock(type, after) { ... }
function groupBlocks(els) { ... }
function ungroupBlock(el) { ... }
```

이 함수들 외부에선 DOM 직접 조작 금지. 모두 이 API를 거쳐야 함.

---

## 8. 마이그레이션 전략

기존 코드와 충돌 없이:
- 기존 `sel`, `_setSel()`, `.ed-selected`는 **media wrap**용으로만 유지
- 블럭 시스템은 새 `selBlock` 변수 + `.ed-selected-block` / `.ed-editing-block` 클래스 사용
- 두 시스템이 공존하지만 한쪽이 활성화되면 다른 쪽은 clear
- 툴바(showBar)는 두 시스템 모두 호출 가능

Phase 끝날 때마다 기존 media/텍스트 편집이 멀쩡한지 확인.
