/* =========================================================================
   editor.main.js — DRAG HANDLES / TOGGLE / EVENT HANDLERS / PUBLIC API
                    PANEL RESIZER
   Load order: 4th (LAST — defines window.EA)
   ========================================================================= */
'use strict';

/* >>> editor.js original lines 856-1108 >>> */
/* ============================================================
   DRAG HANDLES — unified for text blocks + media wraps
   ============================================================ */
/* Shared drag logic — positions in px within fixed canvas, mouse deltas ÷ deckScale */
function startDrag(el,e){
  if(!el)return;
  if(typeof setBlockState==='function'&&typeof isBlock==='function'&&isBlock(el)){
    if(!(selBlocks&&selBlocks.length>1&&selBlocks.includes(el))){
      setBlockState(el,'select');
    }
  }
  if(typeof startMoveDrag==='function')startMoveDrag(el,e);
}

function attachHandles(){
  document.querySelectorAll('.ed-drag-handle,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e').forEach(h=>h.remove());
  const s=curSlide();if(!s)return;
  const activeHandles = new Set();
  if(selBlocks&&selBlocks.length>1){
    selBlocks.forEach(b=>{if(b&&b.closest&&b.closest('.slide')===s)activeHandles.add(b);});
  }else{
    const one=selBlock||sel;
    if(one&&one.closest&&one.closest('.slide')===s)activeHandles.add(one);
  }
  if(!activeHandles.size)return;
  /* 레이아웃 래퍼(.principle-grid2, .joka-grid, .num-grid, .flow)는 제외 — 블럭 아님 */
  const targets=s.querySelectorAll(BLOCK.TARGET_SEL);
  targets.forEach(el=>{
    if(el.closest('.speaker-notes'))return;
    if(!activeHandles.has(el))return;
    if(getComputedStyle(el).position==='static')el.style.position='relative';
    /* Drag handle */
    const h=document.createElement('div');h.className='ed-drag-handle';h.textContent='⠿';
    el.appendChild(h);
    h.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();startDrag(el,e)});
    /* Media-wrap: ensure resize handle exists (may be missing if loaded from saved HTML) */
    if(el.classList.contains('ed-media-wrap')&&!el.querySelector('.ed-resize-handle')){
      const rh=document.createElement('div');rh.className='ed-resize-handle';
      rh.addEventListener('mousedown',e=>{
        if(typeof _startMediaScaleDrag==='function')_startMediaScaleDrag(el,e);
      });
      el.appendChild(rh);
    }
    /* Media-wrap: ensure delete button exists */
    if(el.classList.contains('ed-media-wrap')&&!el.querySelector('.ed-media-del')){
      const d=document.createElement('button');d.className='ed-media-del';d.textContent='✕';
      d.onclick=()=>{push();el.remove();attachHandles();msg('삭제')};
      el.insertBefore(d,el.firstChild);
    }
    /* Media-wrap: ensure 4-side crop handles exist (works for saved HTML too) */
    if(el.classList.contains('ed-media-wrap')&&typeof _attachCropHandles==='function'){
      _attachCropHandles(el);
    }
    /* Resize handles — text blocks only (not media-wrap, which has its own).
       Bottom-right corner: uniform scale (existing behaviour).
       Left/Right edges: width-only resize. */
    if(!el.classList.contains('ed-media-wrap')){
      el.style.overflow='visible';
      const slide=s;

      /* ── helper: position any handle relative to slide ──
         slide 참조를 매번 동적으로 찾음 — 슬라이드 전환/리렌더 시에도
         올바른 기준 좌표계를 유지 (stale closure 방지) */
      function makeHandlePos(rh,getFn){
        function posRH(){
          if(!el.isConnected)return;
          /* 핸들이 붙어있는 현재 slide를 동적으로 찾음 */
          const curSl=el.closest('.slide')||rh.parentElement;
          if(!curSl)return;
          const sc=pAPI.deckScale||1;
          const er=el.getBoundingClientRect(),sr=curSl.getBoundingClientRect();
          const pos=getFn(er,sr,sc);
          rh.style.position='absolute';
          rh.style.left=pos.left+'px';
          rh.style.top=pos.top+'px';
          rh.style.display='block';
          rh.style.zIndex='200';
        }
        posRH();
        rh._posRH=posRH;rh._targetEl=el;
        return posRH;
      }

      /* ── bottom-right scale handle (original) ── */
      const rh=document.createElement('div');rh.className='ed-block-resize';
      slide.appendChild(rh);
      const posRH=makeHandlePos(rh,(er,sr,sc)=>({
        left:(er.right-sr.left)/sc-6,
        top:(er.bottom-sr.top)/sc-6
      }));
      rh._posRH=posRH;rh._targetEl=el;
      rh.addEventListener('mousedown',e=>{
        e.preventDefault();e.stopPropagation();push();
        const sc=pAPI.deckScale;
        const sx=e.clientX;
        const baseW=el.getBoundingClientRect().width/sc;
        el.style.transformOrigin='top left';
        el.classList.add('ed-resizing');
        const SCALE_PROPS=['fontSize','padding','paddingTop','paddingRight','paddingBottom','paddingLeft',
          'gap','rowGap','columnGap','lineHeight','letterSpacing','wordSpacing',
          'borderWidth','borderRadius','textIndent'];
        function snapProps(node){
          const cs=getComputedStyle(node),m={};
          SCALE_PROPS.forEach(p=>{const v=parseFloat(cs[p]);if(v&&v>0)m[p]=v});
          return m;
        }
        const elSnap=snapProps(el);
        const childSnaps=new Map();
        el.querySelectorAll('*').forEach(c=>{
          if(c.classList.contains('ed-drag-handle')||c.classList.contains('ed-block-resize')||
             c.classList.contains('ed-block-resize-w')||c.classList.contains('ed-block-resize-e'))return;
          const sn=snapProps(c);if(Object.keys(sn).length)childSnaps.set(c,sn);
        });
        let finalRatio=1;
        const mv=ev=>{
          const dx=(ev.clientX-sx)/sc;
          finalRatio=Math.max(0.2,(baseW+dx)/baseW);
          el.style.transform='scale('+finalRatio.toFixed(4)+')';
          requestAnimationFrame(posRH);
          requestAnimationFrame(posRW);
          requestAnimationFrame(posRE);
        };
        const up=()=>{
          el.classList.remove('ed-resizing');
          document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
          if(finalRatio===1){el.style.transform='';requestAnimationFrame(posRH);requestAnimationFrame(posRW);requestAnimationFrame(posRE);return}
          const camelToKebab=s=>s.replace(/[A-Z]/g,m=>'-'+m.toLowerCase());
          function applyScale(node,snap){
            Object.entries(snap).forEach(([p,v])=>{
              node.style.setProperty(camelToKebab(p),Math.round(v*finalRatio*100)/100+'px','important');
            });
          }
          applyScale(el,elSnap);
          childSnaps.forEach((snap,c)=>applyScale(c,snap));
          el.style.transform='';
          requestAnimationFrame(posRH);requestAnimationFrame(posRW);requestAnimationFrame(posRE);
        };
        document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
      });

      /* ── LEFT edge width handle ── */
      const rhW=document.createElement('div');rhW.className='ed-block-resize-w';
      slide.appendChild(rhW);
      const posRW=makeHandlePos(rhW,(er,sr,sc)=>({
        left:(er.left-sr.left)/sc-5,
        top:(er.top-sr.top)/sc+(er.height/sc/2)-5
      }));
      rhW._posRH=posRW;rhW._targetEl=el;
      rhW.addEventListener('mousedown',e=>{
        e.preventDefault();e.stopPropagation();push();
        const sc=pAPI.deckScale;
        const sx=e.clientX;
        const er0=el.getBoundingClientRect(),sr0=slide.getBoundingClientRect();
        const startW=er0.width/sc;
        const startLeft=parseFloat(getComputedStyle(el).left)||0;
        /* CSS width:100% / max-width가 인라인 width를 방해 → 강제 오버라이드 */
        el.style.setProperty('width',startW+'px','important');
        el.style.setProperty('max-width','none','important');
        el.classList.add('ed-resizing');
        const mv=ev=>{
          const dx=(ev.clientX-sx)/sc;
          const nw=Math.max(40,startW-dx);
          el.style.setProperty('width',nw+'px','important');
          el.style.left=(startLeft+dx)+'px';
          requestAnimationFrame(posRW);
          requestAnimationFrame(posRH);
          requestAnimationFrame(posRE);
        };
        const up=()=>{
          el.classList.remove('ed-resizing');
          document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
          requestAnimationFrame(posRW);requestAnimationFrame(posRH);requestAnimationFrame(posRE);
        };
        document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
      });

      /* ── RIGHT edge width handle ── */
      const rhE=document.createElement('div');rhE.className='ed-block-resize-e';
      slide.appendChild(rhE);
      const posRE=makeHandlePos(rhE,(er,sr,sc)=>({
        left:(er.right-sr.left)/sc-5,
        top:(er.top-sr.top)/sc+(er.height/sc/2)-5
      }));
      rhE._posRH=posRE;rhE._targetEl=el;
      rhE.addEventListener('mousedown',e=>{
        e.preventDefault();e.stopPropagation();push();
        const sc=pAPI.deckScale;
        const sx=e.clientX;
        const startW=el.getBoundingClientRect().width/sc;
        /* CSS width:100% / max-width가 인라인 width를 방해 → 강제 오버라이드 */
        el.style.setProperty('width',startW+'px','important');
        el.style.setProperty('max-width','none','important');
        el.classList.add('ed-resizing');
        const mv=ev=>{
          const dx=(ev.clientX-sx)/sc;
          const nw=Math.max(40,startW+dx);
          el.style.setProperty('width',nw+'px','important');
          requestAnimationFrame(posRE);
          requestAnimationFrame(posRH);
          requestAnimationFrame(posRW);
        };
        const up=()=>{
          el.classList.remove('ed-resizing');
          document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
          requestAnimationFrame(posRE);requestAnimationFrame(posRH);requestAnimationFrame(posRW);
        };
        document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
      });

      /* store posRW/posRE refs for drag-move sync */
      rh._posRW=posRW;rh._posRE=posRE;
      rhW._posMain=posRH;rhW._posRE=posRE;
      rhE._posMain=posRH;rhE._posRW=posRW;
    }
  });
  s.querySelectorAll('img').forEach(img=>{img.draggable=false;img.addEventListener('dragstart',e=>e.preventDefault())});
}

