/* =========================================================================
   editor.core.js — CONFIG/STATE/DOM/PALETTE/HELPERS/NAV/SLIDE/EDITABLES
                    MEDIA WRAP/I-O/TOOLBAR/SEL-OVERLAY/UNDO
   Load order: 1st (must be before block/io/main)
   Originally part of editor.js (split 2026-04-24).
   ========================================================================= */
/* >>> editor.js original lines 1-40 >>> */
'use strict';

/* ============================================================
   CONFIGURATION — All magic numbers in one place
   ============================================================ */
const CFG={
  CANVAS_W:       1920,     // fixed canvas width (px)
  CANVAS_H:       1080,     // fixed canvas height (px)
  MAX_UNDO:       15,       // undo/redo stack depth
  SNAP_PX:        8,        // snap-to-guide distance
  TOAST_MS:       1800,     // toast display duration
  NAV_TITLE_LEN:  28,       // nav title truncation
  MAX_CUSTOM_PAL: 9,        // max custom palette colors
  IMG_DEFAULT_W:  '400px',  // default inserted image width
  VID_DEFAULT_W:  '640px',  // default inserted video width
  MEDIA_MIN_W:    60,       // min resize width
  MEDIA_RADIUS:   '8px',    // border-radius for media
  NUDGE_SM:       1,        // arrow key move (px)
  NUDGE_LG:       10,       // shift+arrow key move (px)
  ZINDEX_STEP:    10,       // z-index increment per click
  DUP_OFFSET:     20,       // duplicate element offset (px)
  TB_OFFSET_TOP:  120,      // toolbar distance above element
  TB_OFFSET_BOT:  20,       // toolbar distance below element
  TB_HALF_W:      260,      // half toolbar width for centering
  TB_MIN_LEFT:    250,      // min toolbar left (avoids nav)
  CSS_SPLIT_MARK: '/* ====',// marker for CSS split on download
  LS_PALETTE:     'ed_pal', // localStorage key: palette
  LS_TOOLBAR:     'ed_tb',  // localStorage key: toolbar pos
  LS_SAVE:        'ed_save',// localStorage key: saved deck HTML
  LS_HASH:        'ed_save_hash',// localStorage key: deck hash for cache invalidation
  SAVE_API:       'http://127.0.0.1:3001', // 로컬 저장 API 서버
};

/* ============================================================
   STATE
   ============================================================ */
const undoStack=[],redoStack=[];
let sel=null, dragIdx=null, sizeMode='block', tbClosed=false;

/* <<< end 1-40 <<< */
/* >>> editor.js original lines 495-829 >>> */
/* push()가 호출될 때마다 dirty = true */
const $=id=>document.getElementById(id);
const toolbar=$('edToolbar'), tbDrag=$('edToolbarDrag'), navList=$('edNavList'), toast=$('edToast');
const fImg=$('edFileImg'), fVid=$('edFileVid'), deck=document.querySelector('.slide-deck');
const guide=$('edGuide169'), snapH=$('edSnapH'), snapV=$('edSnapV'), gridEl=$('edGrid');
const origHTML={};
document.querySelectorAll('.slide').forEach((s,i)=>origHTML[i]=s.outerHTML);

/* ============================================================
   DOM 자동 주입 — 기존 프레젠테이션 HTML들은 template 옛 버전을
   복사한 상태이므로, ed-nav-footer(+ 새 슬라이드 버튼)와
   ed-ctx-menu(우클릭 메뉴)가 없을 수 있음. 없으면 여기서 붙임.
   ============================================================ */
function injectEditorDOM(){
  const nav=document.querySelector('.ed-nav');
  if(nav && !nav.querySelector('.ed-nav-footer')){
    const f=document.createElement('div');
    f.className='ed-nav-footer';
    f.innerHTML='<button class="ed-nav-add" title="현재 슬라이드 뒤에 빈 슬라이드 추가">+ 새 슬라이드</button>';
    nav.appendChild(f);
    f.querySelector('.ed-nav-add').addEventListener('click',()=>{
      if(window.EA&&EA.insertBlankAfter)EA.insertBlankAfter();
    });
  }
  if(!document.getElementById('edCtxMenu')){
    const m=document.createElement('div');
    m.className='ed-ctx-menu';m.id='edCtxMenu';
    document.body.appendChild(m);
  }
}
injectEditorDOM();

/* ============================================================
   PALETTE MODULE
   ============================================================ */
