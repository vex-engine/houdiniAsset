(()=>{
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
  ARTIFACT_SEL: '.ed-drag-handle, .ed-block-resize, .ed-block-resize-w, .ed-block-resize-e, .ed-resize-handle, .ed-media-del, .ed-crop-handle, .ed-toolbar, .ed-panel, .ed-nav, .ed-confirm',
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

/* 블럭 삭제 — 찌꺼기 없이.
   v2.1: Component 마스터 삭제 시 인스턴스 함께 삭제 가드 (async). */
async function deleteBlockClean(el){
  if(!el)return;
  /* Component 가드 — 마스터면 인스턴스 동반 삭제 확인 */
  if(el.classList&&el.classList.contains('ed-component')){
    const id=el.getAttribute('data-component-id');
    if(id){
      const instances=deck.querySelectorAll('.ed-instance[data-instance-of="'+CSS.escape(id)+'"]');
      if(instances.length>0){
        const ok=await confirmDlg('이 컴포넌트의 인스턴스 '+instances.length+'개도 함께 삭제됩니다.\n계속할까요?');
        if(!ok)return;
        instances.forEach(inst=>{
          inst.querySelectorAll(BLOCK.ARTIFACT_SEL).forEach(a=>a.remove());
          inst.remove();
        });
      }
    }
  }
  push();
  /* 블럭 내부의 UI artifact 제거 */
  el.querySelectorAll(BLOCK.ARTIFACT_SEL).forEach(a=>a.remove());
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

/* ============================================================
   BLOCK SYSTEM v2.1 — Group / Auto-Layout / Component / Constraints
   설계 문서: engine/BLOCK_SYSTEM_v2.1_GROUP_LAYOUT.md
   상태는 모두 DOM data-attribute에 저장. JS 전역 미러 없음 (undo가 deck 스냅샷이라 자동).
   하드코딩 회피: BLOCK.* selector + setProperty(CSS variable) 패턴.
   ============================================================ */

/* DOM 순서로 정렬 — 멀티셀렉트는 클릭 순서일 수 있어 wrap 전에 정렬 필요 */
function _sortByDomOrder(els){
  return [...els].sort((a,b)=>{
    if(a===b)return 0;
    const pos=a.compareDocumentPosition(b);
    if(pos&Node.DOCUMENT_POSITION_FOLLOWING)return -1;
    if(pos&Node.DOCUMENT_POSITION_PRECEDING)return 1;
    return 0;
  });
}

/* 자식의 절대좌표 inline style 정리 — Auto Layout 켤 때 호출 */
function _stripAbsoluteCoords(el){
  if(!el||!el.style)return;
  el.style.left='';el.style.top='';el.style.position='';el.style.transform='';
}

/* 새 부모 element 생성 — mode/layout 옵션에 따라 클래스 / data-* 부여
   하드코딩 회피: 클래스 조합을 한 곳에서만 결정 */
function _makeGroupElement(opts){
  const wrap=document.createElement('div');
  if(opts.mode==='frame'){
    wrap.className='ed-group ed-group-frame';
  }else{
    wrap.className='card ed-group';
  }
  wrap.setAttribute('data-group-mode',opts.mode||'card');
  return wrap;
}

/* 자식들의 data-step 중 최댓값 (없으면 0) */
function _maxChildStep(els){
  let m=0;
  els.forEach(e=>{
    const v=parseInt(e.getAttribute('data-step')||'0',10);
    if(!isNaN(v)&&v>m)m=v;
  });
  return m;
}

/* 멀티셀렉트 wrap — Card / Frame, Auto-Layout, autoSeq 옵션 통합
   기존 groupBlocksWrap의 강화판. 외부에선 호환 래퍼를 통해 호출. */
function wrapBlocks(els,opts){
  if(!els||!els.length)return null;
  opts=Object.assign({mode:'card',layout:null,autoSeq:true,padding:16,gap:12,align:null},opts||{});
  push();
  /* 1) DOM 순서 정렬 */
  els=_sortByDomOrder(els);
  const first=els[0];
  if(!first||!first.parentElement)return null;
  /* 2) 새 부모 생성 */
  const wrap=_makeGroupElement(opts);
  /* 3) data-step 결정 — autoSeq면 부모가 먼저 등장(첫 자식 step과 같이),
        아니면 자식들 다 보인 다음 부모 등장 (최댓값+1) */
  const childMaxStep=_maxChildStep(els);
  if(opts.autoSeq){
    /* 자식 step의 최솟값(있으면)을 부모에 부여, 없으면 첫 자식꺼 또는 1 */
    let minStep=Infinity;
    els.forEach(e=>{const v=parseInt(e.getAttribute('data-step')||'0',10);if(!isNaN(v)&&v>0&&v<minStep)minStep=v;});
    if(minStep===Infinity)minStep=parseInt(first.getAttribute('data-step')||'1',10);
    wrap.setAttribute('data-step',String(minStep));
  }else{
    wrap.setAttribute('data-step',String(childMaxStep+1||1));
  }
  /* 4) Auto-sequence 켜기 — 자식이 2+개일 때만 의미 있음 */
  if(opts.autoSeq&&els.length>=2){
    wrap.setAttribute('data-anim-children','seq');
  }
  /* 5) Layout 옵션 (없으면 free-form) */
  if(opts.layout==='v'||opts.layout==='h'){
    wrap.setAttribute('data-layout',opts.layout);
    if(opts.gap!=null){
      wrap.setAttribute('data-gap',String(opts.gap|0));
      wrap.style.setProperty('--ed-gap',(opts.gap|0)+'px');
    }
    if(opts.padding!=null){
      wrap.setAttribute('data-pad',String(opts.padding|0));
      wrap.style.setProperty('--ed-pad-t',(opts.padding|0)+'px');
      wrap.style.setProperty('--ed-pad-r',(opts.padding|0)+'px');
      wrap.style.setProperty('--ed-pad-b',(opts.padding|0)+'px');
      wrap.style.setProperty('--ed-pad-l',(opts.padding|0)+'px');
    }
    if(opts.align){wrap.setAttribute('data-align',opts.align);}
  }
  /* 6) 트리에 삽입 */
  first.parentElement.insertBefore(wrap,first);
  els.forEach(e=>{
    /* layout이 켜지면 자식 절대좌표 초기화 (flex가 위치 잡으므로) */
    if(opts.layout==='v'||opts.layout==='h')_stripAbsoluteCoords(e);
    wrap.appendChild(e);
  });
  /* 7) 후처리 */
  attachHandles&&attachHandles();
  on&&on();
  setBlockState(wrap,'select');
  showBar&&showBar(wrap);
  /* presentation.js의 stepAuto 시스템 재계산 — autoSeq 활성화 위해 */
  if(window.pAPI&&window.pAPI.reinit)window.pAPI.reinit();
  msg('Wrap: '+(opts.mode||'card')+(opts.layout?(' '+opts.layout):''));
  _setDirty&&_setDirty(true);
  return wrap;
}

/* 블럭 풀기 — data-step-auto 잔재 정리 포함 */
function unwrapBlock(el){
  if(!el)return;
  if(isLeafBlock(el)){msg('풀 내용이 없음');return;}
  push();
  const parent=el.parentElement;
  const kids=[...el.children].filter(c=>!c.matches(BLOCK.ARTIFACT_SEL));
  /* 자식들 정리 — 자동 step은 조부모 컨텍스트에서 무효화 */
  kids.forEach(k=>{
    if(k.getAttribute&&k.getAttribute('data-step-auto')==='1'){
      k.removeAttribute('data-step');
      k.removeAttribute('data-step-auto');
    }
    parent.insertBefore(k,el);
  });
  el.remove();
  attachHandles&&attachHandles();
  on&&on();
  setBlockState(null,'idle');
  if(window.pAPI&&window.pAPI.reinit)window.pAPI.reinit();
  msg('Unwrap');
  _setDirty&&_setDirty(true);
}

/* ── 백워드 호환 래퍼 (기존 호출자 보존) ── */
function groupBlocksWrap(els){return wrapBlocks(els,{mode:'card',layout:null,autoSeq:true});}
function ungroupBlockUnwrap(el){return unwrapBlock(el);}

/* ── Auto-Layout 속성 setters — 모두 push() 후 attribute + CSS variable 갱신 ── */
function setLayoutDirection(el,dir){
  if(!el)return;
  push();
  if(dir==='v'||dir==='h')el.setAttribute('data-layout',dir);
  else el.removeAttribute('data-layout');
  _setDirty&&_setDirty(true);
}
function setLayoutGap(el,px){
  if(!el)return;
  push();
  const v=parseInt(px,10);
  if(isNaN(v)||px===''||px==null){
    el.removeAttribute('data-gap');
    el.style.removeProperty('--ed-gap');
  }else{
    el.setAttribute('data-gap',String(v));
    el.style.setProperty('--ed-gap',v+'px');
  }
  _setDirty&&_setDirty(true);
}
function setLayoutPadding(el,t,r,b,l){
  if(!el)return;
  push();
  const T=t==null||t===''?null:parseInt(t,10)|0;
  const R=r==null||r===''?null:parseInt(r,10)|0;
  const B=b==null||b===''?null:parseInt(b,10)|0;
  const L=l==null||l===''?null:parseInt(l,10)|0;
  if(T!=null&&T===R&&R===B&&B===L){
    el.setAttribute('data-pad',String(T));
    ['t','r','b','l'].forEach(k=>el.removeAttribute('data-pad-'+k));
  }else{
    el.removeAttribute('data-pad');
    [['t',T],['r',R],['b',B],['l',L]].forEach(([k,v])=>{
      if(v==null)el.removeAttribute('data-pad-'+k);
      else el.setAttribute('data-pad-'+k,String(v));
    });
  }
  el.style.setProperty('--ed-pad-t',(T??0)+'px');
  el.style.setProperty('--ed-pad-r',(R??0)+'px');
  el.style.setProperty('--ed-pad-b',(B??0)+'px');
  el.style.setProperty('--ed-pad-l',(L??0)+'px');
  _setDirty&&_setDirty(true);
}
function setLayoutAlign(el,align){
  if(!el)return;
  push();
  if(align)el.setAttribute('data-align',align);
  else el.removeAttribute('data-align');
  _setDirty&&_setDirty(true);
}

/* ── Component / Instance ── */
function makeComponent(el){
  if(!el)return null;
  push();
  const id='cmp-'+Math.random().toString(36).slice(2,8);
  el.classList.add('ed-component');
  el.setAttribute('data-component-id',id);
  msg('Component: '+id);
  _setDirty&&_setDirty(true);
  return id;
}
function detachInstance(el){
  if(!el)return;
  if(!el.classList||!el.classList.contains('ed-instance')){msg('인스턴스가 아님');return;}
  push();
  el.classList.remove('ed-instance');
  el.removeAttribute('data-instance-of');
  msg('Instance detached');
  _setDirty&&_setDirty(true);
}
function syncInstancesOf(id){
  if(!id||!deck)return;
  const master=deck.querySelector('.ed-component[data-component-id="'+CSS.escape(id)+'"]');
  if(!master)return;
  const instances=deck.querySelectorAll('.ed-instance[data-instance-of="'+CSS.escape(id)+'"]');
  instances.forEach(inst=>{
    /* 인스턴스 위치/크기 보존, 내용물만 교체 */
    const savedPos={left:inst.style.left,top:inst.style.top,width:inst.style.width,height:inst.style.height};
    const savedClasses=inst.className;
    const savedInstanceOf=inst.getAttribute('data-instance-of');
    inst.innerHTML=master.innerHTML;
    Object.assign(inst.style,savedPos);
    inst.className=savedClasses;
    if(savedInstanceOf)inst.setAttribute('data-instance-of',savedInstanceOf);
  });
}
/* 마스터 변경 감지 → 디바운스 후 인스턴스 동기화 */
let _cmpSyncTimer=null;
const _cmpDirtyIds=new Set();
function _scheduleComponentSync(){
  if(_cmpSyncTimer)clearTimeout(_cmpSyncTimer);
  _cmpSyncTimer=setTimeout(()=>{
    const ids=[..._cmpDirtyIds];_cmpDirtyIds.clear();
    ids.forEach(syncInstancesOf);
  },300);
}
function _initComponentObserver(){
  if(!deck||window._cmpObserver)return;
  window._cmpObserver=new MutationObserver(muts=>{
    muts.forEach(m=>{
      let n=m.target;
      while(n&&n!==deck){
        if(n.classList&&n.classList.contains('ed-component')){
          const id=n.getAttribute('data-component-id');
          if(id)_cmpDirtyIds.add(id);
          break;
        }
        n=n.parentElement;
      }
    });
    if(_cmpDirtyIds.size)_scheduleComponentSync();
  });
  window._cmpObserver.observe(deck,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style','class','data-step']});
}

/* ── Constraints (P2 — attribute만 박음, 실제 ResizeObserver 적용은 후속) ── */
function setConstraint(el,axis,value){
  if(!el||(axis!=='h'&&axis!=='v'))return;
  push();
  el.setAttribute('data-constrain-'+axis,value);
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

/* ============================================================
   DRAG HANDLES — unified for text blocks + media wraps
   ============================================================ */
/* Shared drag logic — positions in px within fixed canvas, mouse deltas ÷ deckScale */
function startDrag(el,e){
  push();el.classList.add('ed-dragging');
  /* 블럭 시스템 v2 — 드래그 중인 블럭을 SELECTED로 유지 */
  if(typeof setBlockState==='function'&&isBlock(el)){
    setBlockState(el,'select');
  }
  suppressNextSelect=true; /* 드래그 중/직후 clickBlockAt이 재선택 못 하게 */
  if(!el.classList.contains('ed-media-wrap'))el.style.position='relative';
  /* For absolute media wraps: convert centering transform to px on first drag */
  if(el.classList.contains('ed-media-wrap')&&(!el.style.left||el.style.transform==='translate(-50%, -50%)')){
    const sc=pAPI.deckScale;
    const r=el.getBoundingClientRect(),pr=el.parentElement.getBoundingClientRect();
    el.style.transform='none';el.style.left=Math.round((r.left-pr.left)/sc)+'px';el.style.top=Math.round((r.top-pr.top)/sc)+'px';
  }
  const sc=pAPI.deckScale;
  const oL=parseFloat(el.style.left)||0,oT=parseFloat(el.style.top)||0;
  const sX=e.clientX,sY=e.clientY;
  /* Snap center: element's center in canvas coords */
  const rect0=el.getBoundingClientRect(),deckRect=deck.getBoundingClientRect();
  const cx0=(rect0.left-deckRect.left)/sc+rect0.width/sc/2;
  const cy0=(rect0.top-deckRect.top)/sc+rect0.height/sc/2;
  const mv=ev=>{
    const dx=(ev.clientX-sX)/sc,dy=(ev.clientY-sY)/sc;
    let nx=oL+dx,ny=oT+dy;
    const gr=guide._r;
    if(gr){
      const cx=cx0+(nx-oL),cy=cy0+(ny-oT);
      const gcx=gr.x+gr.w/2,gcy=gr.y+gr.h/2;
      if(Math.abs(cx-gcx)<CFG.SNAP_PX){snapV.style.left=Math.round(gcx)+'px';snapV.style.display='block';nx+=gcx-cx}else snapV.style.display='none';
      if(Math.abs(cy-gcy)<CFG.SNAP_PX){snapH.style.top=Math.round(gcy)+'px';snapH.style.display='block';ny+=gcy-cy}else snapH.style.display='none';
    }
    el.style.left=nx+'px';el.style.top=ny+'px';
    /* Sync resize handles position after move */
    const s2=curSlide();if(s2){
      s2.querySelectorAll('.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e').forEach(rh=>{
        if(rh._targetEl===el&&rh._posRH)rh._posRH();
      });
    }
  };
  const up=()=>{
    el.classList.remove('ed-dragging');snapH.style.display='none';snapV.style.display='none';
    document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
    /* 드래그 끝난 후 다음 tick에 suppress 해제 (mousedown→mouseup→click 순으로 이벤트가 옴) */
    setTimeout(()=>{suppressNextSelect=false;},10);
  };
  document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
}

function attachHandles(){
  document.querySelectorAll('.ed-drag-handle,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e').forEach(h=>h.remove());
  const s=curSlide();if(!s)return;
  /* 레이아웃 래퍼(.principle-grid2, .joka-grid, .num-grid, .flow)는 제외 — 블럭 아님 */
  const targets=s.querySelectorAll('[data-step], .two-col, .code-block, .card, .principle-card, .joka-cell, .num-item, .flow-step, table, .ed-media-wrap');
  targets.forEach(el=>{
    if(el.closest('.speaker-notes'))return;
    if(getComputedStyle(el).position==='static')el.style.position='relative';
    /* Drag handle */
    const h=document.createElement('div');h.className='ed-drag-handle';h.textContent='⠿';
    el.appendChild(h);
    h.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();startDrag(el,e)});
    /* Media-wrap: ensure resize handle exists (may be missing if loaded from saved HTML) */
    if(el.classList.contains('ed-media-wrap')&&!el.querySelector('.ed-resize-handle')){
      const rh=document.createElement('div');rh.className='ed-resize-handle';
      rh.addEventListener('mousedown',e=>{
        e.preventDefault();e.stopPropagation();push();
        const media=el.querySelector('img,video,iframe');if(!media)return;
        const sc=pAPI.deckScale;
        const sx=e.clientX,sw=media.offsetWidth;
        document.body.classList.add('ed-media-scaling');
        const mv=ev=>{
          const nw=Math.max(CFG.MEDIA_MIN_W,sw+(ev.clientX-sx)/sc);
          media.style.width=nw+'px';
          media.style.height='auto';
        };
        const up=()=>{
          document.removeEventListener('mousemove',mv);
          document.removeEventListener('mouseup',up);
          document.body.classList.remove('ed-media-scaling');
        };
        document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
      });
      el.appendChild(rh);
    }
    /* Media-wrap: ensure delete button exists */
    if(el.classList.contains('ed-media-wrap')&&!el.querySelector('.ed-media-del')){
      const d=document.createElement('button');d.className='ed-media-del';d.textContent='✕';
      d.onclick=()=>{push();el.remove();attachHandles();msg('삭제')};
      el.insertBefore(d,el.firstChild);
    }
    /* Media-wrap: ensure 4-side crop handles exist (load from saved HTML 호환) */
    if(el.classList.contains('ed-media-wrap')){
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
      rhW._posRH=posRH;rhW._posRE=posRE;
      rhE._posRH=posRH;rhE._posRW=posRW;
    }
  });
  s.querySelectorAll('img').forEach(img=>{img.draggable=false;img.addEventListener('dragstart',e=>e.preventDefault())});
}

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
    document.body.classList.add('ed-media-scaling');
    const mv=ev=>{
      const nw=Math.max(CFG.MEDIA_MIN_W,sw+(ev.clientX-sx)/sc);
      media.style.width=nw+'px';
      media.style.height='auto';
    };
    const up=()=>{
      document.removeEventListener('mousemove',mv);
      document.removeEventListener('mouseup',up);
      document.body.classList.remove('ed-media-scaling');
    };
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
  w.appendChild(d);w.appendChild(el);w.appendChild(rh);
  /* ✂ 크롭 핸들 4개 부착 */
  _attachCropHandles(w);
  return w;
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

/* ============================================================
   SAVE / SAVE AS / RESET ALL
   ============================================================ */

/* Asset cache — pre-filled at load time so _inlineAssets works on file:// too.
   Key = absolute URL (resolved via new URL) so it matches regardless of how the
   link references the asset (../../engine/engine.css vs engine/engine.css). */
const _assetCache={};
function _absURL(ref){
  try{return new URL(ref,location.href).href}catch(e){return null}
}
(function _prefetchAssets(){
  /* CSS: extract from already-loaded stylesheets (synchronous, works on file://) */
  for(const sheet of document.styleSheets){
    try{
      if(!sheet.href)continue;
      /* Skip cross-origin (e.g. Google Fonts) — cssRules access throws anyway */
      if(sheet.href.startsWith('http')&&!sheet.href.startsWith(location.origin+'/'))continue;
      _assetCache[sheet.href]=Array.from(sheet.cssRules).map(r=>r.cssText).join('\n');
    }catch(e){}
  }
  /* JS: fetch asynchronously (works on http://, may fail on file:// — that's OK) */
  Array.from(document.querySelectorAll('script[src]')).forEach(async sc=>{
    const src=sc.getAttribute('src');
    if(!src)return;
    const abs=_absURL(src);
    if(!abs)return;
    /* Skip external CDN scripts */
    if(abs.startsWith('http')&&!abs.startsWith(location.origin+'/'))return;
    try{
      const res=await fetch(abs);
      if(res.ok)_assetCache[abs]=await res.text();
    }catch(e){}
  });
  /* Force-prefetch panel-context.js so saveAs can inject it into legacy files
     that don't yet have the <script src> tag. */
  (async ()=>{
    try{
      const tryUrls=['engine/panel-context.js','../engine/panel-context.js','../../engine/panel-context.js'];
      for(const u of tryUrls){
        const abs=_absURL(u);
        if(!abs)continue;
        if(_assetCache[abs])return;
        try{
          const r=await fetch(abs);
          if(r.ok){ _assetCache[abs]=await r.text(); return; }
        }catch(e){}
      }
    }catch(e){}
  })();
})();

/* Shared: bake media-wrap positions.
   NOTE: blob URL 처리는 여기서 하지 않음 — exportHTML이 _blobFileMap으로 직접 처리.
   (과거 여기서 blob→filename으로 갈아치우면서 원본 연결고리를 잃어버렸음) */
function _bakeMedia(cl){
  cl.querySelectorAll('.ed-media-wrap').forEach(w=>{
    w.style.position='absolute';w.style.display='block';
    w.querySelectorAll('img,video,iframe').forEach(m=>{
      m.style.pointerEvents='';m.style.display='block';
    });
  });
}

/* Shared: strip char-animation spans so saved HTML is clean */
function _cleanAnimChars(cl){_uncharClone(cl)}

/* Shared: restore absolute URLs back to relative paths in cloned DOM.
   cloneNode resolves href/src to absolute (e.g. http://localhost/engine.css),
   which breaks saved files opened from different locations. */
function _fixRelativePaths(cl){
  const base=location.href.substring(0,location.href.lastIndexOf('/')+1);
  /* Fix <link href>, <script src>, <img src>, <video src>, <iframe src> */
  cl.querySelectorAll('link[href],script[src],img[src],video[src],source[src]').forEach(el=>{
    const attr=el.hasAttribute('href')?'href':'src';
    const val=el.getAttribute(attr);
    if(val&&val.startsWith(base)){
      el.setAttribute(attr,val.substring(base.length));
    }
  });
}

/* Shared: inline external CSS & JS into the HTML clone so the file is fully
   self-contained and works when opened from any folder.
   Uses _assetCache first (populated at load time, works on file://) then fetch.
   Cache keys are absolute URLs — matches regardless of relative path form. */
async function _inlineAssets(cl){
  /* Inline CSS */
  for(const link of cl.querySelectorAll('link[rel="stylesheet"]')){
    const href=link.getAttribute('href');
    if(!href)continue;
    const abs=_absURL(href);
    /* Skip external CDN stylesheets (e.g. Google Fonts) — leave link as-is */
    if(!abs||(abs.startsWith('http')&&!abs.startsWith(location.origin+'/')))continue;
    let css=_assetCache[abs]; /* try cache (always available, even on file://) */
    if(!css){
      try{
        const res=await fetch(abs);
        if(res.ok)css=await res.text();
      }catch(e){}
    }
    if(!css){
      /* Can't inline (e.g. file:// fetch blocked and nothing cached) — make
         href absolute so the saved file can still load CSS from the original
         location. Otherwise the relative path breaks in the Save-As target. */
      link.setAttribute('href',abs);
      continue;
    }
    const styleEl=document.createElement('style');
    styleEl.textContent=css;
    link.replaceWith(styleEl);
  }
  /* Inline JS */
  for(const sc of cl.querySelectorAll('script[src]')){
    const src=sc.getAttribute('src');
    if(!src)continue;
    const abs=_absURL(src);
    if(!abs||(abs.startsWith('http')&&!abs.startsWith(location.origin+'/')))continue;
    let js=_assetCache[abs];
    if(!js){
      try{
        const res=await fetch(abs);
        if(res.ok)js=await res.text();
      }catch(e){}
    }
    if(!js){
      /* Can't inline (e.g. file:// fetch blocked) — make src absolute so the
         saved file can still load scripts from the original location */
      sc.setAttribute('src',abs);
      continue;
    }
    const inl=document.createElement('script');
    inl.textContent=js;
    sc.replaceWith(inl);
  }
  /* Ensure panel-context.js is present — inject if missing (legacy files).
     Cache was pre-filled at load time via _prefetchAssets so this works on file:// too. */
  try{
    const hasPC = Array.from(cl.querySelectorAll('script')).some(s=>{
      const src=s.getAttribute('src')||'';
      return src.indexOf('panel-context.js')>=0 || (s.textContent||'').indexOf('window.PanelCtx')>=0;
    });
    if(!hasPC){
      let pcJs=null;
      for(const k of Object.keys(_assetCache)){
        if(k.indexOf('panel-context.js')>=0){ pcJs=_assetCache[k]; break; }
      }
      if(!pcJs){
        try{ const r=await fetch('engine/panel-context.js'); if(r.ok) pcJs=await r.text(); }catch(e){}
      }
      if(pcJs){
        /* Insert BEFORE editor.js so refresh() is callable when editor.js runs */
        const edScript = Array.from(cl.querySelectorAll('script')).find(s=>{
          const src=s.getAttribute('src')||'';
          return src.indexOf('editor.js')>=0 || (s.textContent||'').indexOf('EA.toggle')>=0 || (s.textContent||'').indexOf('_buildSaveHTML')>=0;
        });
        const pcEl=document.createElement('script');
        pcEl.textContent=pcJs;
        if(edScript && edScript.parentNode){ edScript.parentNode.insertBefore(pcEl, edScript); }
        else { cl.querySelector('body').appendChild(pcEl); }
      }
    }
  }catch(e){ console.warn('[_inlineAssets] panel-context inject skipped:', e); }
}

/* Shared: write HTML to a FileSystemFileHandle via ArrayBuffer.
   Throws on any failure so callers can fall back to download. */
async function _writeToHandle(handle,html){
  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const buf=await blob.arrayBuffer();
  const w=await handle.createWritable();
  try{
    await w.write(buf);
    await w.close();
  }catch(e){
    try{await w.abort()}catch(_){}
    throw e;
  }
  return buf.byteLength;
}
/* Shared: Blob URL download fallback (always works) */
function _downloadFallback(html,fname){
  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* ── 공통: DOM 클론 + 런타임 아티팩트 제거 ── */
function _buildSaveHTML(){
  const cl=document.documentElement.cloneNode(true);
  cl.querySelectorAll('.slide').forEach(s=>{s.classList.remove('active','exit-left','exit-right');s.removeAttribute('aria-hidden')});
  cl.querySelectorAll('.visible').forEach(e=>e.classList.remove('visible'));
  cl.querySelectorAll('.ed-drag-handle,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e,.ed-media-del,.ed-resize-handle,.ed-crop-handle').forEach(e=>e.remove());
  cl.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));
  cl.querySelector('body').classList.remove('editor-mode','show-grid','show-notes');
  _cleanAnimChars(cl);
  /* resize 시 setProperty('...','important')로 설정된 값 → 일반 인라인으로 전환 */
  cl.querySelectorAll('[style]').forEach(el=>{
    const s=el.style;
    ['width','max-width'].forEach(p=>{
      if(s.getPropertyPriority(p)==='important'){
        const v=s.getPropertyValue(p);
        s.removeProperty(p);
        if(v&&v!=='none')s.setProperty(p,v);
      }
    });
  });
  _bakeMedia(cl);
  const expDeck=cl.querySelector('.slide-deck');
  const expMeta=cl.querySelector('meta[name="deck-hash"]');
  if(expDeck){
    expDeck.style.transform='';
    expDeck.querySelectorAll('.ed-crosshair-h,.ed-crosshair-v,.ed-grid,.ed-snap-h,.ed-snap-v').forEach(e=>e.remove());
  }
  if(expDeck&&expMeta){
    let h=5381;const s=expDeck.innerHTML;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;
    expMeta.setAttribute('content',h.toString(36));
  }
  return{cl,expDeck,expMeta};
}

/* ── 현재 파일의 상대 경로 추출 (save-server.js 기준) ──
   localhost:3000  → /presentations/xxx/file.html  → 그대로 상대경로
   file://         → 절대 경로에서 PPTX 루트 기준 상대경로 추출 시도
   ────────────────────────────────────────────────────────────── */
function _getFilePath(){
  const href=location.href;
  /* localhost */
  if(href.includes('localhost')||href.includes('127.0.0.1')){
    /* pathname = /presentations/xxx/file.html → 앞 / 제거 */
    return decodeURIComponent(location.pathname.replace(/^\//,''));
  }
  /* file:// — 절대경로에서 PPTX 루트 이후 부분만 */
  const m=href.match(/[\/\\]PPTX[\/\\](.+\.html)/i);
  if(m)return m[1].replace(/\\/g,'/');
  /* 최후 수단: 파일명만 */
  return location.pathname.split('/').pop()||'presentation.html';
}

/* ── Save: 포토샵처럼 현재 파일 직접 덮어씀 ──
   1순위: localhost:3001 Save API (file:// 포함 모든 환경)
   2순위: File System Access API (localhost 전용 폴백)
   3순위: 다운로드 (완전 폴백)
   ──────────────────────────────────────────── */
async function save(){
  if(!_dirty)return; /* 변경 없으면 무시 */
  try{
    msg('저장 중…');
    const{cl,expDeck,expMeta}=_buildSaveHTML();
    await _inlineAssets(cl);
    const fullHTML='<!DOCTYPE html>\n'+cl.outerHTML;
    const lsSave=()=>{try{localStorage.setItem(CFG.LS_SAVE,expDeck?expDeck.innerHTML:'');localStorage.setItem(CFG.LS_HASH,expMeta?expMeta.getAttribute('content'):'')}catch(e){}};

    /* ── Save API 서버로 파일 직접 저장 ── */
    try{
      await fetch(CFG.SAVE_API+'/ping',{signal:AbortSignal.timeout(800)});
      const filePath=_getFilePath();
      const res=await fetch(CFG.SAVE_API+'/save',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({filePath,html:fullHTML}),
        signal:AbortSignal.timeout(10000)
      });
      const json=await res.json();
      if(!json.ok)throw new Error(json.error);
      lsSave();
      _setDirty(false);
      msg('💾 저장됨 ('+json.kb+'KB)');
      return;
    }catch(e){
      if(e.name!=='AbortError')console.warn('[SaveAPI]',e.message);
    }

    /* API 서버 없으면 localStorage에만 저장 (다이얼로그 없음) */
    lsSave();_setDirty(false);
    msg('⚠ 서버시작.bat을 실행해야 파일 저장 가능 — 편집은 localStorage에 보관됨');
  }catch(e){console.error('[Save]',e);msg('Save 실패: '+e.message)}
}

function loadSaved(){
  try{
    const d=localStorage.getItem(CFG.LS_SAVE);
    if(d){
      /* Preserve overlays */
      const ov=[];deck.querySelectorAll('.ed-guide-169,.ed-crosshair-h,.ed-crosshair-v,.ed-grid,.ed-snap-h,.ed-snap-v').forEach(e=>{ov.push(e);e.remove()});
      deck.innerHTML=d;
      ov.forEach(e=>deck.appendChild(e));
      /* Clean all runtime/editor artifacts from saved state */
      deck.querySelectorAll('.slide').forEach(s=>{s.classList.remove('active','exit-left','exit-right');s.removeAttribute('aria-hidden')});
      deck.querySelectorAll('.visible').forEach(e=>e.classList.remove('visible'));
      deck.querySelectorAll('.ed-drag-handle,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e,.ed-media-del,.ed-resize-handle,.ed-crop-handle').forEach(e=>e.remove());
      deck.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));
      pAPI.reinit();
      return true;
    }
  }catch(e){}
  return false;
}

/* ============================================================
   EXPORT — 폴더 기반 flat 복사 (v2.0)
   ============================================================
   원칙:
   - HTML + 모든 미디어가 **한 폴더에** 모임 (flat)
   - HTML 하나만 더블클릭하면 file:// 에서 정상 작동
   - 미디어는 절대 base64 임베드하지 않음 (원본 파일 복사)
   - Google Fonts CSS만 base64로 임베드 (오프라인 작동 위해)
   - 뷰어 전용: editor.js, save-server 의존성 전부 제거
   - localhost 서버 필수 (폴더 복사 실행 주체)

   실패 정책:
   - 서버 안 떠있으면 → 에러 메시지 + 중단 (fallback 없음, 애매한 Export 금지)
   - 미디어 원본 없음 → manifest에 기록 + 사용자에게 경고
   ============================================================ */
async function exportHTML(){
  try{
    /* ── 0. 사전 체크: file:// 에서 열렸으면 localhost로 이동 안내 ── */
    if(location.protocol==='file:'){
      await confirmDlg(
        '⚠ 이 파일이 file:// 로 열려있습니다.\n\n'+
        'Export는 브라우저의 폴더 선택 다이얼로그(showDirectoryPicker)가 필요하며,\n'+
        '이는 http://localhost 에서만 작동합니다.\n\n'+
        '해결 방법:\n'+
        '1. 서버시작.bat 실행\n'+
        '2. 자동으로 열리는 http://localhost:3000 에서 이 프레젠테이션 다시 열기\n'+
        '3. Export 재시도',
        {okOnly:true}
      );
      return;
    }

    /* ── 1. 서버 생존 확인 (미디어 원본 읽기 용) ── */
    let serverOk=false;
    try{
      const r=await fetch(CFG.SAVE_API+'/ping',{signal:AbortSignal.timeout(1500)});
      const j=await r.json(); serverOk=!!j.ok;
    }catch(e){}
    if(!serverOk){
      await confirmDlg('서버시작.bat 서버(localhost:3001)에 연결할 수 없습니다.\n\n서버를 시작한 뒤 다시 시도해주세요.',{okOnly:true});
      return;
    }

    /* ── 2. showDirectoryPicker 지원 여부 체크 ── */
    if(!window.showDirectoryPicker){
      await confirmDlg('이 브라우저는 폴더 선택을 지원하지 않습니다.\n\nChrome 또는 Edge 최신 버전을 사용해주세요.',{okOnly:true});
      return;
    }

    /* ── 3. 사용자가 폴더 선택 (Windows 기본 다이얼로그) ── */
    let dirHandle;
    try{
      dirHandle=await window.showDirectoryPicker({mode:'readwrite', id:'pptx-export', startIn:'desktop'});
    }catch(e){
      if(e.name==='AbortError'){ msg('Export 취소됨'); return; }
      throw e;
    }

    /* ── 4. 파일명은 현재 HTML 파일명 그대로 자동 사용 (사용자 입력 없음) ──
       location.pathname은 URL 인코딩 상태이므로 decodeURIComponent 필수 */
    const rawName=decodeURIComponent(location.pathname.split('/').pop()||'presentation.html');
    const safeHtmlName=rawName.replace(/[<>:"/\\|?*\x00-\x1F]/g,'_');

    msg('Export 준비 중…');

    /* ── 2. DOM 클론 + 런타임 아티팩트 제거 ── */
    const cl=document.documentElement.cloneNode(true);
    /* Editor UI/오버레이 완전 제거 */
    ['.ed-nav','.ed-panel','.ed-toolbar','.ed-toast','.ed-mode-badge','.ed-confirm','.ed-file-bar',
     '#edFileImg','#edFileVid','#edFilePlt',
     '.ed-grid','.ed-snap-h','.ed-snap-v','.ed-crosshair-h','.ed-crosshair-v','.ed-guide-169',
     '.ed-drag-handle','.ed-block-resize','.ed-block-resize-w','.ed-block-resize-e',
     '.ed-media-del','.ed-resize-handle','.ed-crop-handle'
    ].forEach(s=>cl.querySelectorAll(s).forEach(e=>e.remove()));
    cl.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));
    cl.querySelectorAll('img[draggable]').forEach(e=>e.removeAttribute('draggable'));
    _cleanAnimChars(cl);
    _reapplyAnimChars(cl);
    _bakeMedia(cl);
    cl.querySelector('body').classList.remove('editor-mode','show-grid','show-notes');

    /* ── 3. 런타임 상태(active/visible) 정리 — 첫 슬라이드만 active 로 ── */
    const slides=cl.querySelectorAll('.slide-deck .slide');
    slides.forEach(s=>{s.classList.remove('active','exit-left','exit-right');s.removeAttribute('aria-hidden')});
    cl.querySelectorAll('.visible').forEach(e=>e.classList.remove('visible'));
    if(slides[0]){slides[0].classList.add('active');slides[0].setAttribute('aria-hidden','false');}
    const expDeck=cl.querySelector('.slide-deck');
    if(expDeck){expDeck.style.transform='';}

    /* ── 4. 에디터 스크립트(editor.js) 완전 제거 ── */
    /* Export된 파일은 뷰어 전용. engine.css + presentation.js 만 인라인. */
    const scriptEls=cl.querySelectorAll('script');
    scriptEls.forEach(sc=>{
      const src=(sc.getAttribute('src')||'').toLowerCase();
      const txt=sc.textContent||'';
      const isInlineEditorRuntime = !src && (
        txt.indexOf('panel-context.js —')>=0 ||
        txt.indexOf('editor.core.js —')>=0 ||
        txt.indexOf('editor.block.js —')>=0 ||
        txt.indexOf('editor.io.js —')>=0 ||
        txt.indexOf('editor.main.js —')>=0
      );
      const isEditorRuntime =
        src.endsWith('editor.js') ||
        src.endsWith('panel-context.js') ||
        src.indexOf('editor/editor.')>=0 ||
        isInlineEditorRuntime;
      if(isEditorRuntime) sc.remove();
    });
    /* engine-mode=presentation 메타 추가 — self-check 가 export 결과물에서 스킵 */
    const _ehd=cl.querySelector('head');
    if(_ehd && !cl.querySelector('meta[name="engine-mode"]')){
      const m=document.createElement('meta');
      m.setAttribute('name','engine-mode');
      m.setAttribute('content','presentation');
      _ehd.appendChild(m);
    }
    /* engine-mode=presentation 메타 추가 → presentation.js self-check 가
       editor/PanelCtx 누락을 정상으로 인식하고 스킵 (배너 안 뜸) */
    const expHead=cl.querySelector('head');
    if(expHead && !cl.querySelector('meta[name="engine-mode"]')){
      const m=document.createElement('meta');
      m.setAttribute('name','engine-mode');
      m.setAttribute('content','presentation');
      expHead.appendChild(m);
    }

    /* ── 5. 엔진 CSS + JS 인라인 (파일은 복사 안 함) ── */
    await _inlineEngineAssets(cl);

    /* ── 6. Google Fonts 오프라인화 (base64 임베드) ── */
    await _embedGoogleFonts(cl);

    /* ── 7. 미디어 수집 + src를 basename으로 재작성 ── */
    const assetsToCopy=[]; /* [{ref, dstName, data?}] */
    const dstNameByRef=new Map();
    const usedNames=new Set();

    function allocName(ref, preferredBase){
      /* ref는 원본의 고유 ID, preferredBase는 사람이 볼 파일명.
         blob URL은 파일명이 같아도 서로 다른 원본일 수 있으므로 ref와 파일명을 분리한다. */
      if(dstNameByRef.has(ref)) return dstNameByRef.get(ref);
      let base=((preferredBase||ref).split(/[/\\]/).pop()||'media').replace(/[?#].*$/,'');
      base=base.replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').replace(/\s+/g,'_');
      if(!base) base='media';
      let name=base, i=2;
      while(usedNames.has(name.toLowerCase())){
        const dot=base.lastIndexOf('.');
        const stem=dot>0?base.slice(0,dot):base;
        const ext =dot>0?base.slice(dot):'';
        name=stem+'_'+i+ext; i++;
      }
      usedNames.add(name.toLowerCase());
      dstNameByRef.set(ref,name);
      return name;
    }

    /* 7a. <img src>, <video src>, <source src>, <audio src>, <iframe src> 처리 */
    const mediaSelectors='img[src],video[src],source[src],audio[src]';
    for(const el of cl.querySelectorAll(mediaSelectors)){
      const src=el.getAttribute('src');
      if(!src) continue;
      /* data: URL — base64 페이로드 그대로 복사 대상 */
      if(src.startsWith('data:')){
        const ref='embedded_'+Math.random().toString(36).slice(2,8)+_guessExtFromDataURL(src);
        const name=allocName(ref);
        assetsToCopy.push({ref, dstName:name, data:src});
        el.setAttribute('src', name);
        continue;
      }
      /* blob: URL — _blobFileMap에서 원본 File 객체 꺼내서 처리.
         원본 파일이 어느 폴더에 있었든(하위폴더, 다른 드라이브, D&D 등) 무관하게 작동. */
      if(src.startsWith('blob:')){
        const entry=_blobFileMap.get(src);
        if(entry && entry.file){
          const ref=src;
          const name=allocName(ref, entry.name||el.dataset?.filename||'blob_media');
          assetsToCopy.push({ref, dstName:name, blob:entry.file});
          el.setAttribute('src', name);
        }else{
          /* 맵에 없음 — 페이지 리로드 후 src가 blob으로 남은 이상 상태.
             폴백: fetch로 시도 (같은 세션이면 가능) */
          try{
            const fname=el.dataset?.filename||'blob_media';
            const r=await fetch(src); const b=await r.blob();
            const ref=src;
            const name=allocName(ref, fname);
            assetsToCopy.push({ref, dstName:name, blob:b});
            el.setAttribute('src', name);
          }catch(e){
            console.warn('[export] blob 원본 없음 (페이지 리로드됨?)', src, e);
            /* src를 파일명 추정값으로라도 바꿔 manifest에 missing 기록 */
            const fname=el.dataset?.filename||'missing_blob_media';
            el.setAttribute('src', fname);
          }
        }
        continue;
      }
      /* http(s) 외부 URL — 건드리지 않음 (유튜브 iframe 등) */
      if(/^https?:\/\//.test(src)) continue;
      /* 상대경로 / 절대경로 — 서버가 원본 읽어서 복사 */
      const name=allocName(src);
      assetsToCopy.push({ref:src, dstName:name});
      el.setAttribute('src', name);
    }

    /* 7b. iframe[src] — 유튜브 등은 http, 로컬 파일은 복사 */
    for(const el of cl.querySelectorAll('iframe[src]')){
      const src=el.getAttribute('src');
      if(!src || /^https?:\/\//.test(src) || src.startsWith('data:')) continue;
      const name=allocName(src);
      assetsToCopy.push({ref:src, dstName:name});
      el.setAttribute('src', name);
    }

    /* 7c. poster, srcset, style="background-image:url(...)" 전수 스캔 */
    for(const el of cl.querySelectorAll('[poster]')){
      const src=el.getAttribute('poster');
      if(src && !/^(data:|https?:)/.test(src)){
        const name=allocName(src);
        if(!dstNameByRef.has(src)) assetsToCopy.push({ref:src, dstName:name});
        el.setAttribute('poster', name);
      }
    }
    for(const el of cl.querySelectorAll('[style]')){
      const st=el.getAttribute('style');
      if(st && /url\(/i.test(st)){
        const rewritten=st.replace(/url\((['"]?)([^'")]+)\1\)/gi,(m,q,u)=>{
          if(/^(data:|https?:|blob:)/.test(u)) return m;
          const name=allocName(u);
          if(!dstNameByRef.has(u)) assetsToCopy.push({ref:u, dstName:name});
          return 'url('+q+name+q+')';
        });
        if(rewritten!==st) el.setAttribute('style', rewritten);
      }
    }

    /* ── 8. deck-hash 업데이트 ── */
    const expMeta=cl.querySelector('meta[name="deck-hash"]');
    if(expDeck&&expMeta){
      let h=5381;const s=expDeck.innerHTML;
      for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0;
      expMeta.setAttribute('content', h.toString(36));
    }

    /* ── 9. 최종 HTML 완성 ── */
    const fullHTML='<!DOCTYPE html>\n'+cl.outerHTML;
    const sourceHtml=_getFilePath(); /* PPTX 루트 기준 상대경로 */

    /* ── 10. 자체 검증 (외부 URL 잔존 스캔) ── */
    const warnings=_validateExportedHTML(fullHTML);

    /* ── 11. 브라우저가 직접 폴더에 파일 쓰기 (showDirectoryPicker 핸들) ── */
    msg('파일 쓰는 중…');

    /* 11a. HTML 먼저 쓰기 */
    await _writeFileToDir(dirHandle, safeHtmlName, fullHTML, 'text/html;charset=utf-8');

    /* 11b. 미디어 하나씩 복사 */
    const copied=[]; const missing=[];
    for(let i=0;i<assetsToCopy.length;i++){
      const a=assetsToCopy[i];
      msg('미디어 복사 '+(i+1)+'/'+assetsToCopy.length+'…');
      try{
        let bytes;
        if(a.blob){
          /* 세션 맵에서 꺼낸 원본 File 객체 — 어느 폴더에 있었든 무관 */
          await _writeBlobToDir(dirHandle, a.dstName, a.blob);
          bytes=a.blob.size;
        }else if(a.data){
          /* data URL — 브라우저에서 직접 디코드 */
          const blob=await (await fetch(a.data)).blob();
          await _writeBlobToDir(dirHandle, a.dstName, blob);
          bytes=blob.size;
        }else{
          /* 서버에서 원본 파일 받아오기 (HTML 기준 상대경로) */
          const url=CFG.SAVE_API+'/read-asset?relTo='+encodeURIComponent(sourceHtml)+'&ref='+encodeURIComponent(a.ref);
          const r=await fetch(url);
          const j=await r.json();
          if(!j.ok){ missing.push({ref:a.ref, reason:j.error}); continue; }
          const bin=atob(j.base64);
          const arr=new Uint8Array(bin.length);
          for(let k=0;k<bin.length;k++) arr[k]=bin.charCodeAt(k);
          await _writeBytesToDir(dirHandle, a.dstName, arr, j.mime||'application/octet-stream');
          bytes=j.bytes;
        }
        copied.push({ref:a.ref, name:a.dstName, bytes});
      }catch(e){
        console.warn('[export] copy failed', a.ref, e);
        missing.push({ref:a.ref, reason:e.message});
      }
    }

    /* 11c. manifest — 누락/경고 있을 때만 생성 (깨끗한 Export는 파일 오염 안 시킴) */
    const needManifest = missing.length > 0 || warnings.length > 0;
    if(needManifest){
      const manifest={
        exportedAt: new Date().toISOString(),
        engineVersion: '2.1',
        html: { name:safeHtmlName, bytes: fullHTML.length },
        files: copied,
        missing,
        warnings,
        totalBytes: copied.reduce((s,c)=>s+c.bytes,0) + fullHTML.length
      };
      await _writeFileToDir(dirHandle, '_export_manifest.json',
        JSON.stringify(manifest,null,2), 'application/json');
    }

    /* ── 12. 결과 보고 ──
       깨끗한 Export는 토스트 한 줄로 끝.
       누락/경고 있을 때만 상세 모달 (사용자가 알아야 할 때만 방해) */
    const copyCount=copied.length;
    const missingCount=missing.length;
    console.log('[export]',{dir:dirHandle.name, html:safeHtmlName, copied, missing, warnings});

    if(missingCount>0 || warnings.length){
      let report='⚠ Export 완료 (주의 필요) → '+dirHandle.name+'/\n\n';
      report+='• HTML: '+safeHtmlName+'\n';
      report+='• 복사된 파일: '+copyCount+'개\n';
      if(missingCount>0){
        report+='• 누락: '+missingCount+'개\n';
        missing.forEach(m=>{ report+='   - '+m.ref+' ('+m.reason+')\n'; });
      }
      if(warnings.length){
        report+='\n경고:\n';
        warnings.forEach(w=>{ report+=' - '+w+'\n'; });
      }
      report+='\n_export_manifest.json 확인';
      await confirmDlg(report,{okOnly:true});
      msg('⚠ Export 완료 — 누락/경고 있음');
    }else{
      msg('✔ Export 완료 — '+dirHandle.name+'/'+safeHtmlName+' ('+copyCount+'개 미디어)');
    }
  }catch(e){
    console.error('[Export]',e);
    msg('Export 실패: '+e.message);
    try{ await confirmDlg('Export 실패:\n\n'+e.message,{okOnly:true}); }catch(_){}
  }
}

/* ============================================================
   FileSystemDirectoryHandle 유틸 — 브라우저가 직접 폴더에 쓰기
   ============================================================ */
async function _writeFileToDir(dirHandle, name, content, mime){
  const fileHandle=await dirHandle.getFileHandle(name, {create:true});
  const writable=await fileHandle.createWritable();
  await writable.write(new Blob([content], {type:mime||'application/octet-stream'}));
  await writable.close();
}
async function _writeBlobToDir(dirHandle, name, blob){
  const fileHandle=await dirHandle.getFileHandle(name, {create:true});
  const writable=await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}
async function _writeBytesToDir(dirHandle, name, uint8arr, mime){
  const fileHandle=await dirHandle.getFileHandle(name, {create:true});
  const writable=await fileHandle.createWritable();
  await writable.write(new Blob([uint8arr], {type:mime||'application/octet-stream'}));
  await writable.close();
}

/* 파일명 입력용 커스텀 다이얼로그 (prompt 대체 — 한글 처리 깔끔) */
function inputDlg(label, defaultValue){
  return new Promise(resolve=>{
    const d=document.createElement('div');
    d.className='ed-confirm';
    d.innerHTML='<div class="ed-confirm-box">'+
      '<p style="margin:0 0 12px 0">'+String(label).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))+'</p>'+
      '<input type="text" class="ed-input-dlg" value="'+String(defaultValue||'').replace(/"/g,'&quot;')+'" style="width:100%;padding:8px 10px;background:#000;border:1px solid #3ECF8E;color:#fff;border-radius:6px;font-size:14px;font-family:inherit">'+
      '<div class="ed-confirm-btns"><button class="cancel">취소</button><button class="ok">확인</button></div>'+
    '</div>';
    document.body.appendChild(d);
    const inp=d.querySelector('.ed-input-dlg');
    setTimeout(()=>{ inp.focus(); inp.select(); }, 50);
    const ok=()=>{ const v=inp.value; d.remove(); resolve(v); };
    const cancel=()=>{ d.remove(); resolve(null); };
    d.querySelector('.ok').onclick=ok;
    d.querySelector('.cancel').onclick=cancel;
    inp.onkeydown=e=>{
      if(e.key==='Enter'){ e.preventDefault(); ok(); }
      else if(e.key==='Escape'){ e.preventDefault(); cancel(); }
    };
  });
}

/* 기본 Export 폴더 추천 (운영체제에 따라) */
function _getDefaultExportDir(){
  const p=location.pathname;
  const name=(p.split('/').pop()||'deck').replace(/\.html$/,'');
  const isWin=navigator.userAgent.includes('Windows');
  return (isWin?'C:\\temp\\':'/tmp/')+name;
}

/* Data URL → 확장자 추측 */
function _guessExtFromDataURL(u){
  const m=u.match(/^data:([^;]+);/);
  if(!m) return '.bin';
  const mime=m[1];
  return ({
    'image/png':'.png','image/jpeg':'.jpg','image/gif':'.gif',
    'image/webp':'.webp','image/svg+xml':'.svg',
    'video/mp4':'.mp4','video/webm':'.webm',
    'audio/mpeg':'.mp3','audio/wav':'.wav'
  })[mime] || '.bin';
}

/* Blob → Data URL (base64) */
function _blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=reject;
    r.readAsDataURL(blob);
  });
}

/* 엔진 CSS+JS 인라인 — Export 전용 (editor.js는 이미 DOM에서 제거됨) */
async function _inlineEngineAssets(cl){
  /* CSS */
  for(const link of cl.querySelectorAll('link[rel="stylesheet"]')){
    const href=link.getAttribute('href');
    if(!href) continue;
    const abs=_absURL(href);
    /* 외부 CDN은 스킵 (Google Fonts는 _embedGoogleFonts가 처리) */
    if(!abs||(abs.startsWith('http')&&!abs.startsWith(location.origin+'/'))) continue;
    let css=_assetCache[abs];
    if(!css){
      try{ const r=await fetch(abs); if(r.ok) css=await r.text(); }catch(e){}
    }
    if(!css) throw new Error('엔진 CSS 로드 실패: '+href+' (서버 미실행 또는 경로 문제)');
    const styleEl=document.createElement('style');
    styleEl.setAttribute('data-source', href);
    styleEl.textContent=css;
    link.replaceWith(styleEl);
  }
  /* JS (editor.js는 이미 제거됨, presentation.js만 남음) */
  for(const sc of cl.querySelectorAll('script[src]')){
    const src=sc.getAttribute('src');
    if(!src) continue;
    const abs=_absURL(src);
    if(!abs||(abs.startsWith('http')&&!abs.startsWith(location.origin+'/'))) continue;
    let js=_assetCache[abs];
    if(!js){
      try{ const r=await fetch(abs); if(r.ok) js=await r.text(); }catch(e){}
    }
    if(!js) throw new Error('엔진 JS 로드 실패: '+src);
    const inl=document.createElement('script');
    inl.setAttribute('data-source', src);
    inl.textContent=js;
    sc.replaceWith(inl);
  }
}

/* Google Fonts를 base64로 임베드 — 오프라인 작동.
   subset 방식: 슬라이드에서 실제 쓰인 글자만 폰트로 가져옴 (용량 최소화).
   한글 Noto Sans KR full을 전부 담으면 weight당 2MB씩 부풀어나므로 필수 최적화. */
async function _embedGoogleFonts(cl){
  const links=Array.from(cl.querySelectorAll('link[href*="fonts.googleapis.com"]'));
  if(!links.length) return;
  /* preconnect 태그 제거 (오프라인에선 불필요) */
  cl.querySelectorAll('link[rel="preconnect"][href*="fonts.g"]').forEach(e=>e.remove());

  /* 현재 슬라이드에서 실제로 사용된 모든 텍스트 수집 → 중복 제거 */
  const allText = cl.querySelector('.slide-deck')?.textContent || '';
  /* 최소 기본 글자 (숫자, 영문, 공백, 자주 쓰는 기호) 포함 */
  const defaultGlyphs = '0123456789'
    + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    + 'abcdefghijklmnopqrstuvwxyz'
    + ' .,;:!?\'"()[]{}-_/\\+=*&%@#~`<>|^$\n\t';
  const textSet = new Set([...(allText + defaultGlyphs)]);
  const textParam = [...textSet].filter(c => c.charCodeAt(0) >= 32).join('');

  for(const link of links){
    const originalHref=link.getAttribute('href');
    if(!originalHref || !originalHref.startsWith('http')) continue;
    /* &text= 파라미터로 subset 요청 — Google이 실제 사용된 글자만 담은 폰트 반환 */
    const sep = originalHref.includes('?') ? '&' : '?';
    const subsetHref = originalHref + sep + 'text=' + encodeURIComponent(textParam);
    try{
      const cssRes=await fetch(subsetHref);
      if(!cssRes.ok) throw new Error('status '+cssRes.status);
      let css=await cssRes.text();
      const urlRe=/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
      const matches=[...css.matchAll(urlRe)];
      for(const m of matches){
        const u=m[1];
        try{
          const fr=await fetch(u);
          if(!fr.ok) continue;
          const blob=await fr.blob();
          const dataUrl=await _blobToBase64(blob);
          css=css.replace(u, dataUrl);
        }catch(e){ console.warn('[fonts] woff2 fetch fail', u); }
      }
      const styleEl=document.createElement('style');
      styleEl.setAttribute('data-source','google-fonts-embedded-subset');
      styleEl.textContent=css;
      link.replaceWith(styleEl);
    }catch(e){
      console.warn('[fonts] subset embed failed, trying full:', e.message);
      /* subset 실패 시 풀 폰트로 재시도 (그래도 15MB는 부담이라 폴백만) */
      try{
        const cssRes=await fetch(originalHref);
        let css=await cssRes.text();
        const urlRe=/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
        for(const m of [...css.matchAll(urlRe)]){
          try{
            const fr=await fetch(m[1]); const blob=await fr.blob();
            const dataUrl=await _blobToBase64(blob);
            css=css.replace(m[1], dataUrl);
          }catch(_){}
        }
        const styleEl=document.createElement('style');
        styleEl.setAttribute('data-source','google-fonts-embedded-full');
        styleEl.textContent=css;
        link.replaceWith(styleEl);
      }catch(e2){
        console.warn('[fonts] full embed also failed — leaving link:', e2.message);
      }
    }
  }
}

/* Export된 HTML 자체 검증 — 외부 URL/누락 참조 스캔 */
function _validateExportedHTML(html){
  const warnings=[];
  /* (1) localhost/127.0.0.1 참조 = 절대 금지 (다른 PC에서 깨짐) */
  const localMatches=html.match(/https?:\/\/(localhost|127\.0\.0\.1)[^\s"')]*/g);
  if(localMatches && localMatches.length){
    warnings.push('localhost 참조 발견: '+localMatches.slice(0,3).join(', ')+(localMatches.length>3?'…':''));
  }
  /* (2) file:// 절대경로 잔존 */
  const fileMatches=html.match(/file:\/\/\/[^\s"')]*/g);
  if(fileMatches && fileMatches.length){
    warnings.push('file:// 절대경로 발견: '+fileMatches.slice(0,3).join(', '));
  }
  /* (3) Windows 드라이브 경로 잔존 */
  const winMatches=html.match(/[a-zA-Z]:[\\/][^\s"')]*\.(png|jpg|jpeg|gif|mp4|webm|webp)/gi);
  if(winMatches && winMatches.length){
    warnings.push('절대경로 잔존: '+winMatches.slice(0,3).join(', '));
  }
  /* (4) 상대경로 ../ 잔존 (flat 구조 위반) */
  const upMatches=html.match(/(?:src|href)=["']\.\.[\\/][^"']+["']/g);
  if(upMatches && upMatches.length){
    warnings.push('상위 폴더 참조(..) 잔존 — flat 구조 위반: '+upMatches.slice(0,3).join(', '));
  }
  return warnings;
}

async function resetAll(){
  if(!await confirmDlg('전체 슬라이드를 원본으로 초기화합니까?\n(모든 편집 내용이 삭제됩니다)'))return;
  push();
  try{localStorage.removeItem(CFG.LS_SAVE);localStorage.removeItem(CFG.LS_HASH)}catch(e){}
  /* Preserve overlays */
  const ov=[];deck.querySelectorAll('.ed-guide-169,.ed-crosshair-h,.ed-crosshair-v,.ed-grid,.ed-snap-h,.ed-snap-v').forEach(e=>{ov.push(e);e.remove()});
  deck.innerHTML='';
  Object.keys(origHTML).sort((a,b)=>a-b).forEach(k=>{const d=document.createElement('div');d.innerHTML=origHTML[k];deck.appendChild(d.firstElementChild)});
  ov.forEach(e=>deck.appendChild(e));
  pAPI.reinit();sw();_reapplyAnimChars(deck);msg('Reset 완료');
}

/* ============================================================
   SAVE AS — 로컬 전용 (서버 필수)
   ============================================================
   - 임의 경로에 HTML 한 파일만 저장 (미디어 복사 없음)
   - editor.js 참조 유지 (다시 열어서 에디터로 편집 가능)
   - 다른 PC로 이식 안 됨 (이식은 Export 사용)
   - 서버 없으면 실패 (fallback 없음 — 명확한 에러)
   ============================================================ */
async function saveAs(){
  try{
    if(location.protocol==='file:'){
      await confirmDlg('file:// 에서는 Save As 불가.\n\n서버시작.bat 실행 후 http://localhost:3000 에서 열어주세요.',{okOnly:true});
      return;
    }
    if(!window.showDirectoryPicker){
      await confirmDlg('이 브라우저는 폴더 선택을 지원하지 않습니다.\nChrome/Edge 최신 버전 사용해주세요.',{okOnly:true});
      return;
    }

    /* 폴더 선택 */
    let dirHandle;
    try{
      dirHandle=await window.showDirectoryPicker({mode:'readwrite', id:'pptx-save-as', startIn:'documents'});
    }catch(e){
      if(e.name==='AbortError'){ msg('Save As 취소'); return; }
      throw e;
    }
    /* 파일명 — location.pathname은 URL 인코딩 상태이므로 decodeURIComponent 필수 */
    let defName='presentation.html';
    try{ defName = decodeURIComponent(location.pathname.split('/').pop()||'presentation.html'); }catch(e){ defName = location.pathname.split('/').pop()||'presentation.html'; }
    const fileName=await inputDlg('Save As — 파일명:', defName);
    if(!fileName){ msg('Save As 취소'); return; }
    const safeName=fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g,'_');

    msg('다른 이름으로 저장 중…');
    const{cl,expDeck,expMeta}=_buildSaveHTML();
    await _inlineAssets(cl);
    const fullHTML='<!DOCTYPE html>\n'+cl.outerHTML;
    await _writeFileToDir(dirHandle, safeName, fullHTML, 'text/html;charset=utf-8');
    try{localStorage.setItem(CFG.LS_SAVE,expDeck?expDeck.innerHTML:'');localStorage.setItem(CFG.LS_HASH,expMeta?expMeta.getAttribute('content'):'')}catch(e){}
    _setDirty(false);
    msg('✔ Save As 완료 → '+dirHandle.name+'/'+safeName);
  }catch(e){console.error('[SaveAs]',e);msg('Save As 실패: '+e.message)}
}

/* downloadHTML alias kept for compatibility */
function downloadHTML(){exportHTML()}

/* ============================================================
   TOGGLE EDITOR
   ============================================================ */
function toggle(){
  const active=document.body.classList.toggle('editor-mode');
  /* Recalculate scale after mode switch (frame size changes due to panels) */
  setTimeout(()=>pAPI.updateScale(),50);
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
/* Click → select element, show toolbar, or drag media directly */
document.addEventListener('mousedown',e=>{
  if(!isEd())return;
  if(e.target.closest(BLOCK.ARTIFACT_SEL))return;

  if(suppressNextSelect){suppressNextSelect=false;return;}

  /* ── Space/Alt + 드래그 = 블럭 이동 (A3) ── */
  if(moveKeyHeld||e.altKey){
    /* 클릭 지점의 블럭을 이동 대상으로 */
    let anchor = selBlock;
    const clickedBlock = findBlock(e.target);
    /* 선택된 블럭이 없거나 클릭한 게 다른 블럭이면 먼저 선택 */
    if(!anchor || (clickedBlock && !selBlocks.includes(clickedBlock))){
      if(clickedBlock){
        /* 다중 선택 상태가 아니면 새로 선택 */
        if(selBlocks.length<=1){
          setBlockState(clickedBlock,'select');
          showBar&&showBar(clickedBlock);
        }
        anchor = clickedBlock;
      }
    }
    if(anchor){
      startMoveDrag(anchor,e);
      return;
    }
  }

  /* media wrap — 클릭 = 선택 + 바로 드래그 이동 (alt 필요 없음).
     드래그 여부는 마우스가 실제로 움직였는지로 판단되므로 단순 클릭은 여전히
     "선택만" 으로 끝난다. */
  const mw=e.target.closest('.ed-media-wrap');
  if(mw){
    /* 리사이즈 핸들/삭제 버튼/영상 컨트롤 등 내부 UI 클릭은 드래그 금지 */
    if(e.target.closest('.ed-resize-handle,.ed-media-del,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e')){
      return;
    }
    setBlockState(mw,'select');
    showBar(mw);
    _syncVideoButtons(mw.querySelector('video'));
    startMoveDrag(mw, e);
    return;
  }

  /* Shift+클릭 = 다중 선택 토글 */
  if(e.shiftKey){
    const blk=findBlock(e.target);
    if(blk){
      toggleBlockSelection(blk);
      showBar(blk);
      tbClosed=false;
      return;
    }
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
  /* 일반 블럭은 mousedown에서 이미 처리됨. 텍스트 선택 방지만. */
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
  if(!sel)return;push();const c=sel.cloneNode(true);
  /* Offset the duplicate */
  const lPx=parseFloat(c.style.left||0),tPx=parseFloat(c.style.top||0);
  c.style.left=(lPx+CFG.DUP_OFFSET)+'px';c.style.top=(tPx+CFG.DUP_OFFSET)+'px';
  sel.after(c);attachHandles();msg('복제');
}
function setSlideBg(c){push();curSlide().style.background=c;$('edSlideBg').value=c}

/* Keyboard shortcuts */
document.addEventListener('keydown',e=>{
  if(!isEd())return;
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
  /* Ctrl+D = duplicate element */
  if(e.ctrlKey&&(e.key==='d'||e.key==='D')){e.preventDefault();dupEl();return}

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
    targets.forEach(b=>{
      if(!b.classList.contains('ed-media-wrap'))b.style.position='relative';
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
      toDel.forEach(b=>{
        b.querySelectorAll(BLOCK.ARTIFACT_SEL).forEach(a=>a.remove());
        b.remove();
      });
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

  /* Ctrl+G — 감싸기 (Card) */
  if(e.ctrlKey&&!e.shiftKey&&(e.key==='g'||e.key==='G')){
    if(selBlocks.length){e.preventDefault();groupBlocksWrap(selBlocks);return;}
    if(selBlock){e.preventDefault();groupBlocksWrap([selBlock]);return;}
  }
  /* Ctrl+Shift+G — 풀기 */
  if(e.ctrlKey&&e.shiftKey&&(e.key==='g'||e.key==='G')){
    if(selBlock){e.preventDefault();ungroupBlockUnwrap(selBlock);return;}
  }
  /* W — Wrap in Card (단일/멀티 모두) — IDLE/SELECTED 상태에서만, EDITING 제외
     Shift+W — Wrap in Frame (투명 컨테이너) */
  if(!editingBlock&&!e.target.isContentEditable&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(e.key==='w'||e.key==='W')){
    const targets=selBlocks.length?selBlocks:(selBlock?[selBlock]:[]);
    if(targets.length){
      e.preventDefault();
      if(e.shiftKey)wrapBlocks(targets,{mode:'frame',layout:null,autoSeq:false});
      else          wrapBlocks(targets,{mode:'card', layout:null,autoSeq:true});
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
  /* Ctrl+D — 복제 (EDITING 아닐 때만) */
  if(e.ctrlKey&&!e.shiftKey&&(e.key==='d'||e.key==='D')&&!editingBlock&&selBlock){
    e.preventDefault();
    push();
    const c=selBlock.cloneNode(true);
    c.querySelectorAll(BLOCK.ARTIFACT_SEL).forEach(a=>a.remove());
    const lPx=parseFloat(c.style.left||0),tPx=parseFloat(c.style.top||0);
    c.style.left=(lPx+CFG.DUP_OFFSET)+'px';c.style.top=(tPx+CFG.DUP_OFFSET)+'px';
    selBlock.after(c);
    attachHandles&&attachHandles();on&&on();
    setBlockState(c,'select');showBar&&showBar(c);
    msg('복제');_setDirty(true);
    return;
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

document.addEventListener('focusout',e=>{if(e.target.isContentEditable&&isEd()){push();buildNav();_setDirty(true)}});

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

/* ============================================================
   ✂ CROP — 이미지/영상 픽셀 크롭 (data-crop-* + CSS variables)
   ============================================================ */
function _cropTarget(){
  /* 1) selBlock 자체가 wrap */
  if(selBlock && selBlock.classList && selBlock.classList.contains('ed-media-wrap')) return selBlock;
  /* 2) sel 자체가 wrap */
  if(sel && sel.classList && sel.classList.contains('ed-media-wrap')) return sel;
  /* 3) selBlock/sel이 wrap 안쪽 미디어/요소면 closest로 올라감 */
  if(selBlock && selBlock.closest){ const w=selBlock.closest('.ed-media-wrap'); if(w) return w; }
  if(sel && sel.closest){ const w=sel.closest('.ed-media-wrap'); if(w) return w; }
  /* 4) 마지막 fallback: 슬라이드에서 ed-selected 가진 wrap */
  const f = document.querySelector('.slide.active .ed-media-wrap.ed-selected') ||
            document.querySelector('.slide.active .ed-media-wrap');
  return f || null;
}
function _cropClampSide(wrap, side, px){
  const m = wrap.querySelector('img,video,iframe');
  if(!m) return Math.max(0, px|0);
  const W = m.offsetWidth || m.naturalWidth || 0;
  const H = m.offsetHeight || m.naturalHeight || 0;
  const opp = side==='t'?'b':side==='b'?'t':side==='l'?'r':'l';
  const oppPx = parseInt(wrap.getAttribute('data-crop-'+opp),10) || 0;
  const lim = (side==='t'||side==='b') ? Math.max(0, H-oppPx-1) : Math.max(0, W-oppPx-1);
  return Math.min(lim, Math.max(0, px|0));
}
function _cropApply(wrap){
  const t = parseInt(wrap.getAttribute('data-crop-t'),10) || 0;
  const r = parseInt(wrap.getAttribute('data-crop-r'),10) || 0;
  const b = parseInt(wrap.getAttribute('data-crop-b'),10) || 0;
  const l = parseInt(wrap.getAttribute('data-crop-l'),10) || 0;
  wrap.style.setProperty('--cT', t+'px');
  wrap.style.setProperty('--cR', r+'px');
  wrap.style.setProperty('--cB', b+'px');
  wrap.style.setProperty('--cL', l+'px');
  const m = wrap.querySelector('img,video,iframe');
  if(m){
    const mw = m.offsetWidth, mh = m.offsetHeight;
    if(mw && mh){
      wrap.style.width  = Math.max(1, mw - l - r) + 'px';
      wrap.style.height = Math.max(1, mh - t - b) + 'px';
    }
  }
  const has = (t||r||b||l) > 0;
  wrap.classList.toggle('has-crop', has);
  if(!has){ wrap.style.width = ''; wrap.style.height = ''; }
}
function readCrop(){
  const w = _cropTarget(); if(!w) return null;
  return {
    t: parseInt(w.getAttribute('data-crop-t'),10) || 0,
    r: parseInt(w.getAttribute('data-crop-r'),10) || 0,
    b: parseInt(w.getAttribute('data-crop-b'),10) || 0,
    l: parseInt(w.getAttribute('data-crop-l'),10) || 0
  };
}
function setCrop(side, px){
  const w = _cropTarget();
  if(!w){ console.warn('[crop] no target — selBlock=', selBlock, 'sel=', sel); return; }
  side = String(side||'').toLowerCase();
  if(!/^[trbl]$/.test(side)) return;
  console.log('[crop] setCrop side=', side, 'px=', px, 'target=', w);
  push();
  const v = _cropClampSide(w, side, parseInt(px,10)||0);
  if(v) w.setAttribute('data-crop-'+side, v);
  else  w.removeAttribute('data-crop-'+side);
  _cropApply(w);
  _setDirty&&_setDirty(true);
}
function resetCrop(){
  const w = _cropTarget(); if(!w) return;
  push();
  ['t','r','b','l'].forEach(s=>w.removeAttribute('data-crop-'+s));
  _cropApply(w);
  _setDirty&&_setDirty(true);
  msg('크롭 초기화');
  if(window.PanelCtx && PanelCtx._refreshCropUI) PanelCtx._refreshCropUI();
}
function _attachCropHandles(wrap){
  if(!wrap || wrap._cropHandlesAttached) return;
  ['t','r','b','l'].forEach(side=>{
    const h = document.createElement('div');
    h.className = 'ed-crop-handle ' + side;
    h.dataset.side = side;
    h.addEventListener('mousedown', e=>{
      e.preventDefault(); e.stopPropagation();
      push();
      const sc = (window.pAPI && pAPI.deckScale) || 1;
      const sx = e.clientX, sy = e.clientY;
      const start = parseInt(wrap.getAttribute('data-crop-'+side),10) || 0;
      document.body.classList.add('ed-cropping');
      const mv = ev=>{
        const dx = (ev.clientX - sx)/sc;
        const dy = (ev.clientY - sy)/sc;
        let delta = 0;
        if(side==='t') delta =  dy;
        if(side==='b') delta = -dy;
        if(side==='l') delta =  dx;
        if(side==='r') delta = -dx;
        const v = _cropClampSide(wrap, side, start + delta);
        if(v) wrap.setAttribute('data-crop-'+side, v);
        else  wrap.removeAttribute('data-crop-'+side);
        _cropApply(wrap);
        if(window.PanelCtx && PanelCtx._refreshCropUI) PanelCtx._refreshCropUI();
      };
      const up = ()=>{
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        document.body.classList.remove('ed-cropping');
        _setDirty&&_setDirty(true);
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
    wrap.appendChild(h);
  });
  wrap._cropHandlesAttached = true;
  if(wrap.hasAttribute('data-crop-t') || wrap.hasAttribute('data-crop-r') ||
     wrap.hasAttribute('data-crop-b') || wrap.hasAttribute('data-crop-l')){
    _cropApply(wrap);
  }
}

/* ============================================================
   PUBLIC API — single entry point, all methods exposed
   ============================================================ */
window.EA={
  toggle, addSlide, insertImage, insertImageURL, insertVideo, insertVideoFile,
  duplicateSlide:()=>dupAt(pAPI.S.cur), deleteSlide:()=>delAt(pAPI.S.cur), dupAt, delAt,
  insertBlankAfter:(i)=>insertBlankAfter(typeof i==='number'?i:pAPI.S.cur),
  moveSlide, renameSlide,
  save, saveAs, exportHTML, resetAll, undo, redo, downloadHTML, execCmd, setAlign, setSizeMode, setSize, setColor,
  autoStepBySlide,
  setLineHeight, setLetterSpacing, alignEl, zIndex, duplicateEl:dupEl,
  setSlideBg, setPalette, savePalette, loadPalette, savePaletteFile, loadPaletteFile, resetSlide, updateGrid:upGrid,
  minimizeToolbar:minBar, closeToolbar:closeBar, toggleVideoAutoplay, toggleVideoLoop, toggleVideoMute, toggleVideoPlay,
  applyAnim, removeAnim, _sw:sw,
  /* ── 블럭 시스템 v2 ── 툴바 ✕ 버튼용 */
  deleteElement: ()=>{
    if(selBlocks.length>1){
      push();
      const toDel=[...selBlocks];
      toDel.forEach(b=>{b.querySelectorAll(BLOCK.ARTIFACT_SEL).forEach(a=>a.remove());b.remove();});
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
  /* helper: 현재 wrap 대상 (selBlocks 우선, 없으면 selBlock 단일) */
  _wrapTargets: ()=>(selBlocks.length?selBlocks:(selBlock?[selBlock]:[])),
  wrapAsCard: ()=>{
    const t=(selBlocks.length?selBlocks:(selBlock?[selBlock]:[]));
    if(!t.length){msg('블럭을 먼저 선택하세요');return;}
    wrapBlocks(t,{mode:'card',layout:null,autoSeq:true});
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
  /* ✂ Crop — 이미지/영상 픽셀 크롭 */
  setCrop: setCrop,
  readCrop: readCrop,
  resetCrop: resetCrop,
  /* Component */
  makeComponent: ()=>{ if(selBlock)makeComponent(selBlock); else msg('블럭을 선택하세요'); },
  detachInstance: ()=>{ if(selBlock)detachInstance(selBlock); else msg('인스턴스를 선택하세요'); },
  /* Constraints */
  setConstraintH:(v)=>{ if(selBlock)setConstraint(selBlock,'h',v); },
  setConstraintV:(v)=>{ if(selBlock)setConstraint(selBlock,'v',v); },
  /* 패널이 attribute 읽기용으로 호출 — 안전한 읽기 helper */
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
/* Component observer 초기화 (deck 준비 후) */
try{ _initComponentObserver(); }catch(e){ console.warn('Component observer init failed:', e); }
/* 마이그레이션: 기존 .ed-group 요소에 data-group-mode 자동 부여 (1회) */
try{
  document.querySelectorAll('.ed-group:not([data-group-mode])').forEach(el=>{
    el.setAttribute('data-group-mode', el.classList.contains('ed-group-frame')?'frame':'card');
  });
}catch(e){}
})();
