# 오른쪽 패널 재설계 — 작업 인수인계 문서

**작성일**: 2026-04-24
**대상**: F:\Claude\PPTX 프로젝트의 오른쪽 사이드 패널 (`<aside class="ed-panel">`)
**목표**: 피그마 스타일의 컨텍스트 전환형 패널로 리팩토링

---

## 1. 배경 — 왜 이 작업이 필요한가

현재 오른쪽 패널은 모든 기능 섹션이 항상 다 보여서 길고 복잡함. 13개 섹션 중 일부는 **다른 메뉴와 중복**이고, 일부는 **거의 안 쓰는 환경설정**임. 또한 **선택한 요소(텍스트/이미지/영상)와 무관하게 같은 메뉴**가 보여서 비효율적.

피그마는 "선택한 대상에 따라 패널 내용이 바뀐다"는 철학을 가짐. 이 도구도 같은 방향으로 가는 게 목표.

---

## 2. 사용자 요구사항 (확정됨)

### 제거할 항목 (다른 곳에 이미 있음)
- **슬라이드 추가** (제목/제목+본문/미디어/파트구분) → 왼쪽 nav에 `+ 새 슬라이드` 있음
- **현재 슬라이드 - 복제/삭제/원본 초기화** → 왼쪽 nav 우클릭 메뉴로 이동
- **실행 취소 (Undo/Redo)** → 단축키로 충분, 메뉴 불필요
- **파일 (Save/Save As/Export/Reset)** → 상단 `ed-file-bar`에 이미 존재

### 이동할 항목
- **원본 초기화** → 왼쪽 슬라이드 리스트의 우클릭 메뉴(`edCtxMenu`)에 추가

### 패널 구조 — 컨텍스트 전환형 (피그마 스타일 v2)

선택 상태에 따라 5가지 컨텍스트로 분기:

| 컨텍스트 | 트리거 조건 | 표시 섹션 |
|--------|----------|---------|
| **none** | 아무것도 선택 안 함 (`sel === null`) | 미디어 삽입, 슬라이드 배경, GRID, 블럭 추가, 단축키 안내 |
| **text** | 텍스트/일반 블럭 선택 (`selBlock`이 media-wrap이 아님) | 📝 텍스트 + 애니메이션 + 정렬 + 레이어 + 복제/삭제 |
| **image** | `.ed-media-wrap > img` 선택 | 🖼 이미지 속성 + 애니메이션 + 정렬 + 레이어 + 복제/삭제 |
| **video** | `.ed-media-wrap > video` or `iframe` 선택 | 🎬 영상 속성(자동재생/루프/음소거) + 애니메이션 + 정렬 + 레이어 + 복제/삭제 |
| **multi** | `selBlocks.length > 1` | ⊟ 다중 + 정렬 + 레이어 + 복제/삭제 |

### 섹션 순서 원칙 (요소 선택 시)
형이 확정한 순서: **[고유 속성] → [애니메이션] → [정렬] → [레이어] → [복제/삭제]**
- 이유: 애니메이션은 "이 요소에만 적용되는 동작"이라 사실상 고유 속성에 가까움 → 위쪽
- 정렬/레이어는 "캔버스 안 어디에 둘지" → 그 다음
- 복제/삭제는 "이 요소 자체에 대한 처리" → 맨 아래

---

## 3. 코드베이스 정찰 메모

### 핵심 파일
- `engine/editor.js` — 117KB, 2,708라인. 한글 코멘트 다수 포함
- `engine/template.html` — 새 프레젠테이션 마스터 템플릿
- `engine/presentation.js` — 슬라이드 네비게이션
- `engine/engine.css` — 스타일
- `save-server.js` — 로컬 저장/Export 서버 (port 3001)

### 패널 마크업 위치
**중요**: 현재 패널 HTML이 **각 프레젠테이션 파일에 하드코딩**되어 있음. `engine/template.html` 외에 다음 파일들에도 같은 마크업이 들어있음:

```
engine/template.html                                              (마스터)
presentations/claude_for_beginners/claude_for_beginners.html
presentations/prompt_engineering/japan.html
presentations/prompt_engineering/prompt_engineering.html
presentations/prompt_engineering/prompt_engineering_origin.html   (export, 인라인 스크립트)
presentations/prompt_engineeringv02/prompt_lecture.html           (export, 인라인 스크립트)
presentations/prompt_engineeringv02/prompt_lecture_original.html  (export, 인라인 스크립트)
presentations/미드저니_나노바나나_그록_활용/미드저니_나노바나나_그록_활용.html
samples/animationsample.html                                       (선택적)
samples/research_sample.html                                       (선택적)
```

