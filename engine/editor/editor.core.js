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
  MEDIA_MAX_DISPLAY: 2048,  // keep original file; only cap edit-canvas display above 2K
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
function ensureEditorShellDOM(){
  const body=document.body;
  if(!body)return;
  if(!document.querySelector('.ed-mode-badge')){
    const badge=document.createElement('div');
    badge.className='ed-mode-badge';
    badge.textContent='EDITOR — Ctrl+S:Save   E:Exit   G:Grid';
    body.insertBefore(badge,body.firstChild);
  }
  if(!document.querySelector('.ed-file-bar')){
    const bar=document.createElement('div');
    bar.className='ed-file-bar';
    bar.innerHTML='<button class="fb-save" onclick="EA.save&&EA.save()" title="Ctrl+S">Save</button>'
      + '<button onclick="EA.saveAs&&EA.saveAs()" title="저장 위치 선택">Save As</button>'
      + '<button onclick="EA.exportHTML&&EA.exportHTML()" title="Ctrl+Shift+S">Export</button>'
      + '<button class="fb-reset" onclick="EA.resetAll&&EA.resetAll()">Reset</button>'
      + '<button class="fb-exit" onclick="EA.toggle&&EA.toggle()">Edit Mode Out</button>';
    body.insertBefore(bar,body.firstChild);
  }
  let nav=document.querySelector('.ed-nav');
  if(!nav){
    nav=document.createElement('nav');
    nav.className='ed-nav';
    nav.innerHTML='<div class="ed-nav-header"><h3>SLIDES</h3><button class="ed-nav-close" onclick="EA.toggle&&EA.toggle()">✕</button></div>'
      + '<div class="ed-nav-list" id="edNavList"></div>'
      + '<div class="ed-nav-footer"><button class="ed-nav-add" title="현재 슬라이드 뒤에 빈 슬라이드 추가">+ 새 슬라이드</button></div>';
    body.insertBefore(nav,body.firstChild);
  }else{
    if(!document.getElementById('edNavList')){
      const list=document.createElement('div');
      list.className='ed-nav-list';
      list.id='edNavList';
      nav.appendChild(list);
    }
  }
  if(!document.getElementById('edCtxMenu')){
    const menu=document.createElement('div');
    menu.className='ed-ctx-menu';
    menu.id='edCtxMenu';
    body.appendChild(menu);
  }
  if(!document.querySelector('aside.ed-panel')){
    const panel=document.createElement('aside');
    panel.className='ed-panel';
    panel.innerHTML='<div class="ed-section"><div class="ed-section-title">Selection</div></div>';
    body.insertBefore(panel,body.firstChild);
  }
  if(!document.getElementById('edPanelResizer')){
    const resizer=document.createElement('div');
    resizer.className='ed-panel-resizer';
    resizer.id='edPanelResizer';
    resizer.title='드래그: 폭 조절 / 더블클릭: 리셋';
    body.appendChild(resizer);
  }
  if(!document.getElementById('edToolbar')){
    const tb=document.createElement('div');
    tb.className='ed-toolbar';
    tb.id='edToolbar';
    tb.innerHTML='<div class="ed-toolbar-titlebar" id="edToolbarDrag"><span>TEXT EDITOR</span><div style="display:flex;gap:2px"><button onclick="EA.minimizeToolbar&&EA.minimizeToolbar()">−</button><button onclick="EA.closeToolbar&&EA.closeToolbar()">✕</button></div></div>'
      + '<div class="ed-toolbar-body" id="edToolbarBody">'
      + '<button class="tb" onclick="EA.execCmd&&EA.execCmd(\'bold\')"><b>B</b></button><button class="tb" onclick="EA.execCmd&&EA.execCmd(\'italic\')"><i>I</i></button><div class="sep"></div>'
      + '<button class="tb" onclick="EA.setAlign&&EA.setAlign(\'left\')">◧</button><button class="tb" onclick="EA.setAlign&&EA.setAlign(\'center\')">◫</button><button class="tb" onclick="EA.setAlign&&EA.setAlign(\'right\')">◨</button><div class="sep"></div>'
      + '<button class="tb ed-mode-btn active" id="edSizeBlock" onclick="EA.setSizeMode&&EA.setSizeMode(\'block\')">블록</button><button class="tb ed-mode-btn" id="edSizeSel" onclick="EA.setSizeMode&&EA.setSizeMode(\'sel\')">선택</button>'
      + '<select class="ed-size-select" onchange="EA.setSize&&EA.setSize(this.value)"><option value="">크기</option><option value="0.65rem">XS</option><option value="0.85rem">S</option><option value="1.1rem">M</option><option value="1.5rem">L</option><option value="2rem">XL</option><option value="3rem">2XL</option><option value="5rem">3XL</option></select>'
      + '<input class="ed-custom-size" id="edCustomSize" placeholder="px" onkeydown="if(event.key===\'Enter\')EA.setSize&&EA.setSize(this.value)"><div class="sep"></div>'
      + '<div class="ed-spacing-row"><label>행간</label><input class="ed-spacing-input" id="edLineH" placeholder="1.8" onkeydown="if(event.key===\'Enter\')EA.setLineHeight&&EA.setLineHeight(this.value)"></div>'
      + '<div class="ed-spacing-row"><label>자간</label><input class="ed-spacing-input" id="edLetterS" placeholder="0" onkeydown="if(event.key===\'Enter\')EA.setLetterSpacing&&EA.setLetterSpacing(this.value)"></div><div class="sep"></div>'
      + '<button class="tb" onclick="EA.zIndex&&EA.zIndex(1)">↑z</button><button class="tb" onclick="EA.zIndex&&EA.zIndex(-1)">↓z</button><div class="sep"></div>'
      + '<button class="tb" onclick="EA.deleteElement&&EA.deleteElement()" style="color:#ff5f57">✕</button>'
      + '<div style="width:100%;margin-top:8px"><div class="ed-palette-row" id="edPaletteTabs">'
      + '<button class="ed-palette-tab active" data-pal="green" onclick="EA.setPalette&&EA.setPalette(\'green\')">Green</button><button class="ed-palette-tab" data-pal="gold" onclick="EA.setPalette&&EA.setPalette(\'gold\')">Gold</button><button class="ed-palette-tab" data-pal="pink" onclick="EA.setPalette&&EA.setPalette(\'pink\')">Pink</button><button class="ed-palette-tab" data-pal="custom" onclick="EA.setPalette&&EA.setPalette(\'custom\')">Custom</button>'
      + '</div><div class="ed-palette-swatches" id="edSwatches"></div><input type="color" id="edColorPicker" value="#3ECF8E" onchange="EA.setColor&&EA.setColor(this.value)" style="width:28px;height:28px;border:none;background:none;cursor:pointer;border-radius:50%"><div class="ed-gradient-bar" id="edGradientBar"></div><div class="ed-palette-actions"><button onclick="EA.savePaletteFile&&EA.savePaletteFile()">Save .plt</button><button onclick="EA.loadPaletteFile&&EA.loadPaletteFile()">Load .plt</button></div></div>'
      + '</div>';
    body.appendChild(tb);
  }
  if(!document.getElementById('edToast')){
    const toast=document.createElement('div');
    toast.className='ed-toast';
    toast.id='edToast';
    body.appendChild(toast);
  }
  [
    ['edFileImg','image/*'],
    ['edFileVid','video/*'],
    ['edFilePlt','.plt,.json']
  ].forEach(([id,accept])=>{
    if(document.getElementById(id))return;
    const input=document.createElement('input');
    input.type='file';
    input.id=id;
    input.accept=accept;
    input.style.display='none';
    body.appendChild(input);
  });
  const deck=document.querySelector('.slide-deck');
  const overlayParent=(deck&&deck.parentElement&&deck.parentElement.classList.contains('slide-frame'))?deck.parentElement:deck;
  if(overlayParent){
    if(!document.getElementById('edGuide169')){
      const guide=document.createElement('div');
      guide.className='ed-guide-169';
      guide.id='edGuide169';
      guide.innerHTML='<span class="ed-guide-label">1920 × 1080 (16:9)</span>';
      overlayParent.appendChild(guide);
    }
    if(!overlayParent.querySelector('.ed-crosshair-h')){
      const h=document.createElement('div');
      h.className='ed-crosshair-h';
      overlayParent.appendChild(h);
    }
    if(!overlayParent.querySelector('.ed-crosshair-v')){
      const v=document.createElement('div');
      v.className='ed-crosshair-v';
      overlayParent.appendChild(v);
    }
    if(!document.getElementById('edGrid')){
      const grid=document.createElement('div');
      grid.className='ed-grid';
      grid.id='edGrid';
      overlayParent.appendChild(grid);
    }
    if(!document.getElementById('edSnapH')){
      const snap=document.createElement('div');
      snap.className='ed-snap-h';
      snap.id='edSnapH';
      overlayParent.appendChild(snap);
    }
    if(!document.getElementById('edSnapV')){
      const snap=document.createElement('div');
      snap.className='ed-snap-v';
      snap.id='edSnapV';
      overlayParent.appendChild(snap);
    }
  }
}
ensureEditorShellDOM();
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
  }
  if(nav){
    nav.querySelectorAll('.ed-nav-add').forEach(btn=>{
      if(btn.hasAttribute('onclick'))return;
      if(btn._edAddSlideBound)return;
      btn._edAddSlideBound=true;
      btn.addEventListener('click',e=>{
        e.preventDefault();
        if(window.EA&&EA.insertBlankAfter)EA.insertBlankAfter();
      });
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
  c.querySelectorAll('.ed-drag-handle,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e,.ed-media-del,.ed-resize-handle,.ed-crop-handle,.ed-crosshair-h,.ed-crosshair-v,.ed-grid,.ed-snap-h,.ed-snap-v').forEach(e=>e.remove());
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
  const left=dr.left-fr.left,top=dr.top-fr.top;
  const fitBox=el=>{
    if(!el)return;
    el.style.left=left+'px';
    el.style.top=top+'px';
    el.style.width=dr.width+'px';
    el.style.height=dr.height+'px';
    el.style.right='auto';
    el.style.bottom='auto';
  };
  fitBox(guide);
  fitBox(gridEl);
  const crossH=sf.querySelector('.ed-crosshair-h');
  const crossV=sf.querySelector('.ed-crosshair-v');
  if(crossH){
    crossH.style.left=left+'px';
    crossH.style.top=(top+dr.height/2)+'px';
    crossH.style.width=dr.width+'px';
    crossH.style.right='auto';
  }
  if(crossV){
    crossV.style.left=(left+dr.width/2)+'px';
    crossV.style.top=top+'px';
    crossV.style.height=dr.height+'px';
    crossV.style.bottom='auto';
  }
  if(gridEl&&$('edGridSize')){
    const sz=+$('edGridSize').value||50;
    const sc=(window.pAPI&&pAPI.deckScale)||1;
    gridEl.style.backgroundSize=(sz*sc)+'px '+(sz*sc)+'px';
  }
  guide._r={x:0,y:0,w:CFG.CANVAS_W,h:CFG.CANVAS_H};
}
function upGrid(){
  const sz=+$('edGridSize').value||50,col=$('edGridColor').value,a=+$('edGridAlpha').value||6;
  $('edGridAlphaVal').textContent=a+'%';
  const rgb=col.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16));
  gridEl.style.backgroundImage=`linear-gradient(rgba(${rgb},${a/100}) 1px,transparent 1px),linear-gradient(90deg,rgba(${rgb},${a/100}) 1px,transparent 1px)`;
  const sc=(window.pAPI&&pAPI.deckScale)||1;
  gridEl.style.backgroundSize=(sz*sc)+'px '+(sz*sc)+'px';
}