/* <<< end 856-1108 <<< */
/* >>> editor.js original lines 2238-2646 >>> */
/* ============================================================
   TOGGLE EDITOR
   ============================================================ */
function toggle(){
  const active=document.body.classList.toggle('editor-mode');
  /* Recalculate scale after mode switch (frame size changes due to panels) */
  const refreshViewport=()=>{
    pAPI.updateScale();
    if(typeof upGuide==='function')upGuide();
    if(typeof syncSelectionOverlay==='function')syncSelectionOverlay();
  };
  setTimeout(refreshViewport,50);
  setTimeout(refreshViewport,360);
  if(active){
    pAPI.S.step=pAPI.S.info[pAPI.S.cur].max;pAPI.render();on();buildNav();upGuide();upGrid();renderSw();tbClosed=false;
    _setDirty(false); /* 에디터 진입 시 초기 상태는 clean */
    msg('에디터 ON — Ctrl+S:Save E:Exit G:Grid');}
  else{
    /* Exit editor: clean up artifacts but keep inline styles (positions, sizes) */
    hideBar();document.body.classList.remove('show-grid');
    /* Remove ed-selected highlight */
    document.querySelectorAll('.ed-selected').forEach(e=>e.classList.remove('ed-selected'));
    /* Remove only editor UI artifacts — NOT inline styles */
    document.querySelectorAll('.ed-drag-handle,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e').forEach(h=>h.remove());
    document.querySelectorAll('[contenteditable="true"]').forEach(e=>e.removeAttribute('contenteditable'));
    /* Force all steps visible so edited content shows */
    pAPI.S.step=pAPI.S.info[pAPI.S.cur].max;
    pAPI.render();
    msg('Edit Mode Out');
  }
}