이 중 **`*_origin.html`, `prompt_lecture.html`, `prompt_lecture_original.html`** 3개는 export된 self-contained 파일로, `editor.js`/`presentation.js`가 외부 `<script src>` 가 아니라 **인라인으로 통째로 임베드**되어 있음. 이 파일들은 별도 처리 필요.

### editor.js 핵심 후킹 포인트

**선택 상태의 단일 진입점 (가장 중요!)** — 라인 1144:

```javascript
function _setSel(el){
  if(sel&&sel!==el)sel.classList.remove('ed-selected');
  sel=el;
  if(sel&&sel.classList&&sel.classList.contains('ed-media-wrap'))sel.classList.add('ed-selected');
  // ★ 여기에 패널 갱신 호출 추가하면 됨: PanelCtx.refresh();
}
```

**선택 상태 전역 변수** (window 레벨):
- `sel` — 단일 선택 요소
- `selBlock` — 현재 선택된 블럭 (단일)
- `selBlocks` — 다중 선택 배열
- `editingBlock` — 편집 중인 블럭

**EA 객체 노출** — 라인 ~2566:
- 모든 패널 버튼이 호출하는 함수들이 `window.EA.*` 로 노출됨
- 예: `EA.alignEl`, `EA.zIndex`, `EA.applyAnim`, `EA.duplicateEl`, `EA.deleteElement`
- 영상 관련: `EA.toggleVideoAutoplay`, `EA.toggleVideoLoop`, `EA.toggleVideoMute`

**우클릭 메뉴** — 라인 697 `showSlideCtxMenu(x,y,i)`:
```javascript
const items=[
  {icon:'+',label:'뒤에 빈 슬라이드 추가',act:()=>insertBlankAfter(i)},
  {icon:'⧉',label:'슬라이드 복제',act:()=>dupAt(i)},
  {sep:true},
  {icon:'↑',label:'위로 이동',act:()=>moveSlide(i,-1),disabled:i===0},
  {icon:'↓',label:'아래로 이동',act:()=>moveSlide(i,1),disabled:i===n-1},
  {sep:true},
  {icon:'✎',label:'이름 변경',act:()=>renameSlide(i)},
  {sep:true},
  // ★ 여기에 추가: {icon:'↺',label:'원본 초기화',act:()=>resetSlide(i),danger:true,disabled:!origHTML[i]},
  {icon:'✕',label:'슬라이드 삭제',act:()=>delAt(i),danger:true,disabled:n<=1,shortcut:'Ctrl+Z 복구'},
];
```
**참고**: `resetSlide()` 함수가 `pAPI.S.cur` (현재 슬라이드)만 사용하므로 인덱스 인자 받게 시그니처 확장 필요:
```javascript
async function resetSlide(idx){
  const i=(typeof idx==='number')?idx:pAPI.S.cur;
  // 나머지 동일
}
```

### 요소 종류 판별 로직
```javascript
function detectContext(){
  if(window.selBlocks && window.selBlocks.length > 1) return 'multi';
  let s = window.sel || window.selBlock || null;
  if(!s) return 'none';
  if(s.classList && s.classList.contains('ed-media-wrap')){
    if(s.querySelector('img'))    return 'image';
    if(s.querySelector('video'))  return 'video';
    if(s.querySelector('iframe')) return 'video';
    return 'image';
  }
  return 'text';
}
```

---

## 4. 권장 구현 방식 — Hybrid 접근

### 🚨 절대 하지 말 것
- editor.js를 큰 텍스트 블록으로 한 번에 Edit/Write 하지 말 것
- 한글 코멘트가 많은 큰 파일에서 자동화 도구가 끝부분을 잘라내는 사례를 4번 겪음
- 각 변경 후 반드시 `tail`, NULL byte, 문법 체크 3종 검증

### ✅ 권장 순서

#### Step 1: panel-context.js 별도 파일 생성 (editor.js 안 건드림)
- 모든 패널 마크업을 `engine/panel-context.js`에 따로 저장
- IIFE로 감싸서 `window.PanelCtx` 노출
- `<aside class="ed-panel">` 안의 옛 마크업을 init 시점에 비우고 컨텍스트별로 채움
- 선택 변경 감지: `mouseup`/`keyup`/`click` + body class `MutationObserver`
- 안전장치: 모든 EA 호출은 `EA.fn && EA.fn()` 패턴

