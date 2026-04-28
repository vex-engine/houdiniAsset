# 블럭 시스템 v2.1 — Group / Auto-Layout / Component / Constraints

> **목적**: 그림 1처럼 "카드 안에 카드(중첩)" 구조를 멀티셀렉트 패널에서 1클릭으로 만들고, 풀고, 자동 정렬하기.
>
> **작성**: 2026-04-25
> **선행 문서**: `BLOCK_SYSTEM.md` (v1.1) — 본 문서는 그 위에 얹는 증분 설계
> **파일**: `editor.js`, `panel-context.js`, `engine.css`, `presentation.js` (해당 없음)
> **하위호환**: 기존 `groupBlocksWrap` / `ungroupBlockUnwrap` API는 유지하고, 내부 구현만 강화한다.

---

## 0. 현재 시스템에서 발견한 결함 (왜 이 작업이 필요한가)

| # | 결함 | 영향 |
|---|---|---|
| D1 | `groupBlocksWrap`가 항상 `card ed-group` 클래스로만 래핑 | Frame(투명 컨테이너) 옵션 없음 |
| D2 | 새 부모의 `data-step`을 첫 자식 거 그대로 복제 | wrap 직후 step 시퀀스 망가짐 (부모와 자식이 동시 등장 후, 자식들도 따로 등장) |
| D3 | wrap 시 `data-anim-children="seq"` 자동 부여 안 함 | 그루핑한 의미가 살지 않음 — 사용자가 패널에서 다시 체크해야 함 |
| D4 | 자식들이 `style.left/top`으로 절대좌표를 가지면 wrap 후 위치 깨짐 | 그림 1의 "카드 안 카드"가 의도된 위치에 안 놓임 |
| D5 | `ungroupBlockUnwrap`가 `data-step-auto="1"` 정리 안 함 | unwrap 후 자동 step 잔재 |
| D6 | multi-select 컨텍스트 패널(`SEC_MULTI_HINT`)에 Group/Ungroup 버튼 없음 (그림 2 원인) | 사용자가 멀티셀렉트하면 패널에서 그루핑 액션 발견 불가 |
| D7 | Auto Layout 컨셉 없음 (Gap/Padding/Direction) | wrap 후 자식 추가/삭제 시 부모가 자동 재계산 못 함 |

본 spec은 D1~D7을 **하드코딩 없이** 한 번에 해결한다.

---

## 1. 데이터 모델 — DOM 속성으로 표현 (state는 DOM에 산다)

> **원칙**: 모든 새 기능 상태는 **DOM data-attribute**에만 저장. JS 전역변수에 동기화하는 별도 모델 만들지 말 것 (undo/redo가 deck 스냅샷이라 자동으로 따라옴).

### 1.1 Wrap 모드 (Card vs Frame)

```html
<div class="card ed-group" data-group-mode="card">      <!-- 시각 스타일 있음 -->
<div class="ed-group ed-group-frame" data-group-mode="frame">  <!-- 투명 -->
```

- `data-group-mode`: `"card"` | `"frame"`. 디폴트 `"card"`.
- `ed-group`은 항상 붙음 → 식별자 (Unwrap 대상 판별)
- `ed-group-frame`은 frame 모드일 때만 붙음 → CSS 분기

### 1.2 Auto Layout

```html
<div class="card ed-group" 
     data-layout="v"           <!-- "v" | "h" | "" (off) -->
     data-gap="12"             <!-- px, integer -->
     data-pad="16"             <!-- px, integer (단축: T=R=B=L) -->
     data-pad-t="16"           <!-- 개별 지정 시만 부여 (없으면 data-pad 폴백) -->
     data-pad-r="16"
     data-pad-b="16"
     data-pad-l="16"
     data-align="stretch">     <!-- "start" | "center" | "end" | "stretch" -->
```

- `data-layout` 없으면 free-form (자식들이 절대좌표 가능). 있으면 CSS Flex로 자동 정렬.
- `data-gap`/`data-pad` 없으면 CSS 디폴트(0/0) 사용. **JS는 절대 px 값을 inline style로 박지 않는다** — CSS variable로 전달.

### 1.3 Component / Instance (P1)