/* ============================================================
   EVENT HANDLERS
   ============================================================ */
function blockFromPointerEvent(e){
  let b=findBlock(e.target);
  if(b)return b;
  if(document.elementsFromPoint){
    const stack=document.elementsFromPoint(e.clientX,e.clientY);
    for(const el of stack){
      b=findBlock(el);
      if(b)return b;
    }
  }
  const picked=[];
  if(selBlocks&&selBlocks.length)picked.push(...selBlocks);
  if(selBlock)picked.push(selBlock);
  for(const el of [...new Set(picked)]){
    if(!el||!el.getBoundingClientRect)continue;
    const r=el.getBoundingClientRect();
    const pad=10;
    if(e.clientX>=r.left-pad&&e.clientX<=r.right+pad&&e.clientY>=r.top-pad&&e.clientY<=r.bottom+pad){
      return el;
    }
  }
  return null;
}

/* Click → select element, show toolbar, or drag media directly */
document.addEventListener('mousedown',e=>{
  if(!isEd())return;
  if(e.target.closest(BLOCK.ARTIFACT_SEL))return;

  if(suppressNextSelect){suppressNextSelect=false;return;}

  const clickedBlock=blockFromPointerEvent(e);
  const isEditingText=e.target.closest&&e.target.closest('[contenteditable="true"]');

  /* Alt + 드래그 = 단일 블럭 복제 후 드롭 위치로 이동 */
  if(e.altKey&&clickedBlock&&!isEditingText){
    setBlockState(clickedBlock,'select');
    showBar&&showBar(clickedBlock);
    startDuplicateDrag(clickedBlock,e);
    return;
  }

  /* Space + 드래그 = 기존 선택 블럭(들) 이동 */
  if(moveKeyHeld&&clickedBlock&&!isEditingText){
    let anchor=selBlock;
    if(!anchor || !selBlocks.includes(clickedBlock)){
      if(selBlocks.length<=1){
        setBlockState(clickedBlock,'select');
        showBar&&showBar(clickedBlock);
      }
      anchor=clickedBlock;
    }
    startMoveDrag(anchor,e);
    return;
  }

  /* media wrap — 클릭 = 선택 + 바로 드래그 이동 (alt 필요 없음).
     드래그 여부는 마우스가 실제로 움직였는지로 판단되므로 단순 클릭은 여전히
     "선택만" 으로 끝난다. */
  const mw=e.target.closest('.ed-media-wrap');
  if(mw){
    /* 리사이즈 핸들/삭제 버튼/영상 컨트롤 등 내부 UI 클릭은 드래그 금지 */
    if(e.target.closest('.ed-resize-handle,.ed-media-del,.ed-crop-handle,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e')){
      return;
    }
    setBlockState(mw,'select');
    showBar(mw);
    _syncVideoButtons(mw.querySelector('video'));
    startMoveDrag(mw, e);
    return;
  }

  /* Shift+클릭 = 다중 선택 토글 */
  if(e.shiftKey&&!isEditingText){
    const blk=findBlock(e.target);
    if(blk){
      const sX=e.clientX,sY=e.clientY;
      let dragged=false;
      const mv=ev=>{
        if(dragged)return;
        if(Math.hypot(ev.clientX-sX,ev.clientY-sY)<3)return;
        dragged=true;
        document.removeEventListener('mousemove',mv);
        document.removeEventListener('mouseup',up);
        if(!(selBlocks&&selBlocks.length>1&&selBlocks.includes(blk))){
          setBlockState(blk,'select');
          showBar&&showBar(blk);
        }else{
          showBar&&showBar(blk);
        }
        startMoveDrag(blk,e,{initialMoveEvent:ev});
      };
      const up=()=>{
        document.removeEventListener('mousemove',mv);
        document.removeEventListener('mouseup',up);
        if(dragged)return;
        toggleBlockSelection(blk);
        showBar(blk);
        tbClosed=false;
      };
      document.addEventListener('mousemove',mv);
      document.addEventListener('mouseup',up);
      e.preventDefault();
      return;
    }
  }

  /* 일반 블럭도 미디어처럼 본체 드래그로 이동 */
  if(clickedBlock&&!isEditingText){
    if(!(selBlocks&&selBlocks.length>1&&selBlocks.includes(clickedBlock))){
      setBlockState(clickedBlock,'select');
      showBar&&showBar(clickedBlock);
    }
    startMoveDrag(clickedBlock,e);
    tbClosed=false;
    return;
  }

  /* 블럭 시스템 v2 — 한 겹 파고들기 */
  clickBlockAt(e);
  tbClosed=false;
});

/* 더블클릭 — 리프까지 즉시 파고들어 편집 진입
   · 영상 재생 중에는 단일 클릭이 video 컨트롤로 먹혀서 선택이 꼬일 수 있음.
     더블클릭 = 명시적 선택 + 패널 강제 refresh 진입점. */
document.addEventListener('dblclick',e=>{
  if(!isEd())return;
  if(e.target.closest(BLOCK.ARTIFACT_SEL))return;
  const mw=e.target.closest('.ed-media-wrap');
  if(mw){
    /* 영상이 재생 중이라도 강제로 선택하고 패널을 띄움 */
    e.preventDefault();
    e.stopPropagation();
    if(typeof setBlockState==='function')setBlockState(mw,'select');
    if(typeof showBar==='function')showBar(mw);
    _syncVideoButtons(mw.querySelector('video'));
    /* _setSel 이 PanelCtx 에 알리지만 직접 호출도 해둔다 (재생 중 포커스 꼬임 대비) */
    if(window.PanelCtx&&PanelCtx.refresh)PanelCtx.refresh(mw, selBlocks, selBlock);
    return;
  }
  const blk=findBlock(e.target);
  if(blk){
    e.preventDefault();
    e.stopPropagation();
    let leaf=blk;
    while(leaf&&!isLeafBlock(leaf)){
      const child=drillDownBlock(leaf,e.clientX,e.clientY);
      if(!child)break;
      leaf=child;
    }
    if(leaf){
      setBlockState(leaf,'edit');
      showBar&&showBar(leaf);
    }
  }
});

