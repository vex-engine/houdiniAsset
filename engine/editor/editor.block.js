/* =========================================================================
   editor.block.js — BLOCK SYSTEM v2 / AUTO STEP / ANIMATION PRESETS
   Load order: 2nd (after core.js)
   ========================================================================= */
'use strict';

/* >>> editor.js original lines 41-494 >>> */
/* ============================================================
   BLOCK SYSTEM v2 — Figma-style nested block selection/editing
   설계 문서: engine/BLOCK_SYSTEM.md
   ============================================================ */
const BLOCK = {
  SEL_CLASS: 'ed-selected-block',
  EDIT_CLASS: 'ed-editing-block',
  /* 블럭으로 인정하는 컨테이너 selector (피그마식 — 자식도 개별 블럭) */
  CONTAINER_SEL: '.principle-card, .joka-cell, .card, .num-item, .flow-step, .two-col, .code-block, .ed-media-wrap',
  /* 레이아웃 래퍼 — 블럭 아님 (클릭 시 IDLE로). 빈 공간 클릭 보장용 */
  LAYOUT_WRAPPER_SEL: '.principle-grid2, .joka-grid, .num-grid, .flow, .demo-wrap, .demo-info',
  /* 에디터 UI artifact — 블럭에서 제외 */
  ARTIFACT_SEL: '.ed-drag-handle, .ed-block-resize, .ed-block-resize-w, .ed-block-resize-e, .ed-resize-handle, .ed-media-del, .ed-toolbar, .ed-panel, .ed-nav, .ed-confirm',
  /* 리프 텍스트 태그 */
  TEXT_TAGS_SEL: 'h1, h2, h3, p, li, td, th',
  /* 리프 div 클래스 접두사 (p-kor, j-char 등) — 피그마식: 자식도 블럭 */
  LEAF_CLASS_PREFIXES: ['p-', 'j-', 'n-', 'f-', 'uc-', 'jf-'],
};
/* 블럭 시스템 상태 — 기존 sel과 별도 관리. Phase 3에서 배열 확장 */
let selBlock = null;          // 현재 SELECTED 블럭 (단일)
let selBlocks = [];           // Phase 3: 다중 선택용
let editingBlock = null;      // 현재 EDITING 블럭
let lastClickedBlock = null;  // 직전 클릭된 블럭 (파고들기 기준점)
let lastClickTime = 0;        // 더블클릭 감지
let suppressNextSelect = false; // 드래그 직후 selection 재설정 방지
/* Space/Alt + 드래그 이동용 */
let moveKeyHeld = false;      // Space 또는 Alt 누름 상태
let moveInProgress = false;   // 현재 드래그-이동 중

/* 주어진 요소가 "블럭"인지 판정. 선택자는 여기에만 하드코딩 */
function isBlock(el){
  if(!el||el.nodeType!==1)return false;
  if(el===document.body||el===document.documentElement)return false;
  if(el.matches&&el.matches(BLOCK.ARTIFACT_SEL))return false;
  if(el.closest&&el.closest('.speaker-notes'))return false;
  /* 슬라이드 자체는 블럭 아님 */
  if(el.classList&&el.classList.contains('slide'))return false;
  /* 레이아웃 래퍼는 블럭 아님 — 빈 공간 클릭 보장용 (피그마식) */
  if(el.matches&&el.matches(BLOCK.LAYOUT_WRAPPER_SEL))return false;
  /* 컨테이너 클래스 — LAYOUT_WRAPPER 체크 후라서 순서 중요 */
  if(el.matches&&el.matches(BLOCK.CONTAINER_SEL))return true;
  /* [data-step] */
  if(el.hasAttribute&&el.hasAttribute('data-step'))return true;
  /* 기본 텍스트 태그 */
  if(el.matches&&el.matches(BLOCK.TEXT_TAGS_SEL))return true;
  /* 리프 div (p-kor, j-char 등 접두사) */
  if(el.tagName==='DIV'&&el.className&&typeof el.className==='string'){
    const cls=el.className.split(/\s+/);
    for(const c of cls){
      for(const pfx of BLOCK.LEAF_CLASS_PREFIXES){
        if(c.startsWith(pfx))return true;
      }
    }
  }
  return false;
}