const pals={
  green:[{c:'#3ECF8E'},{c:'#5EEAA0'},{c:'#2a8f60'},{c:'#A8F0D4'},{c:'#1B6B4A'},{c:'#0D2818'}],
  gold: [{c:'#D4A843'},{c:'#F0CC6B'},{c:'#A67C2E'},{c:'#F5E6B8'},{c:'#8B6914'},{c:'#2A1F0A'}],
  pink: [{c:'#E05C8A'},{c:'#F07EAA'},{c:'#B03A68'},{c:'#F9B4CF'},{c:'#8C1E4A'},{c:'#2D0A1A'}],
  custom:[{c:'#3ECF8E'},{c:'#5EEAA0'},{c:'#ffffff'},{c:'#888888'},{c:'#ff5f57'},{c:'#febc2e'}]
};
let curPal='green';
try{const s=localStorage.getItem(CFG.LS_PALETTE);if(s)pals.custom=JSON.parse(s)}catch(e){}

function _renderSwInto(c){
  if(!c)return;
  c.innerHTML='';
  pals[curPal].forEach((p,i)=>{
    const b=document.createElement('button');b.className='color-swatch';b.style.background=p.c;b.title=p.c;
    b.onclick=()=>setColor(p.c);
    b.oncontextmenu=e=>{e.preventDefault();if(curPal==='custom'){const v=prompt('HEX:',p.c);if(v&&/^#[0-9a-fA-F]{3,6}$/.test(v)){pals.custom[i].c=v;renderSw()}}};
    c.appendChild(b);
  });
  if(curPal==='custom'&&pals.custom.length<CFG.MAX_CUSTOM_PAL){
    const a=document.createElement('button');a.className='ed-palette-add';a.textContent='+';
    a.onclick=()=>{const p=document.createElement('input');p.type='color';p.value='#ffffff';p.onchange=()=>{pals.custom.push({c:p.value});renderSw()};p.click()};
    c.appendChild(a);
  }
}
function renderSw(){
  _renderSwInto($('edSwatches'));
  _renderSwInto(document.getElementById('pcSwatches'));
}
function setPalette(n){curPal=n;document.querySelectorAll('.ed-palette-tab').forEach(t=>t.classList.toggle('active',t.dataset.pal===n));renderSw()}
window._renderSw=renderSw;
function savePalette(){try{localStorage.setItem(CFG.LS_PALETTE,JSON.stringify(pals.custom));msg('팔레트 저장됨')}catch(e){}}
function loadPalette(){try{const s=localStorage.getItem(CFG.LS_PALETTE);if(s){pals.custom=JSON.parse(s);if(curPal==='custom')renderSw();msg('불러옴')}else msg('없음')}catch(e){}}

/* Save/Load palette as .plt file */
async function savePaletteFile(){
  const data=JSON.stringify({name:'custom',colors:pals.custom},null,2);
  const blob=new Blob([data],{type:'application/json'});
  if(window.showSaveFilePicker&&location.protocol!=='file:'){
    try{
      const h=await window.showSaveFilePicker({suggestedName:'palette.plt',types:[{description:'Palette',accept:{'application/json':['.plt']}}]});
      const w=await h.createWritable();await w.write(blob);await w.close();msg('Save: '+h.name);return;
    }catch(e){if(e.name==='AbortError')return}
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='palette.plt';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);msg('palette.plt 다운로드');
}
function loadPaletteFile(){$('edFilePlt').value='';$('edFilePlt').click()}
$('edFilePlt').addEventListener('change',function(){
  const f=this.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{
    try{
      const d=JSON.parse(e.target.result);
      if(d.colors&&Array.isArray(d.colors)){
        pals.custom=d.colors;
        localStorage.setItem(CFG.LS_PALETTE,JSON.stringify(pals.custom));
        setPalette('custom');msg('Load: '+f.name);
      }else msg('잘못된 .plt 형식');
    }catch(err){msg('파일 읽기 오류')}
  };
  r.readAsText(f);
});

function _gradientPick(barEl,e){
  const r=barEl.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;
  const cv=document.createElement('canvas');cv.width=360;cv.height=1;const ctx=cv.getContext('2d');
  const g=ctx.createLinearGradient(0,0,360,0);
  g.addColorStop(0,'#f00');g.addColorStop(.17,'#f80');g.addColorStop(.33,'#ff0');g.addColorStop(.5,'#0f0');g.addColorStop(.67,'#0ff');g.addColorStop(.83,'#00f');g.addColorStop(1,'#f0f');
  ctx.fillStyle=g;ctx.fillRect(0,0,360,1);
  const p=ctx.getImageData(Math.round(x*359),0,1,1).data;
  const h='#'+[p[0],p[1],p[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  setColor(h);
  const cp1=$('edColorPicker'),cp2=document.getElementById('pcColorPicker');
  if(cp1)cp1.value=h;if(cp2)cp2.value=h;
}
document.addEventListener('click',e=>{
  if(e.target&&e.target.id==='pcGradientBar')_gradientPick(e.target,e);
});
$('edGradientBar').onclick=function(e){_gradientPick(this,e)};

/* ============================================================
   HELPERS
   ============================================================ */
function msg(m){toast.textContent=m;toast.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>toast.classList.remove('show'),CFG.TOAST_MS)}
function confirmDlg(m,opts){
  opts=opts||{};
  return new Promise(r=>{
    const d=document.createElement('div');
    d.className='ed-confirm';
    /* 긴 메시지(줄바꿈 포함) 지원을 위해 pre-wrap */
    const msgHTML='<pre style="white-space:pre-wrap;margin:0;font:inherit;max-width:640px;max-height:60vh;overflow:auto">'+String(m).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))+'</pre>';
    const btnsHTML=opts.okOnly
      ? '<div class="ed-confirm-btns"><button class="ok">확인</button></div>'
      : '<div class="ed-confirm-btns"><button class="cancel">취소</button><button class="ok">확인</button></div>';
    d.innerHTML='<div class="ed-confirm-box">'+msgHTML+btnsHTML+'</div>';
    document.body.appendChild(d);
    const ok=d.querySelector('.ok'); ok.onclick=()=>{d.remove();r(true)};
    const cancel=d.querySelector('.cancel'); if(cancel) cancel.onclick=()=>{d.remove();r(false)};
  });
}
/* Undo/redo stores DOM clones (not innerHTML strings) to avoid
   serialization artifacts — whitespace, <br>, attribute reordering */
function _snapCurrent(){
  const c=deck.cloneNode(true);
  c.querySelectorAll('.slide').forEach(s=>{s.classList.remove('active','exit-left','exit-right');s.removeAttribute('aria-hidden')});
  c.querySelectorAll('.visible').forEach(e=>e.classList.remove('visible'));
  c.querySelectorAll('.ed-drag-handle,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e,.ed-media-del,.ed-resize-handle,.ed-crosshair-h,.ed-crosshair-v,.ed-grid,.ed-snap-h,.ed-snap-v').forEach(e=>e.remove());
  c.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));
  _uncharClone(c);
  return c;
}
/* Remove .ed-anim-char spans from a cloned node (for save/undo snapshots).
   Replaces each span with its text content so the HTML stays clean. */