/* Format commands */
function execCmd(c){document.execCommand(c,false,null)}
function setAlign(d){if(!sel)return;push();sel.style.textAlign=d}
function setSizeMode(m){sizeMode=m;$('edSizeBlock').classList.toggle('active',m==='block');$('edSizeSel').classList.toggle('active',m==='sel')}
function setSize(v){
  if(!v)return;if(!/[a-z%]/i.test(v))v+='px';
  if(sizeMode==='sel'){
    const s=window.getSelection();
    if(s&&s.rangeCount>0&&!s.isCollapsed){const sp=document.createElement('span');sp.style.fontSize=v;const rng=s.getRangeAt(0);sp.appendChild(rng.extractContents());rng.insertNode(sp);s.removeAllRanges();return}
  }
  if(sel){push();sel.style.fontSize=v}
}
function setColor(c){
  if(!sel)return;push();
  const s=window.getSelection();
  if(s&&s.rangeCount>0&&!s.isCollapsed)document.execCommand('foreColor',false,c);
  else sel.style.color=c;
}
function setLineHeight(v){if(sel&&v){push();sel.style.lineHeight=v}}
function setLetterSpacing(v){if(sel&&v){push();sel.style.letterSpacing=/[a-z%]/i.test(v)?v:v+'px'}}
function deleteElement(){
  /* 블럭 시스템 v2 우선 */
  if(selBlock){deleteBlockClean(selBlock);return;}
  if(editingBlock){deleteBlockClean(editingBlock);return;}
  /* 구 sel fallback — 찌꺼기 정리 추가 */
  if(!sel)return;
  push();const el=sel;_setSel(null);
  el.querySelectorAll&&el.querySelectorAll(BLOCK.ARTIFACT_SEL).forEach(a=>a.remove());
  el.remove();
  attachHandles&&attachHandles();
  hideBar();msg('삭제');
}

function alignEl(dir){
  if(!sel)return;push();const gr=guide._r;if(!gr)return;
  const sc=pAPI.deckScale;
  const dr=deck.getBoundingClientRect(),er=sel.getBoundingClientRect();
  if(!sel.classList.contains('ed-media-wrap'))sel.style.position='relative';
  const cl=parseFloat(sel.style.left)||0,ct=parseFloat(sel.style.top)||0;
  /* Convert screen coords to canvas coords */
  const eL=(er.left-dr.left)/sc,eT=(er.top-dr.top)/sc,eW=er.width/sc,eH=er.height/sc;
  const map={left:['left',cl+gr.x-eL],right:['left',cl+(gr.x+gr.w)-(eL+eW)],centerH:['left',cl+(gr.x+gr.w/2)-(eL+eW/2)],top:['top',ct+gr.y-eT],bottom:['top',ct+(gr.y+gr.h)-(eT+eH)],centerV:['top',ct+(gr.y+gr.h/2)-(eT+eH/2)]};
  const [p,v]=map[dir];sel.style[p]=v+'px';
}
function zIndex(d){
  if(!sel)return;push();
  if(sel.classList.contains('ed-media-wrap')){
    /* Media wraps: z-index alone can't go below text because slide creates a stacking context.
       Solution: keep media at z-index:0, elevate all sibling text to z-index:1 when sending back,
       or raise media z-index above text when bringing forward. */
    const p=sel.parentElement;
    const SKIP=['ed-media-wrap','ed-block-resize','ed-drag-handle','speaker-notes','ed-media-del','ed-resize-handle'];
    const textSibs=[...p.children].filter(c=>!SKIP.some(cls=>c.classList.contains(cls)));
    if(d<0){/* 뒤로: media stays at 0, raise text siblings to z-index:1 */
      sel.style.zIndex='0';
      textSibs.forEach(c=>{c.style.position='relative';if((parseInt(c.style.zIndex)||0)<1)c.style.zIndex='1';});
    }else{/* 앞으로: raise media above all text siblings */
      const maxZ=textSibs.reduce((m,c)=>Math.max(m,parseInt(getComputedStyle(c).zIndex)||0),0);
      sel.style.zIndex=String(maxZ+CFG.ZINDEX_STEP);
    }
    msg(d<0?'레이어: 텍스트 뒤':'레이어: 텍스트 앞');
    return;
  }
  const c=parseInt(getComputedStyle(sel).zIndex)||0;sel.style.zIndex=Math.max(0,c+d*CFG.ZINDEX_STEP);sel.style.position='relative';msg('z: '+(c+d*CFG.ZINDEX_STEP));
}
function _getSelVideo(){return sel&&sel.classList.contains('ed-media-wrap')?sel.querySelector('video'):null}
function _syncVideoButtons(v){
  const ba=$('edBtnAutoplay'),bl=$('edBtnLoop'),bm=$('edBtnMute'),bp=$('edBtnPlay');
  if(ba){ba.textContent=v&&v.autoplay?'자동재생 ON':'자동재생 OFF';ba.style.color=v&&v.autoplay?'var(--g)':'';}
  if(bl){bl.textContent=v&&v.loop?'반복재생 ON':'반복재생 OFF';bl.style.color=v&&v.loop?'var(--g)':'';}
  if(bm){bm.textContent=v&&!v.muted?'소리 ON':'소리 OFF';bm.style.color=v&&!v.muted?'var(--g)':'';}
  if(bp){bp.textContent=v&&!v.paused?'⏸ 일시정지':'▶ 재생';bp.style.color=v&&!v.paused?'var(--g)':'';}
}
/* 영상 컨트롤 — 속성 변경과 실시간 재생 상태를 동시에 반영.
   · 재생 중이어도 즉시 효과가 나타나도록 play/pause/muted 를 직접 조작한다.
   · autoplay 는 저장 후 재생 시에도 동일하게 작동하도록 속성도 같이 반영. */