/* 주어진 DOM 노드를 감싸는 가장 가까운 블럭 */
function findBlock(el){
  while(el&&el.nodeType===1){
    if(isBlock(el))return el;
    el=el.parentElement;
  }
  return null;
}

/* 블럭 el의 부모 블럭(역시 블럭이어야 함, 아니면 null) */
function parentBlock(el){
  if(!el)return null;
  let p=el.parentElement;
  while(p){
    if(p.classList&&p.classList.contains('slide'))return null;
    if(isBlock(p))return p;
    p=p.parentElement;
  }
  return null;
}

/* 블럭 el의 "드릴다운" 타깃 — 클릭 지점(x,y)을 포함하는 자식 블럭 */
function drillDownBlock(el,x,y){
  if(!el)return null;
  const kids=[...el.children];
  for(const k of kids){
    if(!isBlock(k))continue;
    if(k.matches(BLOCK.ARTIFACT_SEL))continue;
    const r=k.getBoundingClientRect();
    if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom){
      return k;
    }
  }
  /* 직계 자식 블럭 없으면 재귀적으로 non-block 래퍼를 건너뛰고 찾음 */
  for(const k of kids){
    if(k.matches&&k.matches(BLOCK.ARTIFACT_SEL))continue;
    const inner=drillDownBlock(k,x,y);
    if(inner)return inner;
  }
  return null;
}

/* 블럭 el이 "리프"인지 — 자식에 블럭이 더 이상 없음 */
function isLeafBlock(el){
  if(!el)return true;
  const q=el.querySelectorAll('*');
  for(const d of q){
    if(d.matches(BLOCK.ARTIFACT_SEL))continue;
    if(isBlock(d))return false;
  }
  return true;
}

/* 모든 블럭 선택/편집 흔적 전면 청소 — 피그마 규칙 "한 번에 하나만" 강제
   재발 방지: 이 함수 하나로 모든 selection 잔재를 제거한다 */
function _clearBlockClasses(except){
  /* except: 유지할 요소 (선택적) — 이 요소만 제외하고 전부 청소 */
  document.querySelectorAll('.'+BLOCK.SEL_CLASS).forEach(e=>{
    if(e!==except)e.classList.remove(BLOCK.SEL_CLASS);
  });
  document.querySelectorAll('.'+BLOCK.EDIT_CLASS).forEach(e=>{
    if(e!==except)e.classList.remove(BLOCK.EDIT_CLASS);
  });
  /* 구 시스템 .ed-selected 잔재도 제거 (media wrap 제외) */
  document.querySelectorAll('.ed-selected').forEach(e=>{
    if(e!==except&&!e.classList.contains('ed-media-wrap'))e.classList.remove('ed-selected');
  });
  /* contenteditable 속성도 except 아니면 모두 제거 */
  document.querySelectorAll('[contenteditable="true"]').forEach(e=>{
    if(e!==except){e.removeAttribute('contenteditable');e.blur&&e.blur();}
  });
}

/* 블럭 상태 설정 — 핵심 API.
   피그마 규칙: 한 번에 한 블럭만 selected/editing 상태. 호출 즉시 전면 청소. */