#### Step 2: HTML 파일에 script 태그 한 줄만 추가
```html
<script src="presentation.js"></script>
<script src="panel-context.js"></script>  <!-- ★ 추가 -->
<script src="editor.js"></script>
```
- 8개 파일 자동 처리 가능, 단 인라인 스크립트 파일 3개는 다른 방식 필요

#### Step 3: editor.js 최소 수정 (선택 사항)
- 정확한 갱신 타이밍 위해 `_setSel(el)` 끝에 한 줄 추가:
  ```javascript
  if(window.PanelCtx&&PanelCtx.refresh)PanelCtx.refresh();
  ```
- 우클릭 메뉴 한 줄 + `resetSlide` 시그니처 확장 1줄

#### Step 4: 인라인 export 파일 처리
3개 파일 (`*_origin.html`, `prompt_lecture.html`, `prompt_lecture_original.html`):
- 가장 깔끔한 방법: `save-server.js`의 export 로직을 수정해서 앞으로 export 시 panel-context.js도 인라인으로 임베드
- 임시 방법: 해당 파일에 panel-context.js 내용을 `<script>` 인라인으로 통째로 넣기

---

## 5. 패널 마크업 (복붙용)

아래 HTML 조각들을 `panel-context.js`의 const 변수로 만들어 사용. **백틱 템플릿 리터럴 안에 넣을 것**:

### 공통 섹션