/* ============================================================
   NAVIGATOR
   ============================================================ */
function _slideTitleText(el){
  if(!el)return '';
  const c=el.cloneNode(true);
  const artifactSel=(typeof BLOCK==='object'&&BLOCK.ARTIFACT_SEL)||
    '.ed-drag-handle,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e,.ed-resize-handle,.ed-media-del,.ed-crop-handle';
  c.querySelectorAll(artifactSel).forEach(a=>a.remove());
  return c.textContent.trim();
}
function _slideNavTitle(slide){
  if(!slide)return '';
  const saved=(slide.getAttribute('data-title')||'').trim();
  if(saved)return saved;
  const h=slide.querySelector('h1,h2');
  return h?_slideTitleText(h):'';
}
function _escHTML(s){
  return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function buildNav(){
  const sl=pAPI.slides;navList.innerHTML='';
  sl.forEach((s,i)=>{
    const title=(_slideNavTitle(s)||'(빈)').substring(0,CFG.NAV_TITLE_LEN);
    const it=document.createElement('div');it.className='ed-nav-item'+(i===pAPI.S.cur?' active':'');it.draggable=true;
    it.innerHTML=`<span class="ed-nav-drag">⠿</span><span class="ed-nav-num">${i+1}</span><span class="ed-nav-title">${_escHTML(title)}</span><span class="ed-nav-actions"><button class="ed-nav-btn" onclick="EA.dupAt(${i})">⧉</button><button class="ed-nav-btn del" onclick="EA.delAt(${i})">✕</button></span>`;
    it.addEventListener('click',e=>{
      if(e.target.closest('.ed-nav-btn,.ed-nav-drag'))return;
      if(e.target.closest('.ed-nav-title[contenteditable="true"]'))return;
      if(e.detail>=2){e.preventDefault();renameSlide(i);return;}
      pAPI.jump(i);sw();
    });
    it.addEventListener('dragstart',e=>{
      if(e.target.closest&&e.target.closest('.ed-nav-title[contenteditable="true"]')){e.preventDefault();return;}
      dragIdx=i;e.dataTransfer.effectAllowed='move';it.style.opacity='.4';
    });
    it.addEventListener('dragend',()=>{it.style.opacity='';navList.querySelectorAll('.ed-nav-item').forEach(x=>x.classList.remove('drag-over'))});
    it.addEventListener('dragover',e=>{e.preventDefault();it.classList.add('drag-over')});
    it.addEventListener('dragleave',()=>it.classList.remove('drag-over'));
    it.addEventListener('drop',e=>{e.preventDefault();it.classList.remove('drag-over');if(dragIdx===null||dragIdx===i)return;push();const els=Array.from(deck.querySelectorAll('.slide'));const el=els[dragIdx];if(i<dragIdx)els[i].before(el);else els[i].after(el);pAPI.reinit();pAPI.jump(i);sw();msg('순서 변경');dragIdx=null});
    it.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();showSlideCtxMenu(e.clientX,e.clientY,i);});
    navList.appendChild(it);
  });
}
navList.addEventListener('dblclick',e=>{
  const it=e.target.closest&&e.target.closest('.ed-nav-item');
  if(!it||e.target.closest('.ed-nav-btn,.ed-nav-drag'))return;
  const i=Array.from(navList.querySelectorAll('.ed-nav-item')).indexOf(it);
  if(i<0)return;
  e.preventDefault();e.stopPropagation();
  renameSlide(i);
});
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
function _commitSlideNavTitle(i,value){
  const s=pAPI.slides[i];if(!s)return;
  const next=(value||'').trim();
  push();
  if(next)s.setAttribute('data-title',next);
  else s.removeAttribute('data-title');
  _setDirty&&_setDirty(true);
  buildNav();
  msg('이름 변경');
}
/* 슬라이드 이름 편집 모드 진입 — 본문을 건드리지 않고 section[data-title]만 갱신 */
function renameSlide(i){
  if(typeof i!=='number')i=pAPI.S.cur;
  pAPI.jump(i);sw();
  setTimeout(()=>{
    const s=pAPI.slides[i];if(!s)return;
    const item=navList&&navList.querySelectorAll('.ed-nav-item')[i];
    const titleEl=item&&item.querySelector('.ed-nav-title');
    if(!titleEl)return;
    const original=_slideNavTitle(s);
    titleEl.textContent=original;
    titleEl.contentEditable='true';
    titleEl.classList.add('editing');
    titleEl.style.minWidth='120px';
    if(item)item.draggable=false;
    titleEl.focus();
    const r=document.createRange();r.selectNodeContents(titleEl);
    const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);
    let done=false;
    const finish=commit=>{
      if(done)return;done=true;
      const next=commit?titleEl.textContent:original;
      titleEl.removeEventListener('keydown',onKey);
      titleEl.removeEventListener('blur',onBlur);
      titleEl.removeAttribute('contenteditable');
      titleEl.classList.remove('editing');
      titleEl.style.minWidth='';
      if(item)item.draggable=true;
      if(commit)_commitSlideNavTitle(i,next);
      else buildNav();
    };
    const onKey=e=>{
      if(e.key==='Enter'){e.preventDefault();finish(true);}
      if(e.key==='Escape'){e.preventDefault();finish(false);}
    };
    const onBlur=()=>finish(true);
    titleEl.addEventListener('keydown',onKey);
    titleEl.addEventListener('blur',onBlur);
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
/* ============================================================
   CROP — image/video pixel crop (data-crop-* + CSS variables)
   ============================================================ */
function _cropTarget(){
  if(selBlock&&selBlock.classList&&selBlock.classList.contains('ed-media-wrap'))return selBlock;
  if(sel&&sel.classList&&sel.classList.contains('ed-media-wrap'))return sel;
  if(selBlock&&selBlock.closest){const w=selBlock.closest('.ed-media-wrap');if(w)return w;}
  if(sel&&sel.closest){const w=sel.closest('.ed-media-wrap');if(w)return w;}
  const f=document.querySelector('.slide.active .ed-media-wrap.ed-selected')||
          document.querySelector('.slide.active .ed-media-wrap.ed-selected-block');
  return f||null;
}
function _cropClampSide(wrap,side,px){
  const m=wrap&&wrap.querySelector('img,video,iframe');
  if(!m)return Math.max(0,px|0);
  const W=m.offsetWidth||m.naturalWidth||0;
  const H=m.offsetHeight||m.naturalHeight||0;
  const opp=side==='t'?'b':side==='b'?'t':side==='l'?'r':'l';
  const oppPx=parseInt(wrap.getAttribute('data-crop-'+opp),10)||0;
  const lim=(side==='t'||side==='b')?Math.max(0,H-oppPx-1):Math.max(0,W-oppPx-1);
  return Math.min(lim,Math.max(0,px|0));
}
function _cropScale(wrap){
  const v=parseFloat(wrap&&wrap.getAttribute('data-crop-scale'));
  return isFinite(v)&&v>0?v:1;
}
function _cropEnsureBase(wrap){
  const m=wrap&&wrap.querySelector('img,video,iframe');
  if(!m)return null;
  let bw=parseFloat(wrap.getAttribute('data-crop-base-w'))||0;
  let bh=parseFloat(wrap.getAttribute('data-crop-base-h'))||0;
  const scale=_cropScale(wrap);
  if(!bw||!bh){
    const curW=m.offsetWidth||m.naturalWidth||0;
    const curH=m.offsetHeight||m.naturalHeight||0;
    bw=scale!==1?curW/scale:curW;
    bh=scale!==1?curH/scale:curH;
    if(bw)wrap.setAttribute('data-crop-base-w',Math.round(bw*100)/100);
    if(bh)wrap.setAttribute('data-crop-base-h',Math.round(bh*100)/100);
  }
  return {m,bw,bh};
}
function _cropApply(wrap){
  if(!wrap)return;
  const base=_cropEnsureBase(wrap);
  const scale=_cropScale(wrap);
  if(base&&base.bw){
    base.m.style.width=Math.max(1,base.bw*scale)+'px';
    base.m.style.height='auto';
  }
  const t=parseInt(wrap.getAttribute('data-crop-t'),10)||0;
  const r=parseInt(wrap.getAttribute('data-crop-r'),10)||0;
  const b=parseInt(wrap.getAttribute('data-crop-b'),10)||0;
  const l=parseInt(wrap.getAttribute('data-crop-l'),10)||0;
  wrap.style.setProperty('--cT',t+'px');
  wrap.style.setProperty('--cR',r+'px');
  wrap.style.setProperty('--cB',b+'px');
  wrap.style.setProperty('--cL',l+'px');
  const m=wrap.querySelector('img,video,iframe');
  if(m){
    const mw=m.offsetWidth,mh=m.offsetHeight;
    if(mw&&mh){
      wrap.style.width=Math.max(1,mw-l-r)+'px';
      wrap.style.height=Math.max(1,mh-t-b)+'px';
    }
  }
  const has=(t||r||b||l)>0;
  wrap.classList.toggle('has-crop',has);
  wrap.classList.toggle('has-scale',scale!==1);
  if(!has&&scale===1){wrap.style.width='';wrap.style.height='';}
}
function readCrop(){
  const w=_cropTarget();if(!w)return null;
  return {
    t:parseInt(w.getAttribute('data-crop-t'),10)||0,
    r:parseInt(w.getAttribute('data-crop-r'),10)||0,
    b:parseInt(w.getAttribute('data-crop-b'),10)||0,
    l:parseInt(w.getAttribute('data-crop-l'),10)||0,
    scale:_cropScale(w)
  };
}
function setCrop(side,px){
  const w=_cropTarget();
  if(!w){console.warn('[crop] no media target');return;}
  side=String(side||'').toLowerCase();
  if(!/^[trbl]$/.test(side))return;
  push();
  const v=_cropClampSide(w,side,parseInt(px,10)||0);
  if(v)w.setAttribute('data-crop-'+side,v);
  else w.removeAttribute('data-crop-'+side);
  _cropApply(w);
  _setDirty&&_setDirty(true);
}
function setCropScale(scale){
  const w=_cropTarget();
  if(!w){console.warn('[crop] no media target');return;}
  const v=Math.max(0.1,Math.min(8,parseFloat(scale)||1));
  push();
  _cropEnsureBase(w);
  if(Math.abs(v-1)<0.001)w.removeAttribute('data-crop-scale');
  else w.setAttribute('data-crop-scale',Math.round(v*1000)/1000);
  _cropApply(w);
  _setDirty&&_setDirty(true);
  if(window.PanelCtx&&PanelCtx._refreshCropUI)PanelCtx._refreshCropUI();
}
function resetCrop(){
  const w=_cropTarget();if(!w)return;
  push();
  ['t','r','b','l'].forEach(s=>w.removeAttribute('data-crop-'+s));
  _cropApply(w);
  _setDirty&&_setDirty(true);
  msg('크롭 초기화');
  if(window.PanelCtx&&PanelCtx._refreshCropUI)PanelCtx._refreshCropUI();
}
function resetCropScale(){
  const w=_cropTarget();if(!w)return;
  push();
  w.removeAttribute('data-crop-scale');
  _cropApply(w);
  _setDirty&&_setDirty(true);
  msg('스케일 초기화');
  if(window.PanelCtx&&PanelCtx._refreshCropUI)PanelCtx._refreshCropUI();
}
function _startMediaScaleDrag(wrap,e){
  if(!wrap)return;
  e.preventDefault();e.stopPropagation();push();
  if(typeof _setSel==='function')_setSel(wrap);
  const base=_cropEnsureBase(wrap);if(!base||!base.bw||!base.bh)return;
  const sc=(window.pAPI&&pAPI.deckScale)||1;
  const sx=e.clientX,sy=e.clientY;
  const t=parseInt(wrap.getAttribute('data-crop-t'),10)||0;
  const r=parseInt(wrap.getAttribute('data-crop-r'),10)||0;
  const b=parseInt(wrap.getAttribute('data-crop-b'),10)||0;
  const l=parseInt(wrap.getAttribute('data-crop-l'),10)||0;
  const startScale=_cropScale(wrap);
  const startW=wrap.offsetWidth||Math.max(1,base.bw*startScale-l-r);
  const startH=wrap.offsetHeight||Math.max(1,base.bh*startScale-t-b);
  const minScale=Math.max(0.1,(CFG.MEDIA_MIN_W+l+r)/base.bw,(1+t+b)/base.bh);
  document.body.classList.add('ed-media-scaling');
  const mv=ev=>{
    const dx=(ev.clientX-sx)/sc;
    const dy=(ev.clientY-sy)/sc;
    const scaleByW=(Math.max(CFG.MEDIA_MIN_W,startW+dx)+l+r)/base.bw;
    const scaleByH=(Math.max(1,startH+dy)+t+b)/base.bh;
    let next=Math.abs(dx/startW)>=Math.abs(dy/startH)?scaleByW:scaleByH;
    next=Math.max(minScale,Math.min(8,next));
    if(Math.abs(next-1)<0.001)wrap.removeAttribute('data-crop-scale');
    else wrap.setAttribute('data-crop-scale',Math.round(next*1000)/1000);
    _cropApply(wrap);
    if(window.PanelCtx&&PanelCtx._refreshCropUI)PanelCtx._refreshCropUI();
  };
  const up=()=>{
    document.removeEventListener('mousemove',mv);
    document.removeEventListener('mouseup',up);
    document.body.classList.remove('ed-media-scaling');
    _setDirty&&_setDirty(true);
  };
  document.addEventListener('mousemove',mv);
  document.addEventListener('mouseup',up);
}
function _attachCropHandles(wrap){
  if(!wrap)return;
  if(wrap._cropHandlesAttached&&wrap.querySelector('.ed-crop-handle'))return;
  wrap.querySelectorAll('.ed-crop-handle').forEach(h=>h.remove());
  ['t','r','b','l'].forEach(side=>{
    const h=document.createElement('div');
    h.className='ed-crop-handle '+side;
    h.dataset.side=side;
    h.addEventListener('mousedown',e=>{
      e.preventDefault();e.stopPropagation();
      push();
      const sc=(window.pAPI&&pAPI.deckScale)||1;
      const sx=e.clientX,sy=e.clientY;
      const start=parseInt(wrap.getAttribute('data-crop-'+side),10)||0;
      document.body.classList.add('ed-cropping');
      const mv=ev=>{
        const dx=(ev.clientX-sx)/sc;
        const dy=(ev.clientY-sy)/sc;
        let delta=0;
        if(side==='t')delta=dy;
        if(side==='b')delta=-dy;
        if(side==='l')delta=dx;
        if(side==='r')delta=-dx;
        const v=_cropClampSide(wrap,side,start+delta);
        if(v)wrap.setAttribute('data-crop-'+side,v);
        else wrap.removeAttribute('data-crop-'+side);
        _cropApply(wrap);
        if(window.PanelCtx&&PanelCtx._refreshCropUI)PanelCtx._refreshCropUI();
      };
      const up=()=>{
        document.removeEventListener('mousemove',mv);
        document.removeEventListener('mouseup',up);
        document.body.classList.remove('ed-cropping');
        _setDirty&&_setDirty(true);
      };
      document.addEventListener('mousemove',mv);
      document.addEventListener('mouseup',up);
    });
    wrap.appendChild(h);
  });
  wrap._cropHandlesAttached=true;
  if(wrap.hasAttribute('data-crop-t')||wrap.hasAttribute('data-crop-r')||
     wrap.hasAttribute('data-crop-b')||wrap.hasAttribute('data-crop-l')){
    _cropApply(wrap);
  }
}

function wrapMedia(el){
  const w=document.createElement('div');w.className='ed-media-wrap';
  /* position:absolute set by CSS — fully outside flex flow */
  const d=document.createElement('button');d.className='ed-media-del';d.textContent='✕';
  d.onclick=()=>{push();w.remove();attachHandles();msg('삭제')};
  const rh=document.createElement('div');rh.className='ed-resize-handle';
  rh.addEventListener('mousedown',e=>{
    _startMediaScaleDrag(w,e);
  });
  w.appendChild(d);w.appendChild(el);w.appendChild(rh);
  _attachCropHandles(w);
  return w;
}
function _mediaDropPointFromClient(opts,slide){
  if(!opts||typeof opts.dropClientX!=='number'||typeof opts.dropClientY!=='number'||!slide)return null;
  const r=slide.getBoundingClientRect();
  const scX=r.width/(slide.offsetWidth||CFG.CANVAS_W||r.width)||((window.pAPI&&pAPI.deckScale)||1);
  const scY=r.height/(slide.offsetHeight||CFG.CANVAS_H||r.height)||((window.pAPI&&pAPI.deckScale)||1);
  return {
    x:(opts.dropClientX-r.left)/scX,
    y:(opts.dropClientY-r.top)/scY
  };
}
function _mediaCanvasScale(slide){
  if(!slide||!slide.getBoundingClientRect)return {x:(window.pAPI&&pAPI.deckScale)||1,y:(window.pAPI&&pAPI.deckScale)||1};
  const r=slide.getBoundingClientRect();
  const sx=r.width/(slide.offsetWidth||CFG.CANVAS_W||r.width);
  const sy=r.height/(slide.offsetHeight||CFG.CANVAS_H||r.height);
  const fallback=(window.pAPI&&pAPI.deckScale)||1;
  return {x:sx||fallback,y:sy||fallback};
}
function _mediaCanvasSize(w,slide){
  const m=w&&w.querySelector&&w.querySelector('img,video,iframe');
  const target=m||w;
  if(!target)return {w:0,h:0};
  const sc=_mediaCanvasScale(slide||w.closest&&w.closest('.slide'));
  const r=target.getBoundingClientRect&&target.getBoundingClientRect();
  let mw=r&&r.width? r.width/sc.x : 0;
  let mh=r&&r.height? r.height/sc.y : 0;
  if(!mw)mw=target.offsetWidth||0;
  if(!mh)mh=target.offsetHeight||0;
  if((!mw||!mh)&&target.tagName==='IMG'){
    const nw=target.naturalWidth||0,nh=target.naturalHeight||0;
    if(nw&&nh){
      const disp=(typeof _mediaDisplaySize==='function')?_mediaDisplaySize(nw,nh):{w:nw,h:nh};
      mw=mw||disp.w;mh=mh||disp.h;
    }
  }
  if((!mw||!mh)&&target.tagName==='VIDEO'){
    const vw=target.videoWidth||0,vh=target.videoHeight||0;
    if(vw&&vh){
      const disp=(typeof _mediaDisplaySize==='function')?_mediaDisplaySize(vw,vh):{w:vw,h:vh};
      mw=mw||disp.w;mh=mh||disp.h;
    }
  }
  if(!mw&&target.style&&target.style.width)mw=parseFloat(target.style.width)||0;
  if(!mh&&target.style&&target.style.height)mh=parseFloat(target.style.height)||0;
  if(!mw&&target.tagName==='IMG')mw=parseFloat(CFG.IMG_DEFAULT_W)||400;
  if(!mw&&target.tagName==='VIDEO')mw=parseFloat(CFG.VID_DEFAULT_W)||640;
  if(!mh&&mw)mh=Math.round(mw*9/16);
  return {w:mw,h:mh};
}
function _refreshDropPlacedMedia(w,pt,slide){
  if(!w||!pt)return;
  const sz=_mediaCanvasSize(w,slide);
  w.style.position='absolute';
  w.style.transform='none';
  w.style.left=Math.round(pt.x-(sz.w||0)/2)+'px';
  w.style.top=Math.round(pt.y-(sz.h||0)/2)+'px';
  w.style.visibility='';
  if(typeof syncSelectionOverlay==='function')syncSelectionOverlay();
}
function _placeMediaAtDropPoint(w,pt){
  if(!w||!pt)return;
  const slide=w.closest&&w.closest('.slide');
  const media=w.querySelector&&w.querySelector('img,video,iframe');
  const refresh=()=>requestAnimationFrame(()=>_refreshDropPlacedMedia(w,pt,slide));
  w.style.position='absolute';
  w.style.transform='none';
  w.style.visibility='hidden';
  _refreshDropPlacedMedia(w,pt,slide);
  refresh();
  if(!media)return;
  if(media.tagName==='IMG'){
    if(media.complete&&media.naturalWidth)refresh();
    else media.addEventListener('load',refresh,{once:true});
  }else if(media.tagName==='VIDEO'){
    if(media.readyState>=1&&(media.videoWidth||media.offsetWidth))refresh();
    else media.addEventListener('loadedmetadata',refresh,{once:true});
  }else{
    media.addEventListener('load',refresh,{once:true});
  }
}
function addMedia(m,opts){
  push();const s=curSlide();const w=wrapMedia(m);
  /* Insert before speaker-notes or at end of slide */
  const n=s.querySelector('.speaker-notes');if(n)n.before(w);else s.appendChild(w);
  /* Position: center of slide by default (CSS transform), user can drag to move */
  _placeMediaAtDropPoint(w,_mediaDropPointFromClient(opts,s));
  /* 자동 data-step 배정: 삽입 직후엔 중앙 위치라 일단 슬라이드의 현재 max step + 1 부여.
     사용자가 위치 옮긴 뒤 '재정렬' 버튼으로 Y좌표 기준 재배정 가능. */
  let maxStep=0;
  s.querySelectorAll('[data-step]').forEach(e=>{const v=+e.getAttribute('data-step')||0; if(v>maxStep)maxStep=v});
  w.setAttribute('data-step', String(maxStep+1));
  attachHandles();
  /* Step 값 갱신 후 pAPI 재초기화 + reveal 반영 */
  if(window.pAPI&&pAPI.reinit){pAPI.reinit();}
  msg('미디어 삽입 (step '+(maxStep+1)+')');
  return w;
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
function _filenameFromURL(src,fallback){
  try{
    const u=new URL(src,location.href);
    const n=decodeURIComponent(u.pathname.split('/').pop()||'');
    return n||fallback||'media';
  }catch(e){
    return fallback||'media';
  }
}
function _bestSrcFromSrcset(srcset){
  if(!srcset)return '';
  const items=String(srcset).split(',').map(part=>{
    const bits=part.trim().split(/\s+/);
    const url=bits[0]||'';
    const d=bits[1]||'';
    let score=1;
    if(/^\d+w$/.test(d))score=parseInt(d,10)||1;
    else if(/^[\d.]+x$/.test(d))score=parseFloat(d)||1;
    return {url,score};
  }).filter(x=>x.url);
  items.sort((a,b)=>b.score-a.score);
  return items[0]&&items[0].url||'';
}
function _insertImageFromFile(file,source,opts){
  const img=mkImg(fileToURL(file));
  img.dataset.filename=file.name||'clipboard.png';
  img.dataset.source=source||'file';
  img.dataset.originalBytes=String(file.size||0);
  if(source==='clipboard-bitmap'){
    img.addEventListener('load',()=>{
      msg('클립보드 비트맵 삽입: '+(img.naturalWidth||'?')+'×'+(img.naturalHeight||'?')+' — 원본 URL/파일 정보 없음');
    },{once:true});
  }
  addMedia(img,opts);
}
function _insertVideoFromFile(file,source,opts){
  const vid=mkVid(fileToURL(file));
  vid.dataset.filename=file.name||'clipboard-video';
  vid.dataset.source=source||'file';
  vid.dataset.originalBytes=String(file.size||0);
  addMedia(vid,opts);
}
function _insertImagesFromClipboardHTML(html){
  if(!html)return false;
  const doc=new DOMParser().parseFromString(html,'text/html');
  const imgs=Array.from(doc.querySelectorAll('img'));
  let inserted=false;
  imgs.forEach(node=>{
    const src=_bestSrcFromSrcset(node.getAttribute('srcset'))||node.getAttribute('src');
    if(!src)return;
    if(/^blob:/i.test(src))return;
    const img=mkImg(new URL(src,location.href).href);
    img.dataset.filename=node.getAttribute('data-filename')||_filenameFromURL(src,'clipboard.png');
    img.dataset.source='clipboard-html';
    addMedia(img);
    inserted=true;
  });
  return inserted;
}
function _insertImagesFromClipboardURLText(text){
  if(!text)return false;
  const lines=String(text).split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
  let inserted=false;
  lines.forEach(raw=>{
    let u;
    try{u=new URL(raw,location.href)}catch(e){return}
    if(!/^https?:$/.test(u.protocol))return;
    if(!/\.(png|jpe?g|webp|gif|avif|svg)([?#].*)?$/i.test(u.pathname))return;
    const img=mkImg(u.href);
    img.dataset.filename=_filenameFromURL(u.href,'clipboard-image');
    img.dataset.source='clipboard-url';
    addMedia(img);
    inserted=true;
  });
  return inserted;
}

function insertImage(){fImg.value='';fImg.click()}
fImg.onchange=()=>{const f=fImg.files[0];if(!f)return;_insertImageFromFile(f,'file-picker')};
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
fVid.onchange=()=>{const f=fVid.files[0];if(!f)return;_insertVideoFromFile(f,'file-picker')};

const sf=document.querySelector('.slide-frame');

function _edViewportBusy(){
  if(document.querySelector('.ed-dragging,.ed-resizing'))return true;
  return document.body.classList.contains('ed-media-scaling')||
         document.body.classList.contains('ed-cropping');
}
function _edRefreshViewportOverlays(){
  if(typeof upGuide==='function')upGuide();
  if(typeof syncSelectionOverlay==='function')syncSelectionOverlay();
}
function _edWheelDelta(e){
  let dy=e.deltaY||0;
  if(e.deltaMode===1)dy*=16;
  else if(e.deltaMode===2)dy*=(sf&&sf.clientHeight)||800;
  return dy;
}

/* Edit viewport: wheel zooms the canvas view; PageUp/PageDown still move slides. */
sf.addEventListener('wheel',e=>{
  if(!isEd())return;
  const t=e.target;
  if(t&&t.closest&&t.closest('[contenteditable="true"]'))return;
  if(_edViewportBusy())return;
  if(document.activeElement&&(
    document.activeElement.tagName==='INPUT'||
    document.activeElement.tagName==='TEXTAREA'||
    document.activeElement.tagName==='SELECT'
  ))return;
  if(!window.pAPI||typeof pAPI.zoomEditViewAt!=='function')return;
  e.preventDefault();
  const dy=_edWheelDelta(e);
  if(Math.abs(dy)<.5)return;
  pAPI.zoomEditViewAt(e.clientX,e.clientY,Math.exp(-dy*.0015));
  _edRefreshViewportOverlays();
},{passive:false});

let _edPanMove=null,_edPanUp=null;
function _edStopCanvasPan(){
  if(_edPanMove)document.removeEventListener('mousemove',_edPanMove,true);
  if(_edPanUp)document.removeEventListener('mouseup',_edPanUp,true);
  _edPanMove=null;_edPanUp=null;
  document.body.classList.remove('ed-canvas-panning');
}
function _edStartCanvasPan(e){
  if(!isEd()||e.button!==1||_edViewportBusy())return;
  if(!window.pAPI||typeof pAPI.panEditViewBy!=='function')return;
  e.preventDefault();
  e.stopPropagation();
  let lastX=e.clientX,lastY=e.clientY;
  document.body.classList.add('ed-canvas-panning');
  _edPanMove=ev=>{
    ev.preventDefault();
    const dx=ev.clientX-lastX,dy=ev.clientY-lastY;
    lastX=ev.clientX;lastY=ev.clientY;
    pAPI.panEditViewBy(dx,dy);
    _edRefreshViewportOverlays();
  };
  _edPanUp=ev=>{
    ev.preventDefault();
    ev.stopPropagation();
    _edStopCanvasPan();
  };
  document.addEventListener('mousemove',_edPanMove,true);
  document.addEventListener('mouseup',_edPanUp,true);
}
sf.addEventListener('mousedown',e=>{
  if(e.button===1)_edStartCanvasPan(e);
},true);
document.addEventListener('auxclick',e=>{
  if(!isEd()||e.button!==1)return;
  if(e.target&&e.target.closest&&e.target.closest('.slide-frame')){
    e.preventDefault();
    e.stopPropagation();
  }
},true);
window.addEventListener('blur',_edStopCanvasPan);

/* Wheel navigation — edit mode: 마우스 휠로 슬라이드 이동 + 사이드바 동기화 */
let _edWheelLock=0,_edWheelAcc=0;
sf.addEventListener('wheel',e=>{return;
  if(!isEd())return;
  /* 텍스트 편집 중엔 스크롤을 방해하지 않음 */
  const t=e.target;
  if(t&&t.closest&&t.closest('[contenteditable="true"]'))return;
  /* 드래그/리사이즈 중엔 이동 금지 */
  if(document.querySelector('.ed-dragging,.ed-resizing')||document.body.classList.contains('ed-media-scaling'))return;
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
  const dropOpts={dropClientX:e.clientX,dropClientY:e.clientY};
  for(const f of e.dataTransfer.files){
    if(f.type.startsWith('image/'))_insertImageFromFile(f,'drop-file',dropOpts);
    else if(f.type.startsWith('video/'))_insertVideoFromFile(f,'drop-file',dropOpts);
  }
});
document.addEventListener('paste',e=>{
  if(!isEd())return;
  const cd=e.clipboardData;if(!cd)return;
  if(_insertImagesFromClipboardHTML(cd.getData&&cd.getData('text/html'))){
    e.preventDefault();
    msg('클립보드 원본 이미지 URL로 삽입');
    return;
  }
  if(_insertImagesFromClipboardURLText(cd.getData&&cd.getData('text/uri-list'))||
     _insertImagesFromClipboardURLText(cd.getData&&cd.getData('text/plain'))){
    e.preventDefault();
    msg('클립보드 원본 URL로 삽입');
    return;
  }
  const files=Array.from(cd.files||[]);
  const mediaFiles=files.filter(f=>f.type&&/^(image|video)\//.test(f.type));
  if(mediaFiles.length){
    e.preventDefault();
    mediaFiles.forEach(f=>{
      if(f.type.startsWith('image/'))_insertImageFromFile(f,'clipboard-file');
      else if(f.type.startsWith('video/'))_insertVideoFromFile(f,'clipboard-file');
    });
    msg('클립보드 파일 원본으로 삽입');
    return;
  }
  const items=cd.items;if(!items)return;
  for(const it of items){
    if(it.type.startsWith('image/')){
      e.preventDefault();const f=it.getAsFile();if(!f)continue;
      _insertImageFromFile(f,'clipboard-bitmap');
      msg('클립보드 비트맵으로 삽입됨 — 원본 파일 정보가 없는 복사본일 수 있음');
      break;
    }
    if(it.type.startsWith('video/')){
      e.preventDefault();const f=it.getAsFile();if(!f)continue;
      _insertVideoFromFile(f,'clipboard-bitmap');
      msg('클립보드 비디오로 삽입');
      break;
    }
  }
});

/* ============================================================
   UNDO / REDO
   ============================================================ */
function undo(){if(!undoStack.length)return msg('없음');redoStack.push(_snapCurrent());restore(undoStack.pop());msg('실행취소')}
function redo(){if(!redoStack.length)return msg('없음');undoStack.push(_snapCurrent());restore(redoStack.pop());msg('다시실행')}

/* <<< end 1263-1343 <<< */