```html
<!-- 마스터 -->
<div class="card ed-component" data-component-id="cmp-7f3a">
  ...
</div>

<!-- 인스턴스 -->
<div class="card ed-instance" data-instance-of="cmp-7f3a">
  ...
</div>
```

- 마스터 편집 → MutationObserver로 모든 인스턴스에 `outerHTML` 동기화 (단, `data-instance-of` 속성과 인스턴스 위치는 보존)
- Detach: 인스턴스에서 `data-instance-of` 제거 + `ed-instance` 클래스 제거

### 1.4 Constraints (P2)

```html
<div class="card" 
     data-constrain-h="left"      <!-- "left"|"center"|"right"|"l-r"|"scale" -->
     data-constrain-v="top">      <!-- "top"|"center"|"bottom"|"t-b"|"scale" -->
```

- 부모 리사이즈 시 자식 위치/크기 재계산하는 ResizeObserver 훅에서 사용
- 디폴트(속성 없음) = `left` + `top` (현재 동작)

---

## 2. API 명세 — `editor.js` 내부 함수

> 외부 호출은 `EA.*`만 사용. 새 함수는 BLOCK 객체 근처(파일 상단)에 모은다.

### 2.1 핵심 신규 함수

```js
/* 멀티셀렉트 wrap — 옵션 객체로 모드 분기 */
function wrapBlocks(els, opts = {})
//   opts.mode: 'card' | 'frame'  (default: 'card')
//   opts.layout: 'v' | 'h' | null (default: null)
//   opts.autoSeq: boolean         (default: true — data-anim-children="seq" 자동 부여)
//   opts.padding: number | null   (default: 16)
//   opts.gap: number | null       (default: 12)
// → 새 부모 element 반환 (selected 상태로)

/* 풀기 — 자동 step 잔재 정리 포함 */
function unwrapBlock(el)
// → 자식들을 조부모로 승격, el 제거. data-step-auto 정리.

/* Auto-layout 속성 setter (개별) */
function setLayoutDirection(el, dir)   // 'v' | 'h' | '' 
function setLayoutGap(el, px)          // number | null (null이면 속성 제거)
function setLayoutPadding(el, t, r, b, l)  // px (4개 같으면 data-pad 하나만)
function setLayoutAlign(el, align)     // 'start'|'center'|'end'|'stretch'

/* Component */
function makeComponent(el)             // → componentId 반환
function detachInstance(el)            // 인스턴스 → 자유 카드
function syncInstancesOf(componentId)  // 마스터 → 모든 인스턴스 동기화

/* Constraints */
function setConstraint(el, axis, value)  // axis: 'h'|'v', value: ...
```

### 2.2 기존 함수의 백워드 호환 래퍼

```js
// 기존 API 유지 — 내부에서 wrapBlocks/unwrapBlock 호출
function groupBlocksWrap(els){ return wrapBlocks(els, { mode:'card', layout:null, autoSeq:true }); }
function ungroupBlockUnwrap(el){ return unwrapBlock(el); }
```

기존 호출자(`Ctrl+G`, EA.groupSelection)는 **수정 불필요**.

### 2.3 EA.* 신규 노출

```js
window.EA = {
  ...기존,
  // P0
  wrapAsCard:   ()=>wrapBlocks(_currentTargets(), {mode:'card',  autoSeq:true}),
  wrapAsFrame:  ()=>wrapBlocks(_currentTargets(), {mode:'frame', autoSeq:false}),
  unwrapBlock:  ()=>{ const t = selBlock; if(t) unwrapBlock(t); },
  setLayout:    (dir)=>{ const t=selBlock; if(t) setLayoutDirection(t, dir); },
  setGap:       (px)=>{ const t=selBlock; if(t) setLayoutGap(t, px); },
  setPadding:   (t,r,b,l)=>{ const x=selBlock; if(x) setLayoutPadding(x,t,r,b,l); },
  setAlign:     (a)=>{ const t=selBlock; if(t) setLayoutAlign(t, a); },
  // P1
  makeComponent:    ()=>{ const t=selBlock; if(t) makeComponent(t); },
  detachInstance:   ()=>{ const t=selBlock; if(t) detachInstance(t); },
  // P2
  setConstraintH:   (v)=>{ const t=selBlock; if(t) setConstraint(t,'h',v); },
  setConstraintV:   (v)=>{ const t=selBlock; if(t) setConstraint(t,'v',v); },
};
```