function _uncharClone(root){
  root.querySelectorAll('.ed-anim-char,.char-space').forEach(sp=>{
    sp.replaceWith(document.createTextNode(sp.textContent));
  });
  /* Normalize adjacent text nodes that may have been split */
  root.querySelectorAll('[data-anim]').forEach(el=>el.normalize());
}
function push(){
  undoStack.push(_snapCurrent());
  if(undoStack.length>CFG.MAX_UNDO)undoStack.shift();
  redoStack.length=0;
  _setDirty(true);
}
function restore(snapshot){
  /* Preserve overlay elements (guide, grid, snap, crosshair) before replacing */
  const overlays=[];
  deck.querySelectorAll('.ed-guide-169,.ed-crosshair-h,.ed-crosshair-v,.ed-grid,.ed-snap-h,.ed-snap-v').forEach(e=>overlays.push(e));
  overlays.forEach(e=>e.remove());/* temporarily detach */
  /* Replace deck children with cloned snapshot children */
  while(deck.firstChild)deck.removeChild(deck.firstChild);
  while(snapshot.firstChild)deck.appendChild(snapshot.firstChild);
  /* Re-attach overlays */
  overlays.forEach(e=>deck.appendChild(e));
  pAPI.reinit();buildNav();off();if(isEd()){on();upGuide()}_reapplyAnimChars(deck);
}
function isEd(){return document.body.classList.contains('editor-mode')}
function curSlide(){return pAPI.slides[pAPI.S.cur]}

/* ============================================================
   GUIDE / GRID
   ============================================================ */