function toggleVideoAutoplay(){
  const v=_getSelVideo();if(!v)return;push();
  v.autoplay=!v.autoplay;
  /* autoplay ON 으로 켜면 즉시 재생 시작 (재생 중이 아니었을 때) */
  if(v.autoplay && v.paused){ try{v.play();}catch(e){} }
  _syncVideoButtons(v);msg('자동재생: '+(v.autoplay?'ON':'OFF'));
}
function toggleVideoLoop(){
  const v=_getSelVideo();if(!v)return;push();
  v.loop=!v.loop;
  /* loop 속성은 즉시 반영되지만 HTML attribute 도 같이 맞춰준다 (저장 안정성) */
  if(v.loop)v.setAttribute('loop','');else v.removeAttribute('loop');
  _syncVideoButtons(v);msg('반복재생: '+(v.loop?'ON':'OFF'));
}
function toggleVideoMute(){
  const v=_getSelVideo();if(!v)return;push();
  v.muted=!v.muted;
  if(v.muted)v.setAttribute('muted','');else v.removeAttribute('muted');
  _syncVideoButtons(v);msg('소리: '+(v.muted?'OFF':'ON'));
}
/* 재생 ↔ 일시정지 — edit 모드에서도 바로 동작 */
function toggleVideoPlay(){
  const v=_getSelVideo();if(!v)return;
  if(v.paused){ try{v.play();msg('재생');}catch(e){msg('재생 실패')} }
  else       { try{v.pause();msg('일시정지');}catch(e){} }
  _syncVideoButtons(v);
}
function dupEl(){
  const source=currentBlock&&currentBlock()||sel;
  if(!source)return;push();
  materializeForBlocks([source]);
  const c=cloneBlockForDuplicate(source);
  if(!c)return;
  if(typeof placeDuplicateBlockAtSource!=='function')return;
  if(!placeDuplicateBlockAtSource(source,c,CFG.DUP_OFFSET,CFG.DUP_OFFSET))return;
  attachHandles&&attachHandles();on&&on();
  setBlockState(c,'select');showBar&&showBar(c);
  msg('복제');
}
function setSlideBg(c){push();curSlide().style.background=c;$('edSlideBg').value=c}