function setBlockState(el,mode){
  /* mode: 'select' | 'edit' | 'idle' */
  if(mode==='idle'||!el){
    _clearBlockClasses(null); /* 전면 청소, 유지 대상 없음 */
    selBlock=null;editingBlock=null;selBlocks=[];
    if(typeof _setSel==='function')_setSel(null);
    if(typeof stopOverlayLoop==='function')stopOverlayLoop();
    return;
  }
  if(mode==='select'){
    _clearBlockClasses(null); /* 전면 청소 후 이 요소만 선택 표시 */
    el.classList.add(BLOCK.SEL_CLASS);
    el.removeAttribute('contenteditable');
    selBlock=el;editingBlock=null;selBlocks=[el];
    if(typeof _setSel==='function')_setSel(el);
    if(typeof startOverlayLoop==='function')startOverlayLoop();
    return;
  }
  if(mode==='edit'){
    _clearBlockClasses(null); /* 전면 청소 후 이 요소만 편집 표시 */
    el.classList.add(BLOCK.EDIT_CLASS);
    el.contentEditable='true';
    el.focus();
    selBlock=null;editingBlock=el;selBlocks=[];
    if(!el._edFocus){
      el._edFocus=true;
      el.addEventListener('focus',()=>push());
    }
    if(typeof _setSel==='function')_setSel(el);
    if(typeof startOverlayLoop==='function')startOverlayLoop();
    return;
  }
}

/* 한 겹 파고들기 — 핵심 UX 로직 (D안 + Figma 방식) */
function clickBlockAt(e){
  const x=e.clientX,y=e.clientY;
  const target=document.elementFromPoint(x,y);
  if(!target)return;
  /* 슬라이드 밖 클릭 → IDLE */
  const slide=curSlide();
  if(!slide||!slide.contains(target)){
    setBlockState(null,'idle');
    hideBar&&hideBar();
    return;
  }
  /* 레이아웃 래퍼(.principle-grid2 등) 또는 슬라이드 직접 클릭 → IDLE
     클릭 지점이 어떤 블럭 위도 아니면 = 빈 공간 = 선택 해제 (피그마 규칙) */
  const hitBlock = findBlock(target);
  if(!hitBlock){
    setBlockState(null,'idle');
    hideBar&&hideBar();
    lastClickedBlock=null;
    return;
  }
  /* 현재 더블클릭인지 체크 (350ms 이내) */
  const now=Date.now();
  const isDouble=(now-lastClickTime)<350 && lastClickedBlock && lastClickedBlock.contains(target);
  lastClickTime=now;

  /* 이미 EDITING 중이고 같은 블럭 내부 클릭 → 편집 유지 */
  if(editingBlock&&editingBlock.contains(target)){
    return;
  }

  /* [우선] 더블클릭 — 리프까지 즉시 파고들어 편집 진입 (컨테이너든 뭐든) */
  if(isDouble){
    let leaf=findBlock(target);
    while(leaf&&!isLeafBlock(leaf)){
      const child=drillDownBlock(leaf,x,y);
      if(!child)break;
      leaf=child;
    }
    if(leaf){
      setBlockState(leaf,'edit');
      showBar&&showBar(leaf);
      lastClickedBlock=leaf;
      return;
    }
  }

  /* 1) 현재 선택된 블럭이 있고, 그 블럭 내부를 다시 클릭 → 한 겹 파고들기 */
  if(selBlock&&selBlock.contains(target)&&target!==selBlock){
    const child=drillDownBlock(selBlock,x,y);
    if(child&&child!==selBlock){
      setBlockState(child,'select');
      showBar&&showBar(child);
      lastClickedBlock=child;
      return;
    }
    /* 파고들 자식이 없으면 리프 도달 → 편집 */
    if(isLeafBlock(selBlock)){
      setBlockState(selBlock,'edit');
      showBar&&showBar(selBlock);
      return;
    }
  }

  /* 2) 같은 리프를 또 클릭 (더블클릭은 아니지만 selBlock===리프) → 편집 */
  if(selBlock&&selBlock===findBlock(target)&&isLeafBlock(selBlock)){
    setBlockState(selBlock,'edit');
    showBar&&showBar(selBlock);
    return;
  }

  /* 3) 기본 — 슬라이드의 직계 자식 블럭부터 선택 */
  const topBlock=_findTopLevelBlock(target,slide);
  if(topBlock){
    setBlockState(topBlock,'select');
    showBar&&showBar(topBlock);
    lastClickedBlock=topBlock;
    return;
  }
  /* 아무 블럭도 못 찾음 → idle */
  setBlockState(null,'idle');
  hideBar&&hideBar();
}