function upGuide(){
  /* Guide is a sibling of slide-deck inside slide-frame.
     Position it to exactly overlay the scaled deck. */
  const sf=deck.parentElement;
  const dr=deck.getBoundingClientRect();
  const fr=sf.getBoundingClientRect();
  guide.style.left=(dr.left-fr.left)+'px';
  guide.style.top=(dr.top-fr.top)+'px';
  guide.style.width=dr.width+'px';
  guide.style.height=dr.height+'px';
  guide._r={x:0,y:0,w:CFG.CANVAS_W,h:CFG.CANVAS_H};
}
function upGrid(){
  const sz=+$('edGridSize').value||50,col=$('edGridColor').value,a=+$('edGridAlpha').value||6;
  $('edGridAlphaVal').textContent=a+'%';
  const rgb=col.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16));
  gridEl.style.backgroundImage=`linear-gradient(rgba(${rgb},${a/100}) 1px,transparent 1px),linear-gradient(90deg,rgba(${rgb},${a/100}) 1px,transparent 1px)`;
  gridEl.style.backgroundSize=sz+'px '+sz+'px';
}

/* ============================================================
   NAVIGATOR
   ============================================================ */
function buildNav(){
  const sl=pAPI.slides;navList.innerHTML='';
  sl.forEach((s,i)=>{
    const t=s.querySelector('h1,h2');const title=t?t.textContent.trim().substring(0,CFG.NAV_TITLE_LEN):'(빈)';
    const it=document.createElement('div');it.className='ed-nav-item'+(i===pAPI.S.cur?' active':'');it.draggable=true;
    it.innerHTML=`<span class="ed-nav-drag">⠿</span><span class="ed-nav-num">${i+1}</span><span class="ed-nav-title">${title}</span><span class="ed-nav-actions"><button class="ed-nav-btn" onclick="EA.dupAt(${i})">⧉</button><button class="ed-nav-btn del" onclick="EA.delAt(${i})">✕</button></span>`;
    it.addEventListener('click',e=>{if(e.target.closest('.ed-nav-btn,.ed-nav-drag'))return;pAPI.jump(i);sw()});
    it.addEventListener('dragstart',e=>{dragIdx=i;e.dataTransfer.effectAllowed='move';it.style.opacity='.4'});
    it.addEventListener('dragend',()=>{it.style.opacity='';navList.querySelectorAll('.ed-nav-item').forEach(x=>x.classList.remove('drag-over'))});
    it.addEventListener('dragover',e=>{e.preventDefault();it.classList.add('drag-over')});
    it.addEventListener('dragleave',()=>it.classList.remove('drag-over'));
    it.addEventListener('drop',e=>{e.preventDefault();it.classList.remove('drag-over');if(dragIdx===null||dragIdx===i)return;push();const els=Array.from(deck.querySelectorAll('.slide'));const el=els[dragIdx];if(i<dragIdx)els[i].before(el);else els[i].after(el);pAPI.reinit();pAPI.jump(i);sw();msg('순서 변경');dragIdx=null});
    it.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();showSlideCtxMenu(e.clientX,e.clientY,i);});
    navList.appendChild(it);
  });
}
/* ============================================================
   CONTEXT MENU — 슬라이드 사이드바 우클릭
   ============================================================ */
function showSlideCtxMenu(x,y,i){
  const menu=document.getElementById('edCtxMenu');
  if(!menu)return;
  const n=pAPI.total;
  const items=[
    {icon:'+',label:'뒤에 빈 슬라이드 추가',act:()=>insertBlankAfter(i)},
    {icon:'⧉',label:'슬라이드 복제',act:()=>dupAt(i)},
    {sep:true},
    {icon:'↑',label:'위로 이동',act:()=>moveSlide(i,-1),disabled:i===0},
    {icon:'↓',label:'아래로 이동',act:()=>moveSlide(i,1),disabled:i===n-1},
    {sep:true},
    {icon:'✎',label:'이름 변경',act:()=>renameSlide(i)},
    {sep:true},
    {icon:'↺',label:'원본 초기화',act:()=>resetSlide(i),danger:true,disabled:!origHTML[i]},
    {icon:'✕',label:'슬라이드 삭제',act:()=>delAt(i),danger:true,disabled:n<=1,shortcut:'Ctrl+Z 복구'},
  ];
  menu.innerHTML=items.map(it=>{
    if(it.sep)return '<div class="ed-ctx-sep"></div>';
    const cls='ed-ctx-item'+(it.danger?' danger':'')+(it.disabled?' disabled':'');
    const sh=it.shortcut?`<span class="ed-ctx-shortcut">${it.shortcut}</span>`:'';
    return `<div class="${cls}" data-act="${items.indexOf(it)}"><span class="ed-ctx-icon">${it.icon}</span>${it.label}${sh}</div>`;
  }).join('');
  menu.querySelectorAll('.ed-ctx-item').forEach(el=>{
    el.onclick=()=>{
      const idx=+el.dataset.act;const it=items[idx];
      if(it&&!it.disabled&&it.act){hideSlideCtxMenu();it.act();}
    };
  });
  /* 화면 경계 밖으로 안 나가게 */
  menu.classList.add('show');
  const mw=menu.offsetWidth,mh=menu.offsetHeight;
  const vw=window.innerWidth,vh=window.innerHeight;
  menu.style.left=Math.min(x,vw-mw-8)+'px';
  menu.style.top=Math.min(y,vh-mh-8)+'px';
}
function hideSlideCtxMenu(){const m=document.getElementById('edCtxMenu');if(m)m.classList.remove('show');}
/* 메뉴 밖 클릭 / ESC / 스크롤 시 닫기 */
document.addEventListener('click',e=>{if(!e.target.closest('#edCtxMenu'))hideSlideCtxMenu();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideSlideCtxMenu();});
window.addEventListener('scroll',hideSlideCtxMenu,true);
window.addEventListener('resize',hideSlideCtxMenu);
function sw(){buildNav();off();on();hideBar();upGuide()}