---

## 3. 알고리즘 디테일 (TD 관점에서 빼먹으면 버그 나는 것들)

### 3.1 wrapBlocks 단계별

```
1. push() — undo 스냅샷
2. els 정렬: DOM 순서대로 (멀티셀렉트는 클릭 순서일 수 있음)
3. 첫 요소(first)의 부모를 보존 (= newParent의 삽입 위치)
4. newParent 생성:
   - className: opts.mode==='card' ? 'card ed-group' : 'ed-group ed-group-frame'
   - data-group-mode = opts.mode
   - data-step = max(els의 data-step) + 1   ← 자식들 다 보인 다음 부모가 등장
                 (단, autoSeq=true면 부모 step은 첫 자식보다 -1 해서 부모가 먼저 등장하도록)
5. autoSeq: opts.autoSeq && els.length>=2 일 때
   - newParent.setAttribute('data-anim-children','seq')
   - 기존 자식들의 data-step은 보존 (presentation.js의 stepAuto 시스템이 정리해줌)
6. layout 옵션:
   - if opts.layout: setAttr 'data-layout', 'data-gap', 'data-pad', 'data-align'
7. first.parentElement.insertBefore(newParent, first)
8. els.forEach(e => newParent.appendChild(e))
9. 자식 좌표 normalize:
   - 각 자식이 style.left/top을 가지고 있고 layout이 켜져 있으면
     → style.left/top/position/transform 전부 제거 (auto-layout이 위치 잡음)
   - layout이 꺼져 있으면 (frame 모드 디폴트) → 자식 좌표 보존
10. attachHandles(); on(); setBlockState(newParent,'select'); showBar(newParent)
11. _setDirty(true); pAPI.reinit()  ← data-step 재계산 (autoSeq 활성화 위해)
12. msg('Wrap: ' + opts.mode)
```

### 3.2 unwrapBlock 단계별

```
1. push()
2. isLeafBlock(el) 이면 abort (자식 없음)
3. parent = el.parentElement
4. kids = el.children에서 ARTIFACT_SEL 제외
5. kids 각각 정리:
   - data-step-auto="1" 면 data-step 제거 (조부모 컨텍스트에선 자동 step이 무효)
6. kids를 parent.insertBefore(k, el)로 승격 (DOM 순서 유지)
7. el.remove()
8. attachHandles(); on(); setBlockState(null,'idle')
9. _setDirty(true); pAPI.reinit()
```

### 3.3 deleteBlockClean — 기존 함수, 수정 불필요

`ed-group`이든 일반 카드든 동일하게 동작. ARTIFACT_SEL 정리 + remove + 핸들 재동기화. 

**단, 회귀 테스트 항목 추가**:
- `ed-group` 컨테이너 삭제 시 자식들도 함께 삭제 (DOM 트리 자체가 사라짐) — OK
- `ed-instance` 삭제 시 마스터는 보존 — OK
- `ed-component` (마스터) 삭제 시 → confirmDlg로 "인스턴스 N개도 함께 사라집니다" 경고 후 진행

→ deleteBlockClean에 **컴포넌트 가드** 추가 필요 (3.5 참조).

### 3.4 setLayout* 함수들 — CSS 변수 전달

```js
function setLayoutDirection(el, dir){
  push();
  if(dir) el.setAttribute('data-layout', dir);
  else    el.removeAttribute('data-layout');
  _setDirty(true);
}
function setLayoutGap(el, px){
  push();
  if(px==null||px==='') el.removeAttribute('data-gap');
  else el.setAttribute('data-gap', String(parseInt(px,10)||0));
  el.style.setProperty('--ed-gap', (parseInt(px,10)||0)+'px');
  _setDirty(true);
}
function setLayoutPadding(el, t, r, b, l){
  push();
  if(t===r && r===b && b===l && t!=null){
    el.setAttribute('data-pad', String(t));
    ['t','r','b','l'].forEach(k=>el.removeAttribute('data-pad-'+k));
  } else {
    el.removeAttribute('data-pad');
    [['t',t],['r',r],['b',b],['l',l]].forEach(([k,v])=>{
      if(v==null) el.removeAttribute('data-pad-'+k);
      else el.setAttribute('data-pad-'+k, String(v));
    });
  }
  // CSS variable 4개 모두 갱신
  el.style.setProperty('--ed-pad-t', (t??0)+'px');
  el.style.setProperty('--ed-pad-r', (r??0)+'px');
  el.style.setProperty('--ed-pad-b', (b??0)+'px');
  el.style.setProperty('--ed-pad-l', (l??0)+'px');
  _setDirty(true);
}
```