/* target을 포함하는, slide의 "최상위" 블럭 (슬라이드 직계 자식 레벨) */
function _findTopLevelBlock(target,slide){
  let el=target;
  let lastBlock=null;
  while(el&&el!==slide){
    if(isBlock(el))lastBlock=el;
    el=el.parentElement;
  }
  return lastBlock;
}

/* 블럭 삭제 — 찌꺼기 없이 */
function deleteBlockClean(el){
  if(!el)return;
  push();
  /* 블럭 내부의 UI artifact 제거 */
  el.querySelectorAll(BLOCK.ARTIFACT_SEL).forEach(a=>a.remove());
  /* 블럭의 형제인 핸들들도 정리 (간혹 외부에 붙는 경우) */
  const parent=el.parentElement;
  el.remove();
  /* 선택 상태 초기화 */
  selBlock=null;editingBlock=null;selBlocks=[];
  if(typeof _setSel==='function')_setSel(null);
  /* 핸들 재동기화 */
  if(typeof attachHandles==='function')attachHandles();
  hideBar&&hideBar();
  _setDirty&&_setDirty(true);
  msg('블럭 삭제');
}

/* 블럭 감싸기 (Ctrl+G) */
function groupBlocksWrap(els){
  if(!els||!els.length)return;
  push();
  const wrap=document.createElement('div');
  wrap.className='card ed-group';
  wrap.setAttribute('data-step',(els[0].getAttribute('data-step')||'1'));
  const first=els[0];
  first.parentElement.insertBefore(wrap,first);
  els.forEach(e=>wrap.appendChild(e));
  attachHandles&&attachHandles();
  on&&on();
  setBlockState(wrap,'select');
  showBar&&showBar(wrap);
  msg('블럭 감싸기');
  _setDirty&&_setDirty(true);
}

/* 블럭 풀기 (Ctrl+Shift+G) */
function ungroupBlockUnwrap(el){
  if(!el)return;
  if(isLeafBlock(el)){msg('풀 내용이 없음');return;}
  push();
  const parent=el.parentElement;
  const kids=[...el.children].filter(c=>!c.matches(BLOCK.ARTIFACT_SEL));
  kids.forEach(k=>parent.insertBefore(k,el));
  el.remove();
  attachHandles&&attachHandles();
  on&&on();
  setBlockState(null,'idle');
  msg('블럭 풀기');
  _setDirty&&_setDirty(true);
}

/* 블럭 추가 */
function insertBlockAfter(type,after){
  push();
  const slide=curSlide();if(!slide)return;
  let el;
  if(type==='text'){el=document.createElement('p');el.textContent='새 텍스트';el.setAttribute('data-step','1');}
  else if(type==='heading'){el=document.createElement('h2');el.textContent='새 제목';el.setAttribute('data-step','1');}
  else if(type==='card'){
    el=document.createElement('div');el.className='card';el.setAttribute('data-step','1');
    const p=document.createElement('p');p.textContent='카드 내용';el.appendChild(p);
  }else{return;}
  if(after&&after.parentElement){
    after.parentElement.insertBefore(el,after.nextSibling);
  }else{
    slide.appendChild(el);
  }
  attachHandles&&attachHandles();
  on&&on();
  setBlockState(el,'select');
  showBar&&showBar(el);
  msg('블럭 추가: '+type);
  _setDirty&&_setDirty(true);
}