/* ============================================================
   SLIDE OPERATIONS
   ============================================================ */
const SLIDE_TEMPLATES={
  title:'<h1 data-step="1">제목</h1><p data-step="2">부제목</p>',
  content:'<p class="top-label" data-step="1">> 섹션</p><h2 data-step="2">제목</h2><ul data-step="3"><li>내용</li></ul>',
  media:'<h2 data-step="1">미디어 슬라이드</h2><p data-step="2" style="color:var(--grd)">미디어를 삽입하세요</p>',
  part:'<h1 data-step="1">00</h1><h2 data-step="2">파트 제목</h2>'
};

function dupAt(i){push();pAPI.slides[i].after(pAPI.slides[i].cloneNode(true));pAPI.reinit();pAPI.jump(i+1);sw();msg('복제')}
/* 즉시 삭제 — Ctrl+Z로 복구 가능 */
function delAt(i){if(pAPI.total<=1)return msg('삭제 불가');push();pAPI.slides[i].remove();pAPI.reinit();if(pAPI.S.cur>=pAPI.total)pAPI.jump(pAPI.total-1);sw();msg('삭제 (Ctrl+Z 복구)')}
function addSlide(type){
  push();const s=document.createElement('section');s.className='slide';
  s.innerHTML=SLIDE_TEMPLATES[type]||SLIDE_TEMPLATES.title;
  if(type==='part')s.classList.add('part-slide');
  curSlide().after(s);pAPI.reinit();pAPI.jump(pAPI.S.cur+1);sw();msg('추가');
}
/* 빈 슬라이드를 현재 슬라이드 바로 뒤에 삽입 + 자동 이동 + 제목 편집 모드 진입 */
function insertBlankAfter(i){
  push();
  const s=document.createElement('section');s.className='slide';
  s.innerHTML='<h2 data-step="1">제목</h2>';
  const ref=(typeof i==='number'&&pAPI.slides[i])?pAPI.slides[i]:curSlide();
  ref.after(s);
  pAPI.reinit();
  const newIdx=Array.from(deck.querySelectorAll('.slide')).indexOf(s);
  pAPI.jump(newIdx);sw();
  /* 다음 tick에 h2 포커스 + 전체 선택 */
  setTimeout(()=>{
    const h=s.querySelector('h1,h2');
    if(!h)return;
    h.contentEditable='true';
    h.focus();
    const r=document.createRange();r.selectNodeContents(h);
    const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);
  },50);
  msg('빈 슬라이드 추가');
}
/* 슬라이드 순서 이동 (dir: -1=위, 1=아래) */
function moveSlide(i,dir){
  const n=pAPI.total;const j=i+dir;
  if(j<0||j>=n)return msg(dir<0?'맨 위':'맨 아래');
  push();
  const els=Array.from(deck.querySelectorAll('.slide'));
  const el=els[i];
  if(dir<0)els[j].before(el);else els[j].after(el);
  pAPI.reinit();pAPI.jump(j);sw();msg(dir<0?'위로 이동':'아래로 이동');
}
/* 슬라이드 이름(h1/h2) 편집 모드 진입 */
function renameSlide(i){
  pAPI.jump(i);sw();
  setTimeout(()=>{
    const s=pAPI.slides[i];if(!s)return;
    const h=s.querySelector('h1,h2');
    if(!h){msg('제목 요소 없음');return;}
    h.contentEditable='true';
    h.focus();
    const r=document.createRange();r.selectNodeContents(h);
    const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);
    msg('이름 편집 중');
  },50);
}
async function resetSlide(idx){
  const i=(typeof idx==='number')?idx:pAPI.S.cur;if(!origHTML[i])return msg('원본 없음');
  if(!await confirmDlg('슬라이드 '+(i+1)+' 원본 초기화?'))return;
  push();const d=document.createElement('div');d.innerHTML=origHTML[i];
  pAPI.slides[i].replaceWith(d.firstElementChild);pAPI.reinit();sw();msg('초기화');
}