CSS 쪽이 이 변수들을 받아 flex-direction / gap / padding을 적용. **JS는 attribute만 박고 시각 적용은 CSS가 한다** (관심사 분리).

### 3.5 makeComponent / syncInstancesOf

```js
function makeComponent(el){
  push();
  const id = 'cmp-' + Math.random().toString(36).slice(2,8);
  el.classList.add('ed-component');
  el.setAttribute('data-component-id', id);
  msg('Component 생성: ' + id);
  _setDirty(true);
  return id;
}

// 마스터 변경 감지 → 인스턴스 동기화 (디바운스 300ms)
const _cmpObserver = new MutationObserver(_.debounce(muts => {
  const dirtyIds = new Set();
  muts.forEach(m => {
    const cmp = m.target.closest && m.target.closest('.ed-component[data-component-id]');
    if(cmp) dirtyIds.add(cmp.getAttribute('data-component-id'));
  });
  dirtyIds.forEach(syncInstancesOf);
}, 300));
_cmpObserver.observe(deck, { childList:true, subtree:true, characterData:true, attributes:true });

function syncInstancesOf(id){
  const master = deck.querySelector('.ed-component[data-component-id="'+CSS.escape(id)+'"]');
  if(!master) return;
  const instances = deck.querySelectorAll('.ed-instance[data-instance-of="'+CSS.escape(id)+'"]');
  instances.forEach(inst => {
    // 인스턴스 위치/크기는 보존, 내용물만 교체
    const savedPos = { left:inst.style.left, top:inst.style.top, width:inst.style.width, height:inst.style.height };
    inst.innerHTML = master.innerHTML;
    Object.assign(inst.style, savedPos);
  });
}
```

**deleteBlockClean에 컴포넌트 가드 추가**:
```js
function deleteBlockClean(el){
  if(!el) return;
  if(el.classList.contains('ed-component')){
    const id = el.getAttribute('data-component-id');
    const n = deck.querySelectorAll('.ed-instance[data-instance-of="'+CSS.escape(id)+'"]').length;
    if(n>0 && !await confirmDlg('이 컴포넌트의 인스턴스 '+n+'개도 함께 삭제됩니다. 계속할까요?')) return;
  }
  // ... 기존 로직 ...
}
```

### 3.6 setConstraint — ResizeObserver 훅

```js
function setConstraint(el, axis, value){
  push();
  el.setAttribute('data-constrain-' + axis, value);
  _setDirty(true);
}

// 부모 카드(ed-group)에 ResizeObserver 부착
function _observeConstraints(parent){
  if(parent._edRO) return;
  parent._edRO = new ResizeObserver(entries => {
    entries.forEach(e => _applyConstraints(e.target));
  });
  parent._edRO.observe(parent);
}
function _applyConstraints(parent){
  // 자식들 중 constraint 속성이 있는 것만 재배치
  // ... (P2이므로 본 spec에선 함수 시그니처만 정의)
}
```

---

## 4. CSS 명세 — `engine.css` 추가 블록