/* Keyboard shortcuts */
document.addEventListener('keydown',e=>{
  if(!isEd())return;
  /* ────────────────────────────────────────────────────────────
     v2.1 가드 — 패널/툴바/내비 input·textarea·select 안에서는
     에디터 단축키를 모두 양보한다 (Backspace로 블럭 삭제되는 사고 방지).
     단, Ctrl+S(save), Ctrl+Z(undo) 같은 글로벌 단축키는 패널 안에서도 살아있어야 하므로
     아래 분기에서 Ctrl/Meta 조합은 통과시키고, 나머지 일반 키 입력만 차단한다.
     ──────────────────────────────────────────────────────────── */
  const _t=e.target;
  const _tag=_t&&_t.tagName;
  const _isFormControl=(_tag==='INPUT'||_tag==='TEXTAREA'||_tag==='SELECT');
  const _inUI=_t&&_t.closest&&_t.closest('.ed-panel, .ed-toolbar, .ed-nav, .ed-confirm, .ed-ctx-menu');
  /* F2 = 현재 선택된 슬라이드 이름 변경 */
  if(e.key==='F2'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&!e.target.isContentEditable){
    e.preventDefault();
    renameSlide(pAPI.S.cur);
    return;
  }
  if((_isFormControl||_inUI)&&!_t.isContentEditable){
    /* 글로벌 save/undo/redo만 통과시키고 그 외 키는 모두 양보 */
    const _isGlobal = (e.ctrlKey||e.metaKey) && (
      e.key==='s'||e.key==='S'||
      e.key==='z'||e.key==='Z'||
      e.key==='y'||e.key==='Y'
    );
    if(!_isGlobal)return;
  }
  /* Ctrl+S = save */
  if(e.ctrlKey&&e.key==='s'&&!e.shiftKey){e.preventDefault();save();return}
  /* Ctrl+Shift+S = export (presentation-only file) */
  if(e.ctrlKey&&e.shiftKey&&(e.key==='s'||e.key==='S')){e.preventDefault();exportHTML();return}
  /* Ctrl+Z / Ctrl+Shift+Z — let browser handle native undo inside contenteditable,
     use custom deck-level undo only when NOT typing in an editable element */
  if(e.ctrlKey&&e.key==='z'&&!e.shiftKey){
    if(e.target.isContentEditable)return;/* browser native undo */
    e.preventDefault();undo();return;
  }
  if(e.ctrlKey&&e.shiftKey&&(e.key==='z'||e.key==='Z')){
    if(e.target.isContentEditable)return;/* browser native redo */
    e.preventDefault();redo();return;
  }
  if(e.ctrlKey&&e.key==='y'){
    if(e.target.isContentEditable)return;
    e.preventDefault();redo();return;
  }
  /* Ctrl+D = duplicate element (텍스트 편집 중에는 브라우저 기본 동작 양보) */
  if(e.ctrlKey&&!e.shiftKey&&(e.key==='d'||e.key==='D')&&!editingBlock&&!e.target.isContentEditable){e.preventDefault();dupEl();return}

  /* ── Space 홀드 = 이동 모드 ── */
  if(e.code==='Space'&&!e.target.isContentEditable&&!e.repeat){
    /* input/textarea에 포커스된 경우(사이드바 입력창 등) Space는 공백으로 */
    const tag=e.target.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    /* 사이드바 패널 내부는 무시 */
    if(e.target.closest&&e.target.closest('.ed-panel, .ed-toolbar, .ed-nav'))return;
    moveKeyHeld=true;
    document.body.classList.add('ed-move-mode');
    /* 슬라이드 스크롤 방지 */
    if(selBlock||selBlocks.length)e.preventDefault();
  }

  /* ── Ctrl+0 = 원 위치 복귀 ── */
  if(e.ctrlKey&&e.key==='0'&&!e.target.isContentEditable){
    e.preventDefault();
    const targets = selBlocks.length ? selBlocks : (selBlock?[selBlock]:[]);
    if(!targets.length){msg('블럭을 선택하세요');return;}
    push();
    targets.forEach(b=>{
      b.style.left='';b.style.top='';b.style.position='';b.style.transform='';
    });
    _setDirty(true);msg('원 위치 복귀');
    return;
  }

  /* Arrow nudge (블럭 시스템 v2) */
  if(!e.target.isContentEditable&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
    const targets = selBlocks.length ? selBlocks : (selBlock?[selBlock]:(sel?[sel]:[]));
    if(!targets.length)return;
    e.preventDefault();
    const d=e.shiftKey?(CFG.NUDGE_LG||10):(CFG.NUDGE_SM||1);
    push();
    materializeForBlocks(targets);
    targets.forEach(b=>{
      let lPx=parseFloat(b.style.left)||0, tPx=parseFloat(b.style.top)||0;
      if(e.key==='ArrowLeft')lPx-=d;
      if(e.key==='ArrowRight')lPx+=d;
      if(e.key==='ArrowUp')tPx-=d;
      if(e.key==='ArrowDown')tPx+=d;
      b.style.left=lPx+'px';b.style.top=tPx+'px';
    });
    _setDirty(true);
    return;
  }
  /* Delete / Backspace — 블럭 시스템 v2 우선
     - SELECTED 상태: 블럭 통째 삭제 (찌꺼기 없이)
     - EDITING 상태: 브라우저 기본 동작(글자 삭제)
     - EDITING + Ctrl/Shift: 블럭 통째 강제 삭제 */
  if(e.key==='Delete'||e.key==='Backspace'){
    /* 다중 선택 상태 — 전부 삭제 */
    if(selBlocks.length>1){
      e.preventDefault();push();
      const toDel=[...selBlocks];
      _removeBlocksPreservingFlow(toDel);
      selBlocks=[];selBlock=null;editingBlock=null;
      if(typeof _setSel==='function')_setSel(null);
      attachHandles&&attachHandles();
      hideBar();msg(toDel.length+'개 블럭 삭제');_setDirty(true);
      return;
    }
    /* EDITING 중 — 강제 삭제 아니면 글자 삭제 */
    if(editingBlock){
      if(e.ctrlKey||e.metaKey||e.shiftKey){
        e.preventDefault();deleteBlockClean(editingBlock);return;
      }
      return; /* 브라우저 기본 동작 */
    }
    /* SELECTED — 블럭 삭제 */
    if(selBlock){
      e.preventDefault();deleteBlockClean(selBlock);return;
    }
    /* fallback: 구 sel 시스템 (media wrap 등) */
    if(sel){
      if(e.ctrlKey||e.metaKey||e.shiftKey){e.preventDefault();deleteElement();return;}
      if(e.target.isContentEditable)return;
      e.preventDefault();deleteElement();
    }
  }

  /* ESC — EDITING→SELECTED, SELECTED→부모, 최상위에서 IDLE */
  if(e.key==='Escape'){
    if(editingBlock){
      const b=editingBlock;
      b.removeAttribute('contenteditable');b.blur&&b.blur();
      setBlockState(b,'select');
      showBar&&showBar(b);
      e.preventDefault();return;
    }
    if(selBlock){
      const p=parentBlock(selBlock);
      if(p){setBlockState(p,'select');showBar&&showBar(p);}
      else {setBlockState(null,'idle');hideBar();}
      e.preventDefault();return;
    }
  }

  /* Enter / F2 — SELECTED → EDITING */
  if((e.key==='Enter'||e.key==='F2')&&selBlock&&!editingBlock){
    if(e.target.isContentEditable)return;
    if(isLeafBlock(selBlock)){
      setBlockState(selBlock,'edit');
      showBar&&showBar(selBlock);
      e.preventDefault();
    }else{
      /* 컨테이너면 한 겹 파고들기 */
      const firstLeaf=[...selBlock.querySelectorAll('*')].find(c=>isBlock(c)&&isLeafBlock(c));
      if(firstLeaf){setBlockState(firstLeaf,'edit');showBar&&showBar(firstLeaf);e.preventDefault();}
    }
  }

  /* Ctrl+G — 감싸기 */
  if(e.ctrlKey&&!e.shiftKey&&(e.key==='g'||e.key==='G')){
    if(selBlocks.length){e.preventDefault();groupBlocksWrap(selBlocks);return;}
    if(selBlock){e.preventDefault();groupBlocksWrap([selBlock]);return;}
  }
  /* Ctrl+Shift+G — 풀기 */
  if(e.ctrlKey&&e.shiftKey&&(e.key==='g'||e.key==='G')){
    if(selBlock){e.preventDefault();ungroupBlockUnwrap(selBlock);return;}
  }
  /* W — Wrap in Card / Shift+W — Wrap in Frame (v2.1, EDITING 제외) */
  if(!editingBlock&&!e.target.isContentEditable&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(e.key==='w'||e.key==='W')){
    const targets=selBlocks.length?selBlocks:(selBlock?[selBlock]:[]);
    if(targets.length){
      e.preventDefault();
      if(e.shiftKey)wrapBlocks(targets,{mode:'frame',layout:null,autoSeq:false});
      else          wrapBlocks(targets,{mode:'card', layout:'v',autoSeq:true,gap:12,padding:16});
      return;
    }
  }
  /* Ctrl+Alt+K — Create Component */
  if(e.ctrlKey&&e.altKey&&(e.key==='k'||e.key==='K')){
    if(selBlock){e.preventDefault();makeComponent(selBlock);return;}
  }
  /* Ctrl+Alt+B — Detach Instance */
  if(e.ctrlKey&&e.altKey&&(e.key==='b'||e.key==='B')){
    if(selBlock){e.preventDefault();detachInstance(selBlock);return;}
  }
});