```html
<!-- SEC_MEDIA -->
<div class="ed-section"><div class="ed-section-title">미디어 삽입</div>
  <button class="ed-btn" onclick="EA.insertImage()"><span class="ed-btn-icon">🖼</span>이미지 (파일)</button>
  <button class="ed-btn" onclick="EA.insertImageURL()"><span class="ed-btn-icon">🔗</span>이미지 (URL)</button>
  <button class="ed-btn" onclick="EA.insertVideo()"><span class="ed-btn-icon">🎬</span>영상 (YouTube)</button>
  <button class="ed-btn" onclick="EA.insertVideoFile()"><span class="ed-btn-icon">📁</span>영상 (파일)</button>
</div>

<!-- SEC_ALIGN -->
<div class="ed-section"><div class="ed-section-title">요소 정렬 (가이드 기준)</div>
  <div class="ed-align-row"><button onclick="EA.alignEl('left')">← 좌</button><button onclick="EA.alignEl('centerH')">↔ 중앙</button><button onclick="EA.alignEl('right')">우 →</button></div>
  <div class="ed-align-row" style="margin-top:4px"><button onclick="EA.alignEl('top')">↑ 상</button><button onclick="EA.alignEl('centerV')">↕ 중앙</button><button onclick="EA.alignEl('bottom')">하 ↓</button></div>
</div>

<!-- SEC_LAYER -->
<div class="ed-section"><div class="ed-section-title">레이어 순서</div>
  <div style="display:flex;gap:5px">
    <button class="ed-btn" style="flex:1;text-align:center" onclick="EA.zIndex(1)">↑ 앞으로</button>
    <button class="ed-btn" style="flex:1;text-align:center" onclick="EA.zIndex(-1)">↓ 뒤로</button>
  </div>
</div>

<!-- SEC_BG -->
<div class="ed-section"><div class="ed-section-title">슬라이드 배경색</div>
  <div style="display:flex;gap:6px;align-items:center">
    <input type="color" id="edSlideBg" value="#000000" onchange="EA.setSlideBg(this.value)" style="width:28px;height:28px;border:none;background:none;cursor:pointer">
    <button class="ed-btn" style="flex:1;text-align:center" onclick="EA.setSlideBg('#000000')">기본(검정)</button>
  </div>
</div>

<!-- SEC_GRID -->
<div class="ed-section"><div class="ed-section-title">Grid 설정</div>
  <div class="ed-grid-row"><label>간격</label><input class="ed-grid-input" id="edGridSize" value="50" onchange="EA.updateGrid()"><label>px</label></div>
  <div class="ed-grid-row"><label>색상</label><input type="color" id="edGridColor" value="#3ECF8E" onchange="EA.updateGrid()" style="width:24px;height:24px;border:none;background:none;cursor:pointer"></div>
  <div class="ed-grid-row"><label>투명</label><input type="range" id="edGridAlpha" min="1" max="30" value="6" oninput="EA.updateGrid()" style="flex:1;cursor:pointer"><span id="edGridAlphaVal" style="font-size:9px;color:var(--grd);min-width:24px">6%</span></div>
</div>

<!-- SEC_ANIM -->
<div class="ed-section"><div class="ed-section-title">애니메이션</div>
  <div class="ed-anim-row">
    <select id="edAnimPreset">
      <option value="">-- 프리셋 선택 --</option>
      <optgroup label="Jiggle (지글링)">
        <option value="jiggle-slow">Jiggle — Slow</option>
        <option value="jiggle-mid">Jiggle — Mid</option>
        <option value="jiggle-fast">Jiggle — Fast</option>
      </optgroup>
      <optgroup label="Blink (깜빡임)">
        <option value="blink-slow">Blink — Slow</option>
        <option value="blink-mid">Blink — Mid</option>
        <option value="blink-fast">Blink — Fast</option>
      </optgroup>
      <optgroup label="Pulse (파도 축소)">
        <option value="pulse-slow">Pulse — Slow</option>
        <option value="pulse-mid">Pulse — Mid</option>
        <option value="pulse-fast">Pulse — Fast</option>
      </optgroup>
    </select>
  </div>
  <div class="ed-anim-row">
    <button class="ed-anim-apply" onclick="EA.applyAnim('block')">블럭 전체 적용</button>
    <button class="ed-anim-apply" onclick="EA.applyAnim('sel')">선택 글자 적용</button>
    <button class="ed-anim-remove" onclick="EA.removeAnim()">제거</button>
  </div>
</div>

<!-- SEC_BLOCK_ADD -->
<div class="ed-section"><div class="ed-section-title">블럭 추가</div>
  <div style="display:flex;gap:4px;flex-wrap:wrap">
    <button class="ed-btn" style="flex:1;min-width:60px" onclick="EA.insertBlock('text')">+ 텍스트</button>
    <button class="ed-btn" style="flex:1;min-width:60px" onclick="EA.insertBlock('heading')">+ 제목</button>
    <button class="ed-btn" style="flex:1;min-width:60px" onclick="EA.insertBlock('card')">+ 카드</button>
  </div>
  <div style="display:flex;gap:4px;margin-top:4px">
    <button class="ed-btn" style="flex:1" onclick="EA.groupSelection()" title="Ctrl+G">⊟ 감싸기</button>
    <button class="ed-btn" style="flex:1" onclick="EA.ungroupSelection()" title="Ctrl+Shift+G">⊡ 풀기</button>
  </div>
  <button class="ed-btn" style="width:100%;margin-top:4px" onclick="EA.resetPosition()" title="Ctrl+0">⟲ 원 위치 복귀</button>
</div>

<!-- SEC_MOVE_HINT -->
<div class="ed-section"><div class="ed-section-title">단축키 안내</div>
  <div style="font-size:10px;color:#888;line-height:1.6;padding:6px 0">
    <div>• <b style="color:#3ECF8E">Space/Alt + 드래그</b>: 이동</div>
    <div>• <b style="color:#3ECF8E">화살표</b>: 1px / Shift: 10px</div>
    <div>• <b style="color:#3ECF8E">더블클릭</b>: 즉시 편집</div>
    <div>• <b style="color:#3ECF8E">Shift+클릭</b>: 다중 선택</div>
    <div>• <b style="color:#3ECF8E">ESC</b>: 한 단계 뒤로</div>
  </div>
</div>

<!-- SEC_DUPE_DEL -->
<div class="ed-section"><div class="ed-section-title">선택 요소</div>
  <div style="display:flex;gap:5px">
    <button class="ed-btn" style="flex:1;text-align:center" onclick="EA.duplicateEl()" title="Ctrl+D"><span class="ed-btn-icon">⊕</span>복제</button>
    <button class="ed-btn danger" style="flex:1;text-align:center" onclick="EA.deleteElement()"><span class="ed-btn-icon">🗑</span>삭제</button>
  </div>
</div>
```

### 고유 속성 섹션