/* <<< end 495-829 <<< */
/* >>> editor.js original lines 830-855 >>> */
/* ============================================================
   EDITABLES
   ============================================================ */
function on(){
  const s=curSlide();if(!s)return;
  /* 블럭 시스템 v2 — contenteditable은 EDITING 진입 시에만 동적으로 부여.
     여기선 핸들만 붙임. */
  attachHandles();
}
function _makeEditable(el){
  /* 블럭 시스템 v2용 레거시 호환 — 외부 코드가 호출하면 바로 편집 진입 */
  el.contentEditable='true';
  if(!el._edFocus){
    el._edFocus=true;
    el.addEventListener('focus',()=>push());
  }
}
function off(){
  document.querySelectorAll('[contenteditable="true"]').forEach(e=>e.removeAttribute('contenteditable'));
  document.querySelectorAll('.ed-drag-handle,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e').forEach(h=>h.remove());
  /* 블럭 시스템 v2 클래스 정리 */
  document.querySelectorAll('.'+BLOCK.SEL_CLASS).forEach(e=>e.classList.remove(BLOCK.SEL_CLASS));
  document.querySelectorAll('.'+BLOCK.EDIT_CLASS).forEach(e=>e.classList.remove(BLOCK.EDIT_CLASS));
  selBlock=null;editingBlock=null;selBlocks=[];lastClickedBlock=null;
}

/* <<< end 830-855 <<< */
/* >>> editor.js original lines 1109-1215 >>> */
/* ============================================================
   SELECTION OVERLAY — 피그마식 단일 동기화 함수 + RAF 루프
   ────────────────────────────────────────────────────────────
   목적: 블럭이 이동/리사이즈될 때 핸들(⠿, ↔, ◿)이 자동으로 따라오게 함.
   원칙:
     1. 단일 진입점 — 모든 핸들 위치 계산은 syncSelectionOverlay()를 거침
     2. 자동 추적 — RAF 루프가 bbox 변화를 감지해서 매 프레임 자동 업데이트
     3. 드래그/리사이즈 코드는 핸들 위치를 "수동 호출" 안 해도 됨
   ============================================================ */
let _overlayRAF=null;
let _overlayLastBBox=new WeakMap(); /* el → last bbox string (변화 감지용) */

function syncSelectionOverlay(){
  /* 모든 리사이즈 핸들을 document 범위에서 찾아 _targetEl 기준으로 재배치. */
  const handles=document.querySelectorAll('.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e');
  handles.forEach(h=>{
    const el=h._targetEl;
    if(!el||!el.isConnected){return;}
    if(typeof h._posRH!=='function')return;
    /* 매 프레임 무조건 재배치 — bbox 감지 스킵은 버그 위험 있어 제거 */
    try{h._posRH();}catch(e){}
  });
}
function _overlayTick(){
  try{syncSelectionOverlay();}catch(e){}
  _overlayRAF=requestAnimationFrame(_overlayTick);
}
function startOverlayLoop(){
  if(_overlayRAF)return;
  _overlayRAF=requestAnimationFrame(_overlayTick);
}
function stopOverlayLoop(){
  if(_overlayRAF){cancelAnimationFrame(_overlayRAF);_overlayRAF=null;}
}
/* 상시 가동 — 에디터 모드든 아니든 켜두자. 핸들이 없으면 루프가 빈 돌기만 함 (비용 거의 0).
   이게 가장 확실. setBlockState가 호출 안 되는 경로(ex. media-wrap 선택, 초기 로드)에서도 동작. */
startOverlayLoop();

/* ============================================================
   TOOLBAR — draggable, minimize, close, position memory
   ============================================================ */