/* Space 키업 — 이동 모드 해제 */
document.addEventListener('keyup',e=>{
  if(e.code==='Space'){
    moveKeyHeld=false;
    document.body.classList.remove('ed-move-mode');
  }
});
/* 창 포커스 나갔다 들어오면 moveKeyHeld 리셋 (키업 놓침 방지) */
window.addEventListener('blur',()=>{moveKeyHeld=false;document.body.classList.remove('ed-move-mode');});

document.addEventListener('focusout',e=>{
  if(e.target.closest&&e.target.closest('.ed-nav-title'))return;
  if(e.target.isContentEditable&&isEd()){push();buildNav();_setDirty(true)}
});

/* Click-to-play/pause in presentation mode (only when clicking the wrap, not native controls) */
document.addEventListener('click',e=>{
  if(isEd())return;
  if(e.target.closest('video,iframe'))return;/* let native controls handle video clicks */
  const mw=e.target.closest('.ed-media-wrap');if(!mw)return;
  const v=mw.querySelector('video');if(!v)return;
  e.stopPropagation();
  v.paused?v.play():v.pause();
});
/* resize is handled by pAPI.updateScale in presentation engine */

/* <<< end 2238-2646 <<< */
/* >>> editor.js original lines 2746-2858 >>> */
/* ============================================================
   PUBLIC API — single entry point, all methods exposed
   ============================================================ */