/* Shift+클릭 다중 선택 토글 (Phase 3) */
function toggleBlockSelection(el){
  if(!el)return;
  const idx=selBlocks.indexOf(el);
  if(idx>=0){
    selBlocks.splice(idx,1);
    el.classList.remove(BLOCK.SEL_CLASS);
    if(selBlock===el)selBlock=selBlocks[0]||null;
  }else{
    selBlocks.push(el);
    el.classList.add(BLOCK.SEL_CLASS);
    selBlock=el;
  }
  editingBlock=null;
  if(typeof _setSel==='function')_setSel(selBlock);
}

/* 블럭 시스템에서 "현재 활성 블럭" 반환 — 외부에서 sel 대신 씀 */
function currentBlock(){return editingBlock||selBlock;}

/* ────────────────────────────────
   블럭 이동 (A3 방식: Space/Alt + 드래그)
   ──────────────────────────────── */

/* 선택된 블럭(들)을 dx, dy 만큼 이동. 다중 선택 시 함께 이동 (C1) */
function nudgeBlocks(dx,dy){
  const blocks = selBlocks.length ? selBlocks : (selBlock?[selBlock]:[]);
  if(!blocks.length)return;
  push();
  blocks.forEach(b=>{
    if(!b.classList.contains('ed-media-wrap')){
      b.style.position='relative';
    }
    const oL=parseFloat(b.style.left)||0, oT=parseFloat(b.style.top)||0;
    b.style.left=(oL+dx)+'px';
    b.style.top=(oT+dy)+'px';
  });
  _setDirty&&_setDirty(true);
  if(typeof syncSelectionOverlay==='function')syncSelectionOverlay();
}

/* 블럭 하나의 위치 스타일 리셋 (B2: 원 위치 복귀) */
function resetBlockPosition(el){
  if(!el)return;
  push();
  el.style.left='';
  el.style.top='';
  el.style.position='';
  el.style.transform='';
  _setDirty&&_setDirty(true);
  msg('원 위치 복귀');
  if(typeof syncSelectionOverlay==='function')syncSelectionOverlay();
}

/* Space/Alt + 드래그로 블럭 이동 시작 */
function startMoveDrag(anchorBlock, e){
  if(!anchorBlock)return;
  moveInProgress=true;
  push();
  /* 이동 대상 목록: 다중 선택이면 전부, 아니면 anchorBlock 하나 */
  const targets = selBlocks.length>1 ? [...selBlocks] : [anchorBlock];
  const sc = pAPI.deckScale;
  const sX = e.clientX, sY = e.clientY;
  /* 각 블럭의 초기 상태 저장
     · media-wrap 이 최초 이동일 때 transform 중앙 정렬을 px 좌표로 변환해야
       oL/oT 가 올바르게 잡혀서 점핑이 사라진다. */
  const initial = targets.map(b=>{
    if(!b.classList.contains('ed-media-wrap')){
      b.style.position='relative';
    } else if(!b.style.left || b.style.transform==='translate(-50%, -50%)'){
      const r=b.getBoundingClientRect(), pr=b.parentElement.getBoundingClientRect();
      b.style.transform='none';
      b.style.left=Math.round((r.left-pr.left)/sc)+'px';
      b.style.top =Math.round((r.top -pr.top )/sc)+'px';
    }
    return {
      el:b,
      oL:parseFloat(b.style.left)||0,
      oT:parseFloat(b.style.top)||0
    };
  });
  targets.forEach(b=>b.classList.add('ed-dragging'));

  const mv = ev=>{
    const dx=(ev.clientX-sX)/sc, dy=(ev.clientY-sY)/sc;
    initial.forEach(({el,oL,oT})=>{
      el.style.left=(oL+dx)+'px';
      el.style.top=(oT+dy)+'px';
    });
  };
  const up = ()=>{
    targets.forEach(b=>b.classList.remove('ed-dragging'));
    document.removeEventListener('mousemove',mv);
    document.removeEventListener('mouseup',up);
    setTimeout(()=>{moveInProgress=false;suppressNextSelect=false;},10);
    _setDirty&&_setDirty(true);
  };
  document.addEventListener('mousemove',mv);
  document.addEventListener('mouseup',up);
  suppressNextSelect=true;
  e.preventDefault();
}