let tbPos=null;
try{const s=localStorage.getItem(CFG.LS_TOOLBAR);if(s)tbPos=JSON.parse(s)}catch(e){}

function showBar(el){
  /* 떠다니는 툴바 폐기 → 우측 패널 SEC_TEXT_EDITOR 가 담당. 호환성 위해 시그니처 유지. */
  return;
}
function hideBar(){toolbar.classList.remove('visible');_setSel(null);_clearBlockClasses&&_clearBlockClasses();selBlock=null;editingBlock=null;selBlocks=[];}
function closeBar(){toolbar.classList.remove('visible');tbClosed=true;_setSel(null);_clearBlockClasses&&_clearBlockClasses();selBlock=null;editingBlock=null;selBlocks=[];}

/* 선택 상태 관리 — 구 시스템(media wrap용). 일반 블럭에는 .ed-selected 안 붙임.
   일반 블럭은 .ed-selected-block 클래스(블럭 시스템 v2)로만 표시된다. */
function _setSel(el){
  if(sel&&sel!==el)sel.classList.remove('ed-selected');
  sel=el;
  /* media-wrap에만 구 클래스 표시 (일반 블럭은 v2 클래스가 담당) */
  if(sel&&sel.classList&&sel.classList.contains('ed-media-wrap'))sel.classList.add('ed-selected');
  if(window.PanelCtx&&PanelCtx.refresh)PanelCtx.refresh(el, selBlocks, selBlock);
}
function minBar(){toolbar.classList.toggle('minimized')}

let tbD=false,tbOx,tbOy;
tbDrag.addEventListener('mousedown',e=>{if(e.target.tagName==='BUTTON')return;tbD=true;const r=toolbar.getBoundingClientRect();tbOx=e.clientX-r.left;tbOy=e.clientY-r.top;e.preventDefault()});
document.addEventListener('mousemove',e=>{if(!tbD)return;toolbar.style.left=Math.max(0,e.clientX-tbOx)+'px';toolbar.style.top=Math.max(0,e.clientY-tbOy)+'px'});
document.addEventListener('mouseup',()=>{if(!tbD)return;tbD=false;tbPos={x:parseInt(toolbar.style.left),y:parseInt(toolbar.style.top)};try{localStorage.setItem(CFG.LS_TOOLBAR,JSON.stringify(tbPos))}catch(e){}});

/* ============================================================
   MEDIA WRAP — isolated from flex layout
   ============================================================ */