```css
/* ============================================================
   BLOCK SYSTEM v2.1 — Group / Auto-Layout / Component / Constraints
   상태는 DOM data-attribute, 시각은 모두 여기서 처리.
   ============================================================ */

/* ── Group (Card vs Frame) ── */
.ed-group{
  /* 공통: 자식 hierarchy 보이게 살짝 밝은 border (디폴트 card 톤보다 한 톤 위) */
  position: relative;
}
.ed-group[data-group-mode="frame"]{
  background: transparent !important;
  border: 1px dashed rgba(62,207,142,.25);
  /* 에디터 모드에서만 점선 보이게 */
}
body:not(.editor-mode) .ed-group[data-group-mode="frame"]{
  border-color: transparent;
}

/* ── Auto Layout: Direction ── */
.ed-group[data-layout="v"]{
  display: flex;
  flex-direction: column;
}
.ed-group[data-layout="h"]{
  display: flex;
  flex-direction: row;
}

/* Gap & Padding via CSS variables (JS가 setProperty로 주입) */
.ed-group[data-layout]{
  gap: var(--ed-gap, 0);
  padding-top:    var(--ed-pad-t, var(--ed-pad, 0));
  padding-right:  var(--ed-pad-r, var(--ed-pad, 0));
  padding-bottom: var(--ed-pad-b, var(--ed-pad, 0));
  padding-left:   var(--ed-pad-l, var(--ed-pad, 0));
}
/* data-pad 단축 — 4방향 동일할 때 */
.ed-group[data-pad]{
  --ed-pad: attr(data-pad px);  /* fallback: JS의 setProperty가 우선 */
}

/* Align (cross-axis) */
.ed-group[data-layout][data-align="start"]   { align-items: flex-start; }
.ed-group[data-layout][data-align="center"]  { align-items: center; }
.ed-group[data-layout][data-align="end"]     { align-items: flex-end; }
.ed-group[data-layout][data-align="stretch"] { align-items: stretch; }

/* ── Component / Instance 표시 (에디터 모드만) ── */
body.editor-mode .ed-component{
  outline: 1px dashed rgba(124,176,255,.5);
  outline-offset: 4px;
}
body.editor-mode .ed-component::before{
  content: '◇ Master';
  position: absolute;
  top: -18px; left: 0;
  font: 10px/1 'JetBrains Mono', monospace;
  color: rgba(124,176,255,.8);
  pointer-events: none;
}
body.editor-mode .ed-instance{
  outline: 1px dotted rgba(124,176,255,.4);
  outline-offset: 4px;
}
body.editor-mode .ed-instance::before{
  content: '◈ Instance';
  position: absolute;
  top: -18px; left: 0;
  font: 10px/1 'JetBrains Mono', monospace;
  color: rgba(124,176,255,.6);
  pointer-events: none;
}

/* ── 패널 신규 컨트롤 ── */
.pc-num-input{
  width: 48px;
  padding: 4px 6px;
  background: var(--ui-bg-2);
  border: 1px solid var(--ui-bdr);
  border-radius: 4px;
  color: var(--ui-text);
  font: 11px/1.2 'JetBrains Mono', monospace;
  text-align: right;
}
.pc-num-input:focus{
  outline: none;
  border-color: var(--ui-accent-bdr);
}
.pc-pad-grid{
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 4px;
}
.pc-pad-grid label{
  font: 9px/1 'JetBrains Mono', monospace;
  color: var(--ui-text-2);
  text-align: center;
  margin-bottom: 2px;
}
.pc-direction-row{
  display: flex;
  gap: 4px;
}
.pc-direction-row button{
  flex: 1;
  padding: 6px;
  background: var(--ui-bg-2);
  border: 1px solid var(--ui-bdr);
  border-radius: 4px;
  color: var(--ui-text);
  font-size: 11px;
  cursor: pointer;
}
.pc-direction-row button.active{
  background: var(--ui-accent-bg);
  border-color: var(--ui-accent-bdr);
  color: var(--g);
}
```

---

## 5. 패널 UI 명세 — `panel-context.js` 추가/수정

### 5.1 신규 섹션