```html
<!-- SEC_TEXT_HINT -->
<div class="ed-section"><div class="ed-section-title" style="color:#3ECF8E">📝 텍스트/블럭 선택됨</div>
  <div style="font-size:10px;color:#888;line-height:1.6;padding:6px 0">
    더블클릭: 텍스트 편집기<br>
    폰트·크기·색상은 TEXT EDITOR 툴바에서 조정
  </div>
</div>

<!-- SEC_IMG_PROPS -->
<div class="ed-section"><div class="ed-section-title" style="color:#3ECF8E">🖼 이미지 선택됨</div>
  <div style="font-size:10px;color:#888;line-height:1.6;padding:6px 0">
    모서리 드래그: 크기 조정<br>
    Space/Alt + 드래그: 이동
  </div>
</div>

<!-- SEC_VIDEO_PROPS -->
<div class="ed-section"><div class="ed-section-title" style="color:#3ECF8E">🎬 영상 선택됨</div>
  <button class="ed-btn" onclick="EA.toggleVideoAutoplay&&EA.toggleVideoAutoplay()"><span class="ed-btn-icon">▶</span>자동재생 토글</button>
  <button class="ed-btn" onclick="EA.toggleVideoLoop&&EA.toggleVideoLoop()"><span class="ed-btn-icon">🔁</span>반복재생 토글</button>
  <button class="ed-btn" onclick="EA.toggleVideoMute&&EA.toggleVideoMute()"><span class="ed-btn-icon">🔇</span>음소거 토글</button>
</div>

<!-- SEC_MULTI_HINT -->
<div class="ed-section"><div class="ed-section-title" style="color:#3ECF8E">⊟ 다중 선택됨</div>
  <div style="font-size:10px;color:#888;line-height:1.6;padding:6px 0" id="pcMultiCount">여러 요소</div>
</div>
```

---

## 6. 컨텍스트별 패널 조합

```javascript
const CONTEXTS = {
  none:  SEC_MEDIA + SEC_BG + SEC_GRID + SEC_BLOCK_ADD + SEC_MOVE_HINT,
  text:  SEC_TEXT_HINT + SEC_ANIM + SEC_ALIGN + SEC_LAYER + SEC_DUPE_DEL,
  image: SEC_IMG_PROPS + SEC_ANIM + SEC_ALIGN + SEC_LAYER + SEC_DUPE_DEL,
  video: SEC_VIDEO_PROPS + SEC_ANIM + SEC_ALIGN + SEC_LAYER + SEC_DUPE_DEL,
  multi: SEC_MULTI_HINT + SEC_ALIGN + SEC_LAYER + SEC_DUPE_DEL,
};
```

---

## 7. 백업 위치

작업 시작 전 v2 백업이 있음 (1단계 시작 직전 = 옛 패널 그대로):
```
F:\Claude\PPTX\backup\panel_v2_before_20260424_030919\
  ├── editor.js
  ├── template.html
  ├── engine.css
  ├── presentations\  (모든 .html 파일)
  └── samples\  (모든 .html 파일)
```

문제 발생 시 이 백업으로 즉시 복원 가능.

---

## 8. 검증 체크리스트

매 변경 후 반드시 확인:

```bash
# 1. NULL byte 검증
python3 -c "print(open('engine/editor.js','rb').read().count(b'\x00'))"  # → 0

# 2. 파일 끝 정상 종료 확인
tail -3 engine/editor.js  # → 의도한 마지막 줄이 보이는지

# 3. JavaScript 문법 검증
cp engine/editor.js /tmp/check.js && node -c /tmp/check.js  # → no errors

# 4. 라인 수 확인 (백업 대비)
wc -l engine/editor.js backup/panel_v2_*/editor.js  # → 거의 같거나 의도한 만큼만 차이
```

브라우저에서 확인:
1. **edit 모드 토글** (E 키) — 가장 기본, 무조건 동작해야 함
2. 빈 곳 클릭 → "none" 컨텍스트 (미디어/배경/Grid/블럭/단축키)
3. 텍스트 클릭 → "text" 컨텍스트 (📝 + 애니메이션 + 정렬 + 레이어 + 복제/삭제)
4. 이미지 클릭 → "image" 컨텍스트 (🖼)
5. 영상 클릭 → "video" 컨텍스트 (🎬 + 자동재생/루프/음소거 토글)
6. Shift+클릭 다중 → "multi" 컨텍스트 (⊟ + 정렬/레이어/복제/삭제)

---

## 9. 사용자(형) 작업 스타일 메모

- 한국어 사용. "ㄱㄱ", "시작해" → 바로 실행
- "고민이야", "어떻게" → 소크라테스 모드 (질문으로 유도)
- 직설적 피드백 선호. 변명 싫어함
- 동작하지 않는 결과물에 매우 민감 — **edit 모드 같은 기본 기능을 깨면 신뢰 즉시 잃음**
- 큰 변경보다 **점진적이고 안전한** 변경 선호
- 백업/롤백 가능 상태 항상 유지

---

## 10. 한 줄 요약

> "editor.js는 한 글자도 건드리지 않고, panel-context.js라는 별도 파일을 만들어 `<script>` 태그 한 줄만 HTML에 추가하는 방식으로 구현. 매 단계마다 NULL byte와 파일 끝 검증 필수."