let _saveHandle=null; /* cached FileSystemFileHandle — reused on every Ctrl+S to skip dialog */

/* ── Dirty 상태 추적 — 변경 있으면 Save 버튼 활성화 ── */
let _dirty=false;
function _setDirty(v){
  _dirty=v;
  const btn=document.querySelector('.fb-save');
  if(!btn)return;
  btn.disabled=!v;
  btn.style.opacity=v?'1':'0.35';
  btn.style.cursor=v?'pointer':'default';
  btn.title=v?'Ctrl+S':'변경사항 없음';
}
/* <<< end 41-494 <<< */
/* >>> editor.js original lines 1216-1262 >>> */
/* ============================================================
   AUTO STEP — Y좌표 기준 data-step 재배정
   ============================================================
   대상: 현재 슬라이드의 모든 블록([data-step] 또는 .ed-media-wrap).
   각 요소의 슬라이드 내 상대 Y 좌표(top)를 구한 뒤 오름차순 정렬.
   같은 Y 영역(±40px)은 같은 step으로 묶음 (동시 등장 가능).
   ============================================================ */
function autoStepBySlide(slide){
  const s=slide||curSlide(); if(!s)return;
  push();
  /* 대상 수집 — 슬라이드의 최상위 레벨 블록만 (중첩 [data-step] 자식은 제외) */
  const all=Array.from(s.querySelectorAll('[data-step], .ed-media-wrap'));
  const items=all.filter(el=>{
    /* 최상위 블록만: 부모가 slide거나 slide의 최상위 wrapper */
    let p=el.parentElement;
    while(p && p!==s){
      if(p.hasAttribute&&p.hasAttribute('data-step'))return false;
      if(p.classList&&p.classList.contains('ed-media-wrap'))return false;
      p=p.parentElement;
    }
    return true;
  });
  if(items.length===0){msg('재배정할 블록 없음');return}
  const srect=s.getBoundingClientRect();
  const withY=items.map(el=>{
    const r=el.getBoundingClientRect();
    const y=r.top-srect.top;
    return {el,y};
  });
  /* Y 오름차순 정렬 */
  withY.sort((a,b)=>a.y-b.y);
  /* 그룹핑: 연속된 요소의 Y 차이가 40px 미만이면 같은 step */
  const GROUP_TOL=40;
  let step=1, prevY=-9999;
  for(const it of withY){
    if(it.y-prevY>=GROUP_TOL && prevY!==-9999)step++;
    if(prevY===-9999)step=1;
    it.el.setAttribute('data-step',String(step));
    prevY=it.y;
  }
  /* pAPI 재초기화로 reveal 반영 */
  if(window.pAPI&&pAPI.reinit){pAPI.reinit();}
  msg('✔ data-step 재배정 완료 (총 '+step+'단계)');
}
function mkImg(src){const i=document.createElement('img');i.src=src;i.style.cssText='width:'+CFG.IMG_DEFAULT_W+';height:auto;border-radius:'+CFG.MEDIA_RADIUS;i.draggable=false;return i}
function mkVid(src){const v=document.createElement('video');v.src=src;v.controls=true;v.muted=true;v.setAttribute('muted','');/* autoplay 기본 OFF — step 시스템이 제어. 필요시 에디터에서 수동 ON */v.style.cssText='width:'+CFG.VID_DEFAULT_W+';border-radius:'+CFG.MEDIA_RADIUS;return v}

/* <<< end 1216-1262 <<< */
/* >>> editor.js original lines 2647-2745 >>> */
/* ============================================================
   ANIMATION PRESETS
   ============================================================ */
/* Wrap each character in a text node with <span class="ed-anim-char">.
   Existing .ed-anim-char wrappers are unwrapped first to avoid double-wrap.
   Spaces become <span class="char-space"> for layout preservation. */