```js
// 멀티셀렉트일 때 — Wrap 액션
const SEC_GROUP_ACTIONS = ''
+ '<div class="ed-section"><div class="ed-section-title">Group</div>'
+ '  <div style="display:flex;gap:5px">'
+ '    <button class="ed-btn" style="flex:1" onclick="EA.wrapAsCard&&EA.wrapAsCard()" title="W">⊟ Wrap in Card</button>'
+ '    <button class="ed-btn" style="flex:1" onclick="EA.wrapAsFrame&&EA.wrapAsFrame()" title="Shift+W">⊡ Wrap in Frame</button>'
+ '  </div>'
+ '  <button class="ed-btn" style="width:100%;margin-top:4px" onclick="EA.unwrapBlock&&EA.unwrapBlock()" title="Ctrl+Shift+G">↗ Unwrap</button>'
+ '</div>';

// 단일 ed-group 선택일 때만 — Auto Layout
const SEC_AUTO_LAYOUT = ''
+ '<div class="ed-section" id="pcAutoLayoutSec"><div class="ed-section-title">Auto Layout</div>'
+ '  <div class="pc-direction-row" style="margin-bottom:8px">'
+ '    <button id="pcLayH"  onclick="EA.setLayout&&EA.setLayout(\'h\')">→ H</button>'
+ '    <button id="pcLayV"  onclick="EA.setLayout&&EA.setLayout(\'v\')">↓ V</button>'
+ '    <button id="pcLayOff" onclick="EA.setLayout&&EA.setLayout(\'\')">Off</button>'
+ '  </div>'
+ '  <div class="pc-row" style="margin-bottom:8px">'
+ '    <label class="pc-label">Gap</label>'
+ '    <input class="pc-num-input" id="pcGap" placeholder="0" onchange="EA.setGap&&EA.setGap(this.value)">'
+ '    <label class="pc-label">px</label>'
+ '  </div>'
+ '  <div style="margin-bottom:6px"><label class="pc-label">Padding</label></div>'
+ '  <div class="pc-pad-grid">'
+ '    <div><label>T</label><input class="pc-num-input" id="pcPadT" placeholder="0"></div>'
+ '    <div><label>R</label><input class="pc-num-input" id="pcPadR" placeholder="0"></div>'
+ '    <div><label>B</label><input class="pc-num-input" id="pcPadB" placeholder="0"></div>'
+ '    <div><label>L</label><input class="pc-num-input" id="pcPadL" placeholder="0"></div>'
+ '  </div>'
+ '  <div style="display:flex;gap:4px;margin-top:8px">'
+ '    <button class="ed-btn" style="flex:1;font-size:10px" onclick="PanelCtx._applyPad(\'start\')">Start</button>'
+ '    <button class="ed-btn" style="flex:1;font-size:10px" onclick="PanelCtx._applyPad(\'center\')">Center</button>'
+ '    <button class="ed-btn" style="flex:1;font-size:10px" onclick="PanelCtx._applyPad(\'end\')">End</button>'
+ '    <button class="ed-btn" style="flex:1;font-size:10px" onclick="PanelCtx._applyPad(\'stretch\')">Stretch</button>'
+ '  </div>'
+ '</div>';

// 컴포넌트
const SEC_COMPONENT = ''
+ '<div class="ed-section"><div class="ed-section-title">Component</div>'
+ '  <button class="ed-btn" style="width:100%" onclick="EA.makeComponent&&EA.makeComponent()" title="Ctrl+Alt+K">◇ Create Component</button>'
+ '  <button class="ed-btn" style="width:100%;margin-top:4px" onclick="EA.detachInstance&&EA.detachInstance()" title="Ctrl+Alt+B">◈ Detach Instance</button>'
+ '</div>';

// Constraints
const SEC_CONSTRAINTS = ''
+ '<div class="ed-section"><div class="ed-section-title">Constraints</div>'
+ '  <div class="pc-row" style="margin-bottom:6px">'
+ '    <label class="pc-label" style="min-width:18px">H</label>'
+ '    <select class="pc-size-select" onchange="EA.setConstraintH&&EA.setConstraintH(this.value)">'
+ '      <option value="left">Left</option><option value="center">Center</option>'
+ '      <option value="right">Right</option><option value="l-r">L+R</option><option value="scale">Scale</option>'
+ '    </select>'
+ '  </div>'
+ '  <div class="pc-row">'
+ '    <label class="pc-label" style="min-width:18px">V</label>'
+ '    <select class="pc-size-select" onchange="EA.setConstraintV&&EA.setConstraintV(this.value)">'
+ '      <option value="top">Top</option><option value="center">Center</option>'
+ '      <option value="bottom">Bottom</option><option value="t-b">T+B</option><option value="scale">Scale</option>'
+ '    </select>'
+ '  </div>'
+ '</div>';
```

### 5.2 컨텍스트 매핑 변경