function setStepOrder(v){
  const targets=selBlocks.length?selBlocks:(selBlock?[selBlock]:(sel?[sel]:[]));
  if(!targets.length){msg('블럭을 먼저 선택하세요');return;}
  const raw=String(v==null?'':v).trim();
  if(raw!==''){
    const n=parseFloat(raw);
    if(!Number.isFinite(n)||n<=0){msg('등장 순서는 1 이상의 숫자');return;}
  }
  push();
  if(raw===''){
    targets.forEach(el=>{el.removeAttribute('data-sort');el.removeAttribute('data-step-lock');});
    msg('등장 순서 자동');
  }else{
    const n=parseFloat(raw);
    targets.forEach(el=>{
      el.setAttribute('data-sort',String(n));
      el.setAttribute('data-step',String(n));
      el.removeAttribute('data-step-auto');
    });
    msg('등장 순서 '+n);
  }
  _setDirty(true);
  if(window.pAPI&&pAPI.reinit){pAPI.reinit();pAPI.S.step=pAPI.S.info[pAPI.S.cur].max;pAPI.render();}
  if(window.PanelCtx&&PanelCtx.refresh)PanelCtx.refresh(sel, selBlocks, selBlock);
}
window.EA={
  toggle, addSlide, insertImage, insertImageURL, insertVideo, insertVideoFile,
  duplicateSlide:()=>dupAt(pAPI.S.cur), deleteSlide:()=>delAt(pAPI.S.cur), dupAt, delAt,
  insertBlankAfter:(i)=>insertBlankAfter(typeof i==='number'?i:pAPI.S.cur),
  moveSlide, renameSlide,
  save, saveAs, exportHTML, resetAll, undo, redo, downloadHTML, execCmd, setAlign, setSizeMode, setSize, setColor,
  autoStepBySlide, setStepOrder,
  setLineHeight, setLetterSpacing, alignEl, zIndex, duplicateEl:dupEl,
  setSlideBg, setPalette, savePalette, loadPalette, savePaletteFile, loadPaletteFile, resetSlide, updateGrid:upGrid,
  minimizeToolbar:minBar, closeToolbar:closeBar, toggleVideoAutoplay, toggleVideoLoop, toggleVideoMute, toggleVideoPlay,
  applyAnim, removeAnim, resetAnim, _sw:sw,
  /* ── 블럭 시스템 v2 ── 툴바 ✕ 버튼용 */
  deleteElement: ()=>{
    if(selBlocks.length>1){
      push();
      const toDel=[...selBlocks];
      _removeBlocksPreservingFlow(toDel);
      selBlocks=[];selBlock=null;editingBlock=null;
      attachHandles&&attachHandles();hideBar();_setDirty(true);msg(toDel.length+'개 블럭 삭제');
      return;
    }
    deleteElement(); /* 전역 함수 — 블럭 시스템 우선 로직 내장 */
  },
  insertBlock: (type)=>insertBlockAfter(type,currentBlock()),
  groupSelection: ()=>{
    if(selBlocks.length)groupBlocksWrap(selBlocks);
    else if(selBlock)groupBlocksWrap([selBlock]);
    else msg('블럭을 먼저 선택하세요');
  },
  ungroupSelection: ()=>{
    if(selBlock)ungroupBlockUnwrap(selBlock);
    else msg('컨테이너 블럭을 선택하세요');
  },
  resetPosition: ()=>{
    const targets = selBlocks.length ? selBlocks : (selBlock?[selBlock]:[]);
    if(!targets.length){msg('블럭을 선택하세요');return;}
    push();
    targets.forEach(b=>{b.style.left='';b.style.top='';b.style.position='';b.style.transform='';});
    _setDirty(true);msg('원 위치 복귀');
  },
  /* 자식 순차 등장 토글 — data-anim-children="seq" 부여/제거 후 reinit */
  toggleAnimChildren: (on)=>{
    const target = selBlock || (selBlocks.length===1 ? selBlocks[0] : null);
    if(!target){msg('블럭 하나를 선택하세요');return;}
    if(target.children.length < 2){msg('직계 자식이 2개 이상이어야 합니다');return;}
    push();
    if(on){
      target.setAttribute('data-anim-children','seq');
      msg('자식 '+target.children.length+'개 순차 등장 ON');
    }else{
      target.removeAttribute('data-anim-children');
      target.querySelectorAll('[data-step-auto="1"]').forEach(e=>{
        e.removeAttribute('data-step');
        e.removeAttribute('data-step-auto');
      });
      msg('자식 순차 등장 OFF');
    }
    _setDirty(true);
    if(window.pAPI && window.pAPI.reinit) window.pAPI.reinit();
  },
  /* ─── BLOCK SYSTEM v2.1 — Group / Auto-Layout / Component / Constraints ─── */
  _wrapTargets: ()=>(selBlocks.length?selBlocks:(selBlock?[selBlock]:[])),
  wrapAsCard: ()=>{
    const t=(selBlocks.length?selBlocks:(selBlock?[selBlock]:[]));
    if(!t.length){msg('블럭을 먼저 선택하세요');return;}
    /* v2.1: Card 디폴트 = Auto Layout V + gap 12 + pad 16 (피그마 방식) */
    wrapBlocks(t,{mode:'card',layout:'v',autoSeq:true,gap:12,padding:16});
  },
  wrapAsFrame: ()=>{
    const t=(selBlocks.length?selBlocks:(selBlock?[selBlock]:[]));
    if(!t.length){msg('블럭을 먼저 선택하세요');return;}
    wrapBlocks(t,{mode:'frame',layout:null,autoSeq:false});
  },
  unwrapBlock: ()=>{
    if(!selBlock){msg('컨테이너 블럭을 선택하세요');return;}
    unwrapBlock(selBlock);
  },
  setLayout: (dir)=>{ if(selBlock)setLayoutDirection(selBlock,dir); },
  setGap:    (px)=>{ if(selBlock)setLayoutGap(selBlock,px); },
  setPadding:(t,r,b,l)=>{ if(selBlock)setLayoutPadding(selBlock,t,r,b,l); },
  setLayoutAlign:(a)=>{ if(selBlock)setLayoutAlign(selBlock,a); },
  setCrop, readCrop, resetCrop, setCropScale, resetCropScale,
  makeComponent: ()=>{ if(selBlock)makeComponent(selBlock); else msg('블럭을 선택하세요'); },
  detachInstance: ()=>{ if(selBlock)detachInstance(selBlock); else msg('인스턴스를 선택하세요'); },
  setConstraintH:(v)=>{ if(selBlock)setConstraint(selBlock,'h',v); },
  setConstraintV:(v)=>{ if(selBlock)setConstraint(selBlock,'v',v); },
  _readGroupAttrs: ()=>{
    if(!selBlock)return null;
    return {
      mode: selBlock.getAttribute('data-group-mode')||'',
      layout: selBlock.getAttribute('data-layout')||'',
      gap: selBlock.getAttribute('data-gap')||'',
      pad:  selBlock.getAttribute('data-pad')||'',
      padT: selBlock.getAttribute('data-pad-t')||'',
      padR: selBlock.getAttribute('data-pad-r')||'',
      padB: selBlock.getAttribute('data-pad-b')||'',
      padL: selBlock.getAttribute('data-pad-l')||'',
      align: selBlock.getAttribute('data-align')||'',
      isComponent: selBlock.classList.contains('ed-component'),
      isInstance:  selBlock.classList.contains('ed-instance'),
      constrainH:  selBlock.getAttribute('data-constrain-h')||'left',
      constrainV:  selBlock.getAttribute('data-constrain-v')||'top'
    };
  }
};
/* Component observer 초기화 (deck 준비 후) */
try{ if(typeof _initComponentObserver==='function')_initComponentObserver(); }catch(e){ console.warn('Component observer init failed:', e); }
/* 마이그레이션: 기존 .ed-group 요소에 data-group-mode 자동 부여 (1회) */
try{
  document.querySelectorAll('.ed-group:not([data-group-mode])').forEach(el=>{
    el.setAttribute('data-group-mode', el.classList.contains('ed-group-frame')?'frame':'card');
  });
}catch(e){}
/* Always init guide on load and on resize */
upGuide();
window.addEventListener('resize',()=>requestAnimationFrame(upGuide));
/* Apply char wrapping to any [data-anim] elements already in the HTML on load */
_reapplyAnimChars(deck);

/* ============================================================
   PANEL RESIZER — 우측 패널 폭 조절 (피그마 방식)
   ============================================================ */
(function initPanelResizer(){
  const panel=document.querySelector('aside.ed-panel');
  if(!panel)return;
  let handle=document.getElementById('edPanelResizer');
  if(!handle){
    handle=document.createElement('div');
    handle.className='ed-panel-resizer';
    handle.id='edPanelResizer';
    handle.title='드래그: 폭 조절 / 더블클릭: 리셋';
    document.body.appendChild(handle);
  }
  const LS='ed_panel_w',MIN=240,MAX=480,DEF=280;
  function setW(w){
    w=Math.max(MIN,Math.min(MAX,w));
    panel.style.width=w+'px';
    handle.style.right=w+'px';
    try{localStorage.setItem(LS,String(w))}catch(e){}
  }
  let saved=DEF;
  try{const v=+localStorage.getItem(LS);if(v>=MIN&&v<=MAX)saved=v}catch(e){}
  setW(saved);
  let dragging=false;
  handle.addEventListener('mousedown',e=>{
    e.preventDefault();dragging=true;
    handle.classList.add('active');
    document.body.classList.add('ed-resizing');
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging)return;
    setW(window.innerWidth-e.clientX);
  });
  document.addEventListener('mouseup',()=>{
    if(!dragging)return;
    dragging=false;
    handle.classList.remove('active');
    document.body.classList.remove('ed-resizing');
  });
  handle.addEventListener('dblclick',()=>setW(DEF));
})();
/* <<< end 2746-2858 <<< */