function _wrapChars(el){
  /* Unwrap any existing char spans first */
  el.querySelectorAll('.ed-anim-char,.char-space').forEach(sp=>{
    sp.replaceWith(document.createTextNode(sp.textContent));
  });
  el.normalize();
  /* Recursively wrap text nodes (skip nested elements that are not plain text) */
  let ci=0;
  function walk(node){
    if(node.nodeType===Node.TEXT_NODE){
      const text=node.textContent;if(!text)return;
      const frag=document.createDocumentFragment();
      for(const ch of text){
        const sp=document.createElement('span');
        if(ch===' '||ch==='\u00a0'){sp.className='char-space';sp.textContent='\u00a0';}
        else{sp.className='ed-anim-char';sp.textContent=ch;sp.style.setProperty('--ci',ci);ci++;}
        frag.appendChild(sp);
      }
      node.parentNode.replaceChild(frag,node);
    } else if(node.nodeType===Node.ELEMENT_NODE&&!node.classList.contains('ed-anim-char')&&!node.classList.contains('char-space')){
      Array.from(node.childNodes).forEach(walk);
    }
  }
  walk(el);
}

/* Unwrap char spans in a LIVE element (used by removeAnim) */
function _unwrapChars(el){
  el.querySelectorAll('.ed-anim-char,.char-space').forEach(sp=>{
    sp.replaceWith(document.createTextNode(sp.textContent));
  });
  el.normalize();
}

function applyAnim(mode){
  const preset=$('edAnimPreset').value;
  if(!preset)return msg('프리셋을 선택하세요');

  if(mode==='sel'){
    /* Selected text only — wrap the selection range */
    const s=window.getSelection();
    if(!s||s.rangeCount===0||s.isCollapsed)return msg('텍스트를 선택하세요');
    push();
    const rng=s.getRangeAt(0);
    /* Extract selected content into a wrapper span that carries data-anim */
    const wrapper=document.createElement('span');
    wrapper.dataset.anim=preset;
    wrapper.appendChild(rng.extractContents());
    /* Wrap chars inside the wrapper */
    _wrapChars(wrapper);
    rng.insertNode(wrapper);
    s.removeAllRanges();
    msg('애니메이션 적용 (선택)');
    return;
  }

  /* Block mode — apply to the selected element */
  if(!sel)return msg('요소를 클릭해서 선택하세요');
  push();
  /* Remove existing char spans before re-wrapping */
  _unwrapChars(sel);
  sel.dataset.anim=preset;
  _wrapChars(sel);
  msg('애니메이션 적용 (블럭)');
}

function removeAnim(){
  /* Remove from selection wrapper first */
  const s=window.getSelection();
  if(s&&s.rangeCount>0&&!s.isCollapsed){
    const node=s.getRangeAt(0).commonAncestorContainer;
    const wrapper=node.nodeType===Node.ELEMENT_NODE
      ?node.closest('[data-anim]')
      :(node.parentElement&&node.parentElement.closest('[data-anim]'));
    if(wrapper){push();_unwrapChars(wrapper);delete wrapper.dataset.anim;msg('애니메이션 제거');return;}
  }
  if(!sel)return msg('요소를 선택하세요');
  push();
  _unwrapChars(sel);
  delete sel.dataset.anim;
  /* Also remove from any [data-anim] children */
  sel.querySelectorAll('[data-anim]').forEach(el=>{_unwrapChars(el);delete el.dataset.anim;});
  msg('애니메이션 제거');
}

/* Re-apply char wrapping after undo/restore so live animations continue */
function _reapplyAnimChars(root){
  (root||document).querySelectorAll('[data-anim]').forEach(el=>{
    /* Only wrap if not already wrapped (check for existing .ed-anim-char) */
    if(!el.querySelector('.ed-anim-char'))_wrapChars(el);
  });
}

/* <<< end 2647-2745 <<< */