```js
const CONTEXTS = {
  none:  SEC_MEDIA + SEC_BG + SEC_GRID + SEC_BLOCK_ADD + SEC_MOVE_HINT,
  text:  SEC_TEXT_HINT + SEC_TEXT_EDITOR + SEC_TEXT_ADVANCED + SEC_ANIM_CHILDREN + SEC_ANIM 
       + SEC_ALIGN + SEC_LAYER + SEC_CONSTRAINTS + SEC_DUPE_DEL,
  image: SEC_IMG_PROPS + SEC_ANIM_CHILDREN + SEC_ANIM + SEC_ALIGN + SEC_LAYER + SEC_CONSTRAINTS + SEC_DUPE_DEL,
  video: SEC_VIDEO_PROPS + SEC_ANIM_CHILDREN + SEC_ANIM + SEC_ALIGN + SEC_LAYER + SEC_CONSTRAINTS + SEC_DUPE_DEL,
  multi: SEC_MULTI_HINT + SEC_GROUP_ACTIONS + SEC_ALIGN + SEC_LAYER + SEC_DUPE_DEL,
  group: SEC_GROUP_ACTIONS + SEC_AUTO_LAYOUT + SEC_COMPONENT + SEC_ANIM_CHILDREN + SEC_ALIGN + SEC_LAYER + SEC_CONSTRAINTS + SEC_DUPE_DEL,
};
```

### 5.3 `detectContext` 확장

```js
function detectContext(el, selBlocks, selBlock){
  try{
    const blocks = selBlocks || window._edSelBlocks || window.selBlocks || null;
    if(blocks && blocks.length > 1) return 'multi';
    const s = el || selBlock || window.sel || window.selBlock || null;
    if(!s) return 'none';
    /* NEW: ed-group이면 group 컨텍스트 (Auto Layout 노출) */
    if(s.classList && s.classList.contains('ed-group')) return 'group';
    if(s.classList && s.classList.contains('ed-media-wrap')){
      if(s.querySelector('img'))    return 'image';
      if(s.querySelector('video'))  return 'video';
      if(s.querySelector('iframe')) return 'video';
      return 'image';
    }
    return 'text';
  }catch(e){ return 'none'; }
}
```

### 5.4 group 컨텍스트 진입 시 입력값 동기화

```js
function updateAutoLayoutUI(el){
  if(!el || !el.classList.contains('ed-group')) return;
  const layout = el.getAttribute('data-layout') || '';
  ['pcLayH','pcLayV','pcLayOff'].forEach(id => {
    const b = document.getElementById(id);
    if(b) b.classList.remove('active');
  });
  if(layout==='h')      document.getElementById('pcLayH')?.classList.add('active');
  else if(layout==='v') document.getElementById('pcLayV')?.classList.add('active');
  else                  document.getElementById('pcLayOff')?.classList.add('active');
  
  const gap = el.getAttribute('data-gap') || '';
  const inp = document.getElementById('pcGap');
  if(inp) inp.value = gap;
  
  const pad = el.getAttribute('data-pad');
  ['t','r','b','l'].forEach(k => {
    const id = 'pcPad' + k.toUpperCase();
    const v = el.getAttribute('data-pad-'+k) ?? pad ?? '';
    const e = document.getElementById(id);
    if(e) e.value = v;
  });
}
// render() 끝에 ctx === 'group' 이면 updateAutoLayoutUI(el) 호출
```

---

## 6. 단축키 — `단축키.md`에 추가

> **충돌 회피**: 형 에디터의 기존 `G`(Grid 토글)와 안 겹치게.

| 키 | 동작 | 비고 |
|---|---|---|
| **W** | Wrap in Card (현재 선택을 Card로 감싸기) | 신규 |
| **Shift+W** | Wrap in Frame (투명 컨테이너) | 신규 |
| `Ctrl+G` | (기존) Wrap = `wrapAsCard` 별칭 | 유지 — 피그마 호환 |
| `Ctrl+Shift+G` | (기존) Unwrap | 유지 |
| **Ctrl+Alt+K** | Create Component | 신규 (P1) |
| **Ctrl+Alt+B** | Detach Instance | 신규 (P1) |

editor.js의 keydown 핸들러에 추가 (기존 패턴 따라):