function wrapMedia(el){
  const w=document.createElement('div');w.className='ed-media-wrap';
  /* position:absolute set by CSS — fully outside flex flow */
  const d=document.createElement('button');d.className='ed-media-del';d.textContent='✕';
  d.onclick=()=>{push();w.remove();attachHandles();msg('삭제')};
  const rh=document.createElement('div');rh.className='ed-resize-handle';
  rh.addEventListener('mousedown',e=>{
    e.preventDefault();e.stopPropagation();push();
    const media=w.querySelector('img,video,iframe');if(!media)return;
    const sc=pAPI.deckScale;
    const sx=e.clientX,sw=media.offsetWidth;
    const mv=ev=>{
      const nw=Math.max(CFG.MEDIA_MIN_W,sw+(ev.clientX-sx)/sc);
      media.style.width=nw+'px';
      media.style.height='auto';
    };
    const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
  w.appendChild(d);w.appendChild(el);w.appendChild(rh);return w;
}
function addMedia(m){
  push();const s=curSlide();const w=wrapMedia(m);
  /* Insert before speaker-notes or at end of slide */
  const n=s.querySelector('.speaker-notes');if(n)n.before(w);else s.appendChild(w);
  /* Position: center of slide by default (CSS transform), user can drag to move */
  /* 자동 data-step 배정: 삽입 직후엔 중앙 위치라 일단 슬라이드의 현재 max step + 1 부여.
     사용자가 위치 옮긴 뒤 '재정렬' 버튼으로 Y좌표 기준 재배정 가능. */
  let maxStep=0;
  s.querySelectorAll('[data-step]').forEach(e=>{const v=+e.getAttribute('data-step')||0; if(v>maxStep)maxStep=v});
  w.setAttribute('data-step', String(maxStep+1));
  attachHandles();
  /* Step 값 갱신 후 pAPI 재초기화 + reveal 반영 */
  if(window.pAPI&&pAPI.reinit){pAPI.reinit();}
  msg('미디어 삽입 (step '+(maxStep+1)+')');
}

/* <<< end 1109-1215 <<< */
/* >>> editor.js original lines 1263-1343 >>> */
/* ============================================================
   I/O — file, URL, D&D, clipboard
   ============================================================ */
/* ── 세션 내 blob URL → 원본 File 객체 맵 ──
   드래그/선택/붙여넣기로 삽입된 미디어의 원본 File을 보관.
   Export 시 이 맵에서 직접 Blob을 꺼내 복사하므로 파일이 어디에 있었든 무관. */
const _blobFileMap=new Map(); /* blobURL → {file, name} */
function fileToURL(file){
  const u=URL.createObjectURL(file);
  _blobFileMap.set(u,{file,name:file.name||'media'});
  return u;
}

function insertImage(){fImg.value='';fImg.click()}
fImg.onchange=()=>{const f=fImg.files[0];if(!f)return;const img=mkImg(fileToURL(f));img.dataset.filename=f.name;addMedia(img)};
function insertImageURL(){const u=prompt('이미지 URL:');if(u)addMedia(mkImg(u.trim()))}
function insertVideo(){
  const u=prompt('YouTube URL:');if(!u)return;
  const m=u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if(!m)return msg('잘못된 URL');
  const f=document.createElement('iframe');f.src='https://www.youtube.com/embed/'+m[1];
  f.style.cssText='width:'+CFG.VID_DEFAULT_W+';aspect-ratio:16/9;border:none;border-radius:'+CFG.MEDIA_RADIUS;
  f.allow='accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture';f.allowFullscreen=true;addMedia(f);
}
function insertVideoFile(){fVid.value='';fVid.click()}
fVid.onchange=()=>{const f=fVid.files[0];if(!f)return;const vid=mkVid(fileToURL(f));vid.dataset.filename=f.name;addMedia(vid)};

const sf=document.querySelector('.slide-frame');

/* Wheel navigation — edit mode: 마우스 휠로 슬라이드 이동 + 사이드바 동기화 */
let _edWheelLock=0,_edWheelAcc=0;
sf.addEventListener('wheel',e=>{
  if(!isEd())return;
  /* 텍스트 편집 중엔 스크롤을 방해하지 않음 */
  const t=e.target;
  if(t&&t.closest&&t.closest('[contenteditable="true"]'))return;
  /* 드래그/리사이즈 중엔 이동 금지 */
  if(document.querySelector('.ed-dragging,.ed-resizing'))return;
  /* 입력 dialog 등이 열려있으면 스킵 */
  if(document.activeElement&&(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA'))return;
  e.preventDefault();
  const now=Date.now();
  if(now<_edWheelLock)return;
  const dy=e.deltaY;
  if(Math.abs(dy)<4)return;
  _edWheelAcc+=dy;
  if(Math.abs(_edWheelAcc)<40)return;/* 트랙패드 관성 필터 */
  _edWheelLock=now+180;
  const cur=pAPI.S.cur,tot=pAPI.total;
  if(_edWheelAcc>0){
    if(cur<tot-1){pAPI.jump(cur+1);sw()}
  }else{
    if(cur>0){pAPI.jump(cur-1);sw()}
  }
  _edWheelAcc=0;
},{passive:false});

sf.addEventListener('dragover',e=>{if(!isEd())return;e.preventDefault();e.dataTransfer.dropEffect='copy'});
sf.addEventListener('drop',e=>{
  if(!isEd())return;e.preventDefault();
  for(const f of e.dataTransfer.files){
    if(f.type.startsWith('image/')){const img=mkImg(fileToURL(f));img.dataset.filename=f.name;addMedia(img)}
    else if(f.type.startsWith('video/')){const vid=mkVid(fileToURL(f));vid.dataset.filename=f.name;addMedia(vid)}
  }
});
document.addEventListener('paste',e=>{
  if(!isEd())return;const items=e.clipboardData&&e.clipboardData.items;if(!items)return;
  for(const it of items){
    if(it.type.startsWith('image/')){
      e.preventDefault();const f=it.getAsFile();if(!f)continue;
      const img=mkImg(fileToURL(f));img.dataset.filename=f.name||'clipboard.png';addMedia(img);break;
    }
  }
});

/* ============================================================
   UNDO / REDO
   ============================================================ */
function undo(){if(!undoStack.length)return msg('없음');redoStack.push(_snapCurrent());restore(undoStack.pop());msg('실행취소')}
function redo(){if(!redoStack.length)return msg('없음');undoStack.push(_snapCurrent());restore(redoStack.pop());msg('다시실행')}

/* <<< end 1263-1343 <<< */