```js
// 기존 Ctrl+G 핸들러 근처에 추가
if(!editingBlock && (e.key==='w'||e.key==='W') && !e.ctrlKey && !e.metaKey){
  if(e.shiftKey){ if(selBlocks.length||selBlock){ e.preventDefault(); EA.wrapAsFrame(); return; } }
  else          { if(selBlocks.length||selBlock){ e.preventDefault(); EA.wrapAsCard();  return; } }
}
```

---

## 7. 엣지케이스 / 회귀 테스트 항목

| # | 케이스 | 기대 동작 |
|---|---|---|
| E1 | wrap 후 즉시 undo | 원래 자식들이 wrap 이전 위치/스타일로 복원 |
| E2 | wrap → 자식 하나 삭제 | 부모 ed-group 살아남음. autoSeq면 step 자동 재계산 |
| E3 | wrap → 부모 삭제 (Delete) | 자식들도 함께 삭제 (트리 사라짐). msg 표시 |
| E4 | wrap → 패널에서 Layout V 켜기 | 자식들이 세로로 정렬, gap 적용 |
| E5 | Layout 켜진 ed-group → 자식 절대좌표 가짐 | 자식 좌표 무시되고 flex가 자리 잡음 (정상) |
| E6 | Layout 켜진 상태에서 Off로 토글 | flex 해제. 자식들은 정렬된 위치를 그대로 유지(절대좌표 부여 X — 사용자가 다시 잡음) |
| E7 | nested ed-group (그룹 안의 그룹) | 클릭 시 한 겹 파고들기 정상. 외곽 그룹 우선 선택 |
| E8 | wrap한 ed-group을 다시 wrap | 또 다른 ed-group으로 감싸짐 (계층 +1). isLeafBlock 정상 |
| E9 | unwrap 후 redo | wrap 상태 복원 |
| E10 | data-anim-children="seq"가 켜진 ed-group → 슬라이드 전환 | 자식들이 차례로 등장 (presentation.js의 reveal 흐름 정상) |
| E11 | 컴포넌트 마스터 텍스트 편집 | 모든 인스턴스가 300ms 내 동기화 |
| E12 | 인스턴스 삭제 | 마스터 보존, 다른 인스턴스 영향 없음 |
| E13 | 컴포넌트 마스터 삭제 | confirmDlg → 진행 시 인스턴스도 삭제 |
| E14 | 멀티셀렉트 (Shift+클릭 3개) → 패널 보면 GROUP 섹션 노출 | 그림 2 결함 해결됨 |
| E15 | wrap 후 슬라이드 전환 → 다시 돌아오기 | autoSeq, layout 등 모든 속성 보존 |
| E16 | save / load (HTML 다운로드 후 재로드) | data-* 속성 모두 보존 (HTML serialize 자연 보존) |
| E17 | ed-group 안에 ed-media-wrap (이미지) | 이미지 절대좌표 모드 정상, ed-group의 layout=off일 때만 |

---

## 8. 마이그레이션 / 하위호환

- 기존 `card ed-group` 클래스를 가진 요소 → `data-group-mode` 자동 부여 1회 (DOMContentLoaded 후 1회 스캔)
- 기존 `data-anim-children="seq"` 사용처 → 변경 없음 (그대로 동작)
- 기존 `groupBlocksWrap` 호출자 → 변경 없음 (내부에서 wrapBlocks로 위임)
- 기존 슬라이드 HTML 파일들 → 변경 없음 (data-* 속성 없으면 디폴트 동작)

---

## 9. 우선순위 / 작업 순서

| Phase | 작업 | 예상 시간 |
|---|---|---|
| **P0a** | `wrapBlocks` / `unwrapBlock` 강화 + `data-anim-children="seq"` 자동 부여 + multi 컨텍스트에 GROUP 섹션 | 60분 |
| **P0b** | Auto Layout (CSS + 패널 UI + setLayout* 함수들) + group 컨텍스트 신설 | 90분 |
| **P1** | Component / Instance + MutationObserver 동기화 + deleteBlockClean 가드 | 60분 |
| **P2** | Constraints (속성/패널만, 실제 ResizeObserver 적용은 후속) | 30분 |

본 spec은 P0~P2 모두 단일 PR로 묶어도 안전 (서로 독립적인 DOM 속성 사용).
