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
  /* 핸들/좌표 계산 대상. attachHandles와 위치 고정 로직은 이 상수만 사용한다. */
  TARGET_SEL: '[data-step], [data-sort], .two-col, .code-block, .card, .principle-card, .joka-cell, .num-item, .flow-step, table, .ed-media-wrap',
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
/* Space + 드래그 이동용 */
let moveKeyHeld = false;      // Space 누름 상태
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
  /* [data-step] / manual reveal order */
  if(el.hasAttribute&&el.hasAttribute('data-step'))return true;
  if(el.hasAttribute&&el.hasAttribute('data-sort'))return true;
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
    if(typeof attachHandles==='function')attachHandles();
    if(typeof stopOverlayLoop==='function')stopOverlayLoop();
    return;
  }
  /* 원본 flow 블럭을 선택/편집하는 순간 슬라이드 전체를 캔버스 좌표로 고정한다.
     삭제뿐 아니라 contenteditable 안에서 글자를 지우는 경우도 flex reflow를 타지 않게 하기 위함. */
  if(typeof materializeForBlocks==='function')materializeForBlocks([el]);
  if(mode==='select'){
    _clearBlockClasses(null); /* 전면 청소 후 이 요소만 선택 표시 */
    el.classList.add(BLOCK.SEL_CLASS);
    el.removeAttribute('contenteditable');
    selBlock=el;editingBlock=null;selBlocks=[el];
    if(typeof _setSel==='function')_setSel(el);
    if(typeof attachHandles==='function')attachHandles();
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
    if(typeof attachHandles==='function')attachHandles();
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

function _editorCanvasScale(){
  if(typeof deck!=='undefined'&&deck&&deck.getBoundingClientRect){
    const r=deck.getBoundingClientRect();
    const w=deck.offsetWidth||parseFloat(getComputedStyle(deck).width)||0;
    if(w&&r.width)return r.width/w;
  }
  return (window.pAPI&&pAPI.deckScale)||1;
}

function _isMaterializeScope(el){
  if(!el||el.nodeType!==1)return false;
  if(el.matches&&el.matches(BLOCK.ARTIFACT_SEL))return false;
  if(el.closest&&el.closest('.speaker-notes'))return false;
  if(el.classList&&el.classList.contains('ed-media-wrap'))return false;
  if(el.matches&&el.matches('.ed-group[data-layout]'))return false;
  if(el.classList&&el.classList.contains('slide'))return true;
  if(el.classList&&el.classList.contains('ed-group'))return true;
  if(el.matches&&el.matches(BLOCK.LAYOUT_WRAPPER_SEL))return true;
  if(el.matches&&el.matches(BLOCK.CONTAINER_SEL))return true;
  return false;
}

function _isMaterializeChild(el){
  if(!el||el.nodeType!==1)return false;
  if(el.matches&&el.matches(BLOCK.ARTIFACT_SEL))return false;
  if(el.closest&&el.closest('.speaker-notes'))return false;
  if(el.classList&&el.classList.contains('speaker-notes'))return false;
  if(el.classList&&el.classList.contains('ed-media-wrap'))return false;
  return isBlock(el) || (el.matches&&el.matches(BLOCK.LAYOUT_WRAPPER_SEL));
}

function _boxForCanvasChild(el,parent,sc){
  const r=el.getBoundingClientRect();
  const pr=parent.getBoundingClientRect();
  const cs=getComputedStyle(parent);
  const borderL=parseFloat(cs.borderLeftWidth)||0;
  const borderT=parseFloat(cs.borderTopWidth)||0;
  return {
    x:((r.left-pr.left)/sc)-borderL,
    y:((r.top-pr.top)/sc)-borderT,
    w:r.width/sc,
    h:r.height/sc
  };
}

function _materializeScopeToCanvas(scope){
  if(!_isMaterializeScope(scope))return;
  const sc=_editorCanvasScale();
  const children=[...scope.children].filter(_isMaterializeChild);
  if(!children.length)return;
  if(!scope.classList.contains('slide')){
    const r=scope.getBoundingClientRect();
    scope.style.setProperty('width',Math.max(1,Math.ceil(r.width/sc))+'px','important');
    scope.style.setProperty('height',Math.max(1,Math.ceil(r.height/sc))+'px','important');
    if(getComputedStyle(scope).position==='static')scope.style.position='relative';
  }
  const boxes=children.map(el=>({el,box:_boxForCanvasChild(el,scope,sc)}));
  boxes.forEach(({el,box})=>{
    el.style.position='absolute';
    el.style.left=(Math.round(box.x*100)/100)+'px';
    el.style.top=(Math.round(box.y*100)/100)+'px';
    el.style.margin='0';
    el.style.transform='none';
    el.style.setProperty('width',Math.max(1,Math.ceil(box.w))+'px','important');
    el.style.setProperty('max-width','none','important');
  });
  boxes.forEach(({el})=>{
    if(_isMaterializeScope(el))_materializeScopeToCanvas(el);
  });
  scope.setAttribute('data-ed-canvas','1');
}

function materializeSlideCanvas(slide){
  const s=slide||curSlide&&curSlide();
  if(!s)return;
  _materializeScopeToCanvas(s);
}

function materializeForBlocks(blocks){
  const list=[...new Set((blocks||[]).filter(Boolean))];
  const slides=[...new Set(list.map(el=>el.closest&&el.closest('.slide')).filter(Boolean))];
  if(!slides.length){
    const s=curSlide&&curSlide();
    if(s)slides.push(s);
  }
  slides.forEach(materializeSlideCanvas);
}

function _deleteShouldPreserveScope(parent){
  if(!parent||!parent.matches)return false;
  if(parent.matches('.ed-group[data-layout]'))return false;
  return parent.classList.contains('slide') || parent.classList.contains('ed-group');
}

function _deletePreserveScopeFor(el){
  let p=el&&el.parentElement;
  while(p){
    if(_deleteShouldPreserveScope(p))return p;
    p=p.parentElement;
  }
  return null;
}

function _isDeletingNode(el,deleteTargets){
  return deleteTargets.some(d=>d===el || (d.contains&&d.contains(el)));
}

function _captureDeleteFlowPositions(deleteTargets){
  deleteTargets=[...new Set((deleteTargets||[]).filter(el=>el&&el.isConnected))];
  if(!deleteTargets.length)return [];
  const scopes=[...new Set(deleteTargets.map(el=>el.parentElement).filter(_deleteShouldPreserveScope))];
  const records=[];
  const seen=new Set();
  scopes.forEach(parent=>{
    [...parent.children].forEach(child=>{
      if(!child||child.matches&&child.matches(BLOCK.ARTIFACT_SEL))return;
      if(_isDeletingNode(child,deleteTargets))return;
      if(!isBlock(child))return;
      if(seen.has(child))return;
      seen.add(child);
      const r=child.getBoundingClientRect();
      records.push({el:child,left:r.left,top:r.top});
    });
  });
  return records;
}

function _restoreDeleteFlowPositions(records){
  if(!records||!records.length)return;
  const sc=(window.pAPI&&pAPI.deckScale)||1;
  records.forEach(rec=>{
    const el=rec.el;
    if(!el||!el.isConnected||!el.getBoundingClientRect)return;
    const r=el.getBoundingClientRect();
    const dx=(rec.left-r.left)/sc;
    const dy=(rec.top-r.top)/sc;
    if(Math.abs(dx)<0.5&&Math.abs(dy)<0.5)return;
    if(!el.classList.contains('ed-media-wrap')&&getComputedStyle(el).position==='static'){
      el.style.position='relative';
    }
    const curL=parseFloat(el.style.left)||0;
    const curT=parseFloat(el.style.top)||0;
    el.style.left=(Math.round((curL+dx)*100)/100)+'px';
    el.style.top=(Math.round((curT+dy)*100)/100)+'px';
  });
}

function _boxWithinPositionedParent(el,parent,sc){
  const r=el.getBoundingClientRect();
  const pr=parent.getBoundingClientRect();
  const cs=getComputedStyle(parent);
  const borderL=parseFloat(cs.borderLeftWidth)||0;
  const borderT=parseFloat(cs.borderTopWidth)||0;
  return {
    x:((r.left-pr.left)/sc)-borderL,
    y:((r.top-pr.top)/sc)-borderT,
    w:r.width/sc,
    h:r.height/sc
  };
}

function _freezeDeleteFlowSiblings(deleteTargets){
  deleteTargets=[...new Set((deleteTargets||[]).filter(el=>el&&el.isConnected))];
  if(!deleteTargets.length)return;
  const sc=(window.pAPI&&pAPI.deckScale)||1;
  const scopes=[...new Set(deleteTargets.map(_deletePreserveScopeFor).filter(Boolean))];
  const frozen=[];
  scopes.forEach(parent=>{
    [...parent.children].forEach(child=>{
      if(!child||child.matches&&child.matches(BLOCK.ARTIFACT_SEL))return;
      if(_isDeletingNode(child,deleteTargets))return;
      if(!isBlock(child))return;
      if(child.classList&&child.classList.contains('ed-media-wrap'))return;
      frozen.push({el:child,box:_boxWithinPositionedParent(child,parent,sc)});
    });
  });
  frozen.forEach(({el,box})=>{
    el.style.position='absolute';
    el.style.left=(Math.round(box.x*100)/100)+'px';
    el.style.top=(Math.round(box.y*100)/100)+'px';
    el.style.margin='0';
    el.style.transform='none';
    el.style.setProperty('width',Math.max(1,Math.ceil(box.w))+'px','important');
    el.style.setProperty('max-width','none','important');
  });
}

function _removeBlocksPreservingFlow(els){
  const targets=[...new Set((els||[]).filter(el=>el&&el.isConnected))];
  materializeForBlocks(targets);
  targets.forEach(el=>{
    if(!el.isConnected)return;
    el.querySelectorAll(BLOCK.ARTIFACT_SEL).forEach(a=>a.remove());
    el.remove();
  });
  if(typeof syncSelectionOverlay==='function')syncSelectionOverlay();
}

/* 블럭 삭제 — 찌꺼기 없이.
   v2.1: Component 마스터 삭제 시 인스턴스 함께 삭제 가드 (async). */
async function deleteBlockClean(el){
  if(!el)return;
  /* Component 가드 — 마스터면 인스턴스 동반 삭제 확인 */
  if(el.classList&&el.classList.contains('ed-component')){
    const id=el.getAttribute('data-component-id');
    if(id&&typeof deck!=='undefined'&&deck){
      const instances=deck.querySelectorAll('.ed-instance[data-instance-of="'+CSS.escape(id)+'"]');
      if(instances.length>0){
        const ok=(typeof confirmDlg==='function')
          ? await confirmDlg('이 컴포넌트의 인스턴스 '+instances.length+'개도 함께 삭제됩니다.\n계속할까요?')
          : confirm('인스턴스 '+instances.length+'개도 함께 삭제됩니다. 계속?');
        if(!ok)return;
        instances.forEach(inst=>{
          inst.querySelectorAll(BLOCK.ARTIFACT_SEL).forEach(a=>a.remove());
          inst.remove();
        });
      }
    }
  }
  push();
  _removeBlocksPreservingFlow([el]);
  selBlock=null;editingBlock=null;selBlocks=[];
  if(typeof _setSel==='function')_setSel(null);
  if(typeof attachHandles==='function')attachHandles();
  hideBar&&hideBar();
  _setDirty&&_setDirty(true);
  msg('블럭 삭제');
}

/* ============================================================
   BLOCK SYSTEM v2.1 — Group / Auto-Layout / Component / Constraints
   설계 문서: engine/BLOCK_SYSTEM_v2.1_GROUP_LAYOUT.md
   상태는 모두 DOM data-attribute. JS 전역 미러 없음 (undo가 deck 스냅샷이라 자동).
   ============================================================ */
function _sortByDomOrder(els){
  return [...els].sort((a,b)=>{
    if(a===b)return 0;
    const pos=a.compareDocumentPosition(b);
    if(pos&Node.DOCUMENT_POSITION_FOLLOWING)return -1;
    if(pos&Node.DOCUMENT_POSITION_PRECEDING)return 1;
    return 0;
  });
}
function _stripAbsoluteCoords(el){
  if(!el||!el.style)return;
  el.style.left='';el.style.top='';el.style.position='';el.style.transform='';
}
function _makeGroupElement(opts){
  const wrap=document.createElement('div');
  if(opts.mode==='frame')wrap.className='ed-group ed-group-frame';
  else                   wrap.className='card ed-group';
  wrap.setAttribute('data-group-mode',opts.mode||'card');
  return wrap;
}
function _maxChildStep(els){
  let m=0;
  els.forEach(e=>{const v=parseInt(e.getAttribute('data-step')||'0',10);if(!isNaN(v)&&v>m)m=v;});
  return m;
}

/* 핵심: 멀티셀렉트 wrap — Card / Frame, Auto-Layout, autoSeq 옵션 통합 */
function wrapBlocks(els,opts){
  if(!els||!els.length)return null;
  opts=Object.assign({mode:'card',layout:null,autoSeq:true,padding:16,gap:12,align:null},opts||{});
  push();
  els=_sortByDomOrder(els);
  const first=els[0];
  if(!first||!first.parentElement)return null;
  const wrap=_makeGroupElement(opts);
  /* data-step: autoSeq면 자식 최솟값 (부모가 첫 번째로 등장), 아니면 자식 최댓값+1 */
  const childMaxStep=_maxChildStep(els);
  if(opts.autoSeq){
    let minStep=Infinity;
    els.forEach(e=>{const v=parseInt(e.getAttribute('data-step')||'0',10);if(!isNaN(v)&&v>0&&v<minStep)minStep=v;});
    if(minStep===Infinity)minStep=parseInt(first.getAttribute('data-step')||'1',10);
    wrap.setAttribute('data-step',String(minStep));
  }else{
    wrap.setAttribute('data-step',String(childMaxStep+1||1));
  }
  if(opts.autoSeq&&els.length>=2){
    wrap.setAttribute('data-anim-children','seq');
  }
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
    if(opts.align)wrap.setAttribute('data-align',opts.align);
  }
  first.parentElement.insertBefore(wrap,first);
  els.forEach(e=>{
    if(opts.layout==='v'||opts.layout==='h')_stripAbsoluteCoords(e);
    wrap.appendChild(e);
  });
  attachHandles&&attachHandles();
  on&&on();
  setBlockState(wrap,'select');
  showBar&&showBar(wrap);
  if(window.pAPI&&window.pAPI.reinit)window.pAPI.reinit();
  msg('Wrap: '+(opts.mode||'card')+(opts.layout?(' '+opts.layout):''));
  _setDirty&&_setDirty(true);
  return wrap;
}

/* 풀기 — data-step-auto 잔재 정리 포함 */
function unwrapBlock(el){
  if(!el)return;
  if(isLeafBlock(el)){msg('풀 내용이 없음');return;}
  push();
  const parent=el.parentElement;
  const kids=[...el.children].filter(c=>!c.matches(BLOCK.ARTIFACT_SEL));
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
function groupBlocksWrap(els){return wrapBlocks(els,{mode:'card',layout:'v',autoSeq:true,gap:12,padding:16});}
function ungroupBlockUnwrap(el){return unwrapBlock(el);}

/* ── Auto-Layout 속성 setters — attribute + CSS variable 갱신 ── */
function setLayoutDirection(el,dir){
  if(!el)return;push();
  if(dir==='v'||dir==='h')el.setAttribute('data-layout',dir);
  else el.removeAttribute('data-layout');
  _setDirty&&_setDirty(true);
}
function setLayoutGap(el,px){
  if(!el)return;push();
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
  if(!el)return;push();
  const T=t==null||t===''?null:parseInt(t,10)|0;
  const R=r==null||r===''?null:parseInt(r,10)|0;
  const B=b==null||b===''?null:parseInt(b,10)|0;
  const L=l==null||l===''?null:parseInt(l,10)|0;
  if(T!=null&&T===R&&R===B&&B===L){
    el.setAttribute('data-pad',String(T));
    ['t','r','b','l'].forEach(k=>el.removeAttribute('data-pad-'+k));
  }else{
    el.removeAttribute('data-pad');
    [['t',T],['r',R],['b',B],['l',L]].forEach(p=>{
      if(p[1]==null)el.removeAttribute('data-pad-'+p[0]);
      else el.setAttribute('data-pad-'+p[0],String(p[1]));
    });
  }
  el.style.setProperty('--ed-pad-t',((T==null?0:T))+'px');
  el.style.setProperty('--ed-pad-r',((R==null?0:R))+'px');
  el.style.setProperty('--ed-pad-b',((B==null?0:B))+'px');
  el.style.setProperty('--ed-pad-l',((L==null?0:L))+'px');
  _setDirty&&_setDirty(true);
}
function setLayoutAlign(el,align){
  if(!el)return;push();
  if(align)el.setAttribute('data-align',align);
  else el.removeAttribute('data-align');
  _setDirty&&_setDirty(true);
}

/* ── Component / Instance ── */
function makeComponent(el){
  if(!el)return null;push();
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
  if(!id||typeof deck==='undefined'||!deck)return;
  const master=deck.querySelector('.ed-component[data-component-id="'+CSS.escape(id)+'"]');
  if(!master)return;
  const instances=deck.querySelectorAll('.ed-instance[data-instance-of="'+CSS.escape(id)+'"]');
  instances.forEach(inst=>{
    const savedPos={left:inst.style.left,top:inst.style.top,width:inst.style.width,height:inst.style.height};
    const savedClasses=inst.className;
    const savedInstanceOf=inst.getAttribute('data-instance-of');
    inst.innerHTML=master.innerHTML;
    Object.assign(inst.style,savedPos);
    inst.className=savedClasses;
    if(savedInstanceOf)inst.setAttribute('data-instance-of',savedInstanceOf);
  });
}
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
  if(typeof deck==='undefined'||!deck||window._cmpObserver)return;
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
  window._cmpObserver.observe(deck,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style','class','data-step','data-sort']});
}

/* ── Constraints (P2 — attribute만, ResizeObserver 적용은 후속) ── */
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
   블럭 이동 (직접 드래그 / Space + 드래그)
   ──────────────────────────────── */

/* 선택된 블럭(들)을 dx, dy 만큼 이동. 다중 선택 시 함께 이동 (C1) */
function nudgeBlocks(dx,dy){
  const blocks = selBlocks.length ? selBlocks : (selBlock?[selBlock]:[]);
  if(!blocks.length)return;
  push();
  materializeForBlocks(blocks);
  blocks.forEach(b=>{
    const oL=parseFloat(b.style.left)||0, oT=parseFloat(b.style.top)||0;
    b.style.left=(oL+dx)+'px';
    b.style.top=(oT+dy)+'px';
  });
  if(window.pAPI&&window.pAPI.reinit)window.pAPI.reinit();
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
  if(window.pAPI&&window.pAPI.reinit)window.pAPI.reinit();
  _setDirty&&_setDirty(true);
  msg('원 위치 복귀');
  if(typeof syncSelectionOverlay==='function')syncSelectionOverlay();
}

function _blockBoxInSlide(el,slide,sc){
  const r=el.getBoundingClientRect(), sr=slide.getBoundingClientRect();
  return {
    x:(r.left-sr.left)/sc,
    y:(r.top-sr.top)/sc,
    w:r.width/sc,
    h:r.height/sc
  };
}
function _snapIsTextEl(el){
  return !!(el&&el.matches&&el.matches(BLOCK.TEXT_TAGS_SEL));
}
function _snapTextBoxInSlide(el,slide,sc){
  if(!_snapIsTextEl(el)||!el.textContent||!el.textContent.trim())return null;
  let range=null;
  try{
    range=document.createRange();
    range.selectNodeContents(el);
    const sr=slide.getBoundingClientRect();
    const rects=[...range.getClientRects()].filter(r=>r&&r.width>0&&r.height>0);
    if(!rects.length)return null;
    const l=Math.min(...rects.map(r=>r.left));
    const t=Math.min(...rects.map(r=>r.top));
    const r=Math.max(...rects.map(r=>r.right));
    const b=Math.max(...rects.map(r=>r.bottom));
    return {
      x:(l-sr.left)/sc,
      y:(t-sr.top)/sc,
      w:(r-l)/sc,
      h:(b-t)/sc
    };
  }catch(e){
    return null;
  }finally{
    if(range)range.detach&&range.detach();
  }
}
function _snapBoxesForEl(el,slide,sc,includeText){
  const boxes=[];
  const blockBox=_blockBoxInSlide(el,slide,sc);
  if(blockBox&&isFinite(blockBox.x)&&isFinite(blockBox.y)&&blockBox.w>0&&blockBox.h>0)boxes.push(blockBox);
  if(includeText){
    const textBox=_snapTextBoxInSlide(el,slide,sc);
    if(textBox&&isFinite(textBox.x)&&isFinite(textBox.y)&&textBox.w>0&&textBox.h>0)boxes.push(textBox);
  }
  return boxes;
}

function _applyAbsoluteBlockBox(el,box){
  el.style.position='absolute';
  el.style.left=Math.round(box.x)+'px';
  el.style.top=Math.round(box.y)+'px';
  el.style.margin='0';
  if(!el.classList.contains('ed-media-wrap')){
    el.style.setProperty('width',Math.max(1,Math.ceil(box.w)+24)+'px','important');
    el.style.setProperty('max-width','none','important');
  }
  if(el.classList.contains('ed-media-wrap')&&el.style.transform==='translate(-50%, -50%)'){
    el.style.transform='none';
  }
}

function placeDuplicateBlockAtSource(source,clone,offsetX,offsetY){
  const slide=source.closest('.slide')||curSlide();
  if(!slide||!clone)return null;
  const sc=pAPI.deckScale||1;
  const box=_blockBoxInSlide(source,slide,sc);
  box.x+=(offsetX||0);
  box.y+=(offsetY||0);
  _applyAbsoluteBlockBox(clone,box);
  slide.appendChild(clone);
  return {slide,box};
}

function _prepareBlockForMove(b,sc){
  if(!b)return {el:b,oL:0,oT:0};
  if(!b.classList.contains('ed-media-wrap')){
    const pos=getComputedStyle(b).position;
    if(pos!=='absolute')b.style.position='relative';
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
}

/* 복제본은 component/instance/runtime 상태를 절대 이어받지 않는다. */
function cloneBlockForDuplicate(source){
  if(!source)return null;
  const c=source.cloneNode(true);
  const clean=[c,...c.querySelectorAll('*')];
  clean.forEach(el=>{
    el.classList&&el.classList.remove(
      'ed-selected','ed-selected-block','ed-editing-block','ed-dragging','ed-resizing',
      'ed-component','ed-instance'
    );
    el.removeAttribute&&el.removeAttribute('contenteditable');
    el.removeAttribute&&el.removeAttribute('data-component-id');
    el.removeAttribute&&el.removeAttribute('data-instance-of');
    if(el.attributes){
      [...el.attributes].forEach(a=>{
        if(/^data-runtime/i.test(a.name))el.removeAttribute(a.name);
      });
    }
  });
  c.querySelectorAll(BLOCK.ARTIFACT_SEL).forEach(a=>a.remove());
  return c;
}

/* Shared snapping and move/duplicate drag behavior */
/* ============================================================
   SNAP ENGINE -- shared object smart guides for all move drags
   ============================================================ */
function snapEnd(){
  if(typeof snapH!=='undefined'&&snapH)snapH.style.display='none';
  if(typeof snapV!=='undefined'&&snapV)snapV.style.display='none';
}
function _snapUnionBox(boxes){
  const valid=(boxes||[]).filter(b=>b&&isFinite(b.x)&&isFinite(b.y)&&isFinite(b.w)&&isFinite(b.h));
  if(!valid.length)return null;
  const l=Math.min(...valid.map(b=>b.x));
  const t=Math.min(...valid.map(b=>b.y));
  const r=Math.max(...valid.map(b=>b.x+b.w));
  const b=Math.max(...valid.map(b=>b.y+b.h));
  return {x:l,y:t,w:r-l,h:b-t};
}
function _snapLinesForBox(box){
  return {
    x:[box.x,box.x+box.w/2,box.x+box.w],
    y:[box.y,box.y+box.h/2,box.y+box.h]
  };
}
function _snapIsRelated(candidate,moving){
  return moving.some(el=>el&&(
    el===candidate ||
    (el.contains&&el.contains(candidate)) ||
    (candidate.contains&&candidate.contains(el))
  ));
}
function _snapScopeFor(slide,movingEls){
  const parents=[...new Set((movingEls||[]).map(el=>el&&el.parentElement).filter(Boolean))];
  if(parents.length===1&&parents[0]!==slide&&slide.contains(parents[0]))return parents[0];
  return slide;
}
function _snapCandidateEls(root,movingEls,includeText){
  const moving=[...new Set((movingEls||[]).filter(Boolean))];
  const selector=includeText ? BLOCK.TARGET_SEL+', '+BLOCK.TEXT_TAGS_SEL : BLOCK.TARGET_SEL;
  return [...root.querySelectorAll(selector)].filter(el=>{
    if(!el||_snapIsRelated(el,moving))return false;
    if(el.closest&&el.closest('.speaker-notes'))return false;
    if(el.matches&&el.matches(BLOCK.ARTIFACT_SEL))return false;
    if(el.closest&&el.closest(BLOCK.ARTIFACT_SEL))return false;
    if(typeof isBlock==='function'&&!isBlock(el))return false;
    const r=el.getBoundingClientRect();
    return r.width>0&&r.height>0;
  });
}
function _snapBest(movingLines,targetLines){
  let best=null;
  movingLines.forEach(m=>{
    targetLines.forEach(line=>{
      const delta=line-m;
      const dist=Math.abs(delta);
      if(dist<=CFG.SNAP_PX&&(!best||dist<best.dist)){
        best={delta,line,dist};
      }
    });
    });
  return best;
}
function _snapLinesForBoxes(boxes){
  const lines={x:[],y:[]};
  (boxes||[]).forEach(b=>{
    const l=_snapLinesForBox(b);
    lines.x.push(...l.x);
    lines.y.push(...l.y);
  });
  return lines;
}
function _snapOffsetBoxes(boxes,dx,dy){
  return (boxes||[]).map(b=>({x:b.x+dx,y:b.y+dy,w:b.w,h:b.h}));
}
function _snapAxis(movingLines,objectLines,canvasLine){
  const objectBest=_snapBest(movingLines,objectLines);
  if(objectBest)return objectBest;
  if(isFinite(canvasLine)){
    const canvasBest=_snapBest(movingLines,[canvasLine]);
    if(canvasBest)return canvasBest;
  }
  return null;
}
function _axisLockState(e){
  return {
    active:false,
    axis:null,
    initialShift:!!(e&&e.shiftKey),
    shiftReleased:!(e&&e.shiftKey),
    lockDx:0,
    lockDy:0
  };
}
function _axisLockApply(dx,dy,ev,state){
  if(!state||!ev||!ev.shiftKey){
    if(state){
      state.active=false;
      state.axis=null;
      state.shiftReleased=true;
    }
    return {dx,dy,axis:null};
  }
  if(!state.active){
    state.active=true;
    state.axis=Math.abs(dx)>=Math.abs(dy)?'x':'y';
    const fromDragStart=state.initialShift&&!state.shiftReleased;
    state.lockDx=fromDragStart?0:dx;
    state.lockDy=fromDragStart?0:dy;
  }
  if(state.axis==='x')dy=state.lockDy;
  else if(state.axis==='y')dx=state.lockDx;
  return {dx,dy,axis:state.axis};
}
function _snapGuideMetrics(){
  if(typeof guide==='undefined'||!guide)return null;
  return {
    left:parseFloat(guide.style.left)||0,
    top:parseFloat(guide.style.top)||0,
    width:parseFloat(guide.style.width)||CFG.CANVAS_W,
    height:parseFloat(guide.style.height)||CFG.CANVAS_H
  };
}
function _snapVisualX(x){
  if(typeof snapV!=='undefined'&&snapV&&snapV.parentElement===deck)return x;
  const g=_snapGuideMetrics();
  return g ? g.left + x * (g.width / CFG.CANVAS_W) : x;
}
function _snapVisualY(y){
  if(typeof snapH!=='undefined'&&snapH&&snapH.parentElement===deck)return y;
  const g=_snapGuideMetrics();
  return g ? g.top + y * (g.height / CFG.CANVAS_H) : y;
}
function _showSnapV(x){
  if(typeof snapV==='undefined'||!snapV)return;
  const g=_snapGuideMetrics();
  snapV.style.left=Math.round(_snapVisualX(x))+'px';
  if(snapV.parentElement!==deck&&g){
    snapV.style.top=Math.round(g.top)+'px';
    snapV.style.height=Math.round(g.height)+'px';
    snapV.style.bottom='auto';
  }
  snapV.style.display='block';
}
function _showSnapH(y){
  if(typeof snapH==='undefined'||!snapH)return;
  const g=_snapGuideMetrics();
  snapH.style.top=Math.round(_snapVisualY(y))+'px';
  if(snapH.parentElement!==deck&&g){
    snapH.style.left=Math.round(g.left)+'px';
    snapH.style.width=Math.round(g.width)+'px';
    snapH.style.right='auto';
  }
  snapH.style.display='block';
}
function snapBegin(opts){
  const slide=opts&&opts.slide;
  const movingEls=(opts&&opts.movingEls)||[];
  const sc=(window.pAPI&&pAPI.deckScale)||1;
  if(!slide||!movingEls.length)return null;
  const movingBoxes=movingEls.map(el=>_blockBoxInSlide(el,slide,sc));
  const box=_snapUnionBox(movingBoxes);
  if(!box)return null;
  const useTextSnap=movingEls.some(el=>_snapIsTextEl(el));
  const movingSnapBoxes=movingEls.flatMap(el=>_snapBoxesForEl(el,slide,sc,useTextSnap));
  const scope=_snapScopeFor(slide,movingEls);
  let candidateEls=_snapCandidateEls(scope,movingEls,useTextSnap);
  if(!candidateEls.length&&scope!==slide)candidateEls=_snapCandidateEls(slide,movingEls,useTextSnap);
  const candidates=candidateEls
    .flatMap(el=>_snapBoxesForEl(el,slide,sc,useTextSnap))
    .filter(b=>b&&isFinite(b.x)&&isFinite(b.y)&&b.w>0&&b.h>0);
  const objectX=[],objectY=[];
  candidates.forEach(b=>{
    const lines=_snapLinesForBox(b);
    objectX.push(...lines.x);
    objectY.push(...lines.y);
  });
  const gr=(typeof guide!=='undefined'&&guide&&guide._r)?guide._r:null;
  return {
    slide,
    box,
    movingSnapBoxes:movingSnapBoxes.length?movingSnapBoxes:movingBoxes,
    objectX,
    objectY,
    canvasX:gr?gr.x+gr.w/2:NaN,
    canvasY:gr?gr.y+gr.h/2:NaN
  };
}
function snapApply(session,dx,dy,ev,axisLock){
  if(!session||ev&&ev.ctrlKey){
    snapEnd();
    return {dx,dy};
  }
  const lines=_snapLinesForBoxes(_snapOffsetBoxes(session.movingSnapBoxes||[session.box],dx,dy));
  const sx=axisLock==='y'?null:_snapAxis(lines.x,session.objectX,session.canvasX);
  const sy=axisLock==='x'?null:_snapAxis(lines.y,session.objectY,session.canvasY);
  if(sx){
    dx+=sx.delta;
    _showSnapV(sx.line);
  }else if(typeof snapV!=='undefined'&&snapV)snapV.style.display='none';
  if(sy){
    dy+=sy.delta;
    _showSnapH(sy.line);
  }else if(typeof snapH!=='undefined'&&snapH)snapH.style.display='none';
  return {dx,dy};
}

function startMoveDrag(anchorBlock, e, opts){
  if(!anchorBlock)return;
  /* 이동 대상 목록: 다중 선택이면 전부, 아니면 anchorBlock 하나 */
  const targets = selBlocks.length>1 ? [...selBlocks] : [anchorBlock];
  const sc = pAPI.deckScale;
  const sX = e.clientX, sY = e.clientY;
  const axisLock=_axisLockState(e);
  /* 각 블럭의 초기 상태는 실제 드래그가 시작될 때만 만든다.
     단순 클릭에서 position/left/top 같은 DOM 상태가 바뀌면 안 된다. */
  let initial = [], snapSession=null;
  let started=false;
  const start=()=>{
    if(started)return;
    started=true;
    push();
    materializeForBlocks(targets);
    /* media-wrap 이 최초 이동일 때 transform 중앙 정렬을 px 좌표로 변환해야
       oL/oT 가 올바르게 잡혀서 점핑이 사라진다. */
    initial = targets.map(b=>_prepareBlockForMove(b,sc));
    const slide=(anchorBlock.closest&&anchorBlock.closest('.slide'))||curSlide();
    snapSession=snapBegin({slide,movingEls:targets});
    moveInProgress=true;
    suppressNextSelect=true;
    if(typeof startOverlayLoop==='function')startOverlayLoop();
    targets.forEach(b=>b.classList.add('ed-dragging'));
  };

  const mv = ev=>{
    let dx=(ev.clientX-sX)/sc, dy=(ev.clientY-sY)/sc;
    if(!started){
      if(Math.hypot(ev.clientX-sX,ev.clientY-sY)<3)return;
      start();
    }
    const locked=_axisLockApply(dx,dy,ev,axisLock);
    dx=locked.dx;dy=locked.dy;
    const snapped=snapApply(snapSession,dx,dy,ev,locked.axis);
    dx=snapped.dx;dy=snapped.dy;
    initial.forEach(({el,oL,oT})=>{
      el.style.left=(oL+dx)+'px';
      el.style.top=(oT+dy)+'px';
    });
    if(typeof syncSelectionOverlay==='function')syncSelectionOverlay();
  };
  const up = ()=>{
    targets.forEach(b=>b.classList.remove('ed-dragging'));
    document.removeEventListener('mousemove',mv);
    document.removeEventListener('mouseup',up);
    snapEnd(snapSession);
    if(typeof syncSelectionOverlay==='function')syncSelectionOverlay();
    if(started){
      if(window.pAPI&&window.pAPI.reinit)window.pAPI.reinit();
      setTimeout(()=>{moveInProgress=false;suppressNextSelect=false;},10);
      _setDirty&&_setDirty(true);
    }else{
      moveInProgress=false;
    }
  };
  document.addEventListener('mousemove',mv);
  document.addEventListener('mouseup',up);
  if(opts&&opts.initialMoveEvent)mv(opts.initialMoveEvent);
  e.preventDefault();
}

/* Alt + 드래그: 원본은 그대로 두고, 드롭 위치에 단일 복제본 생성 */
function startDuplicateDrag(anchorBlock,e){
  if(!anchorBlock)return;
  const sc=pAPI.deckScale;
  const sX=e.clientX,sY=e.clientY;
  const axisLock=_axisLockState(e);
  let clone=null, initial=null, snapSession=null, started=false;
  const start=()=>{
    if(started)return;
    started=true;
    push();
    materializeForBlocks([anchorBlock]);
    clone=cloneBlockForDuplicate(anchorBlock);
    if(!clone)return;
    const placed=placeDuplicateBlockAtSource(anchorBlock,clone,0,0);
    if(!placed)return;
    initial={el:clone,oL:placed.box.x,oT:placed.box.y};
    snapSession=snapBegin({slide:placed.slide,movingEls:[clone]});
    clone.style.left=initial.oL+'px';
    clone.style.top=initial.oT+'px';
    clone.classList.add('ed-dragging');
    suppressNextSelect=true;
    moveInProgress=true;
    setBlockState(clone,'select');
  };
  const mv=ev=>{
    if(!started){
      if(Math.hypot(ev.clientX-sX,ev.clientY-sY)<3)return;
      start();
    }
    if(!clone||!initial)return;
    let dx=(ev.clientX-sX)/sc,dy=(ev.clientY-sY)/sc;
    const locked=_axisLockApply(dx,dy,ev,axisLock);
    dx=locked.dx;dy=locked.dy;
    const snapped=snapApply(snapSession,dx,dy,ev,locked.axis);
    dx=snapped.dx;dy=snapped.dy;
    clone.style.left=(initial.oL+dx)+'px';
    clone.style.top=(initial.oT+dy)+'px';
    if(typeof syncSelectionOverlay==='function')syncSelectionOverlay();
  };
  const up=()=>{
    document.removeEventListener('mousemove',mv);
    document.removeEventListener('mouseup',up);
    snapEnd(snapSession);
    if(clone)clone.classList.remove('ed-dragging');
    if(started){
      attachHandles&&attachHandles();on&&on();
      if(window.pAPI&&window.pAPI.reinit)window.pAPI.reinit();
      setBlockState(clone,'select');showBar&&showBar(clone);
      _setDirty&&_setDirty(true);
      msg('복제');
      setTimeout(()=>{moveInProgress=false;suppressNextSelect=false;},10);
    }else{
      moveInProgress=false;
    }
  };
  document.addEventListener('mousemove',mv);
  document.addEventListener('mouseup',up);
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
    it.el.setAttribute('data-sort',String(step));
    it.el.removeAttribute('data-step-auto');
    prevY=it.y;
  }
  /* pAPI 재초기화로 reveal 반영 */
  if(window.pAPI&&pAPI.reinit){pAPI.reinit();}
  msg('✔ data-step 재배정 완료 (총 '+step+'단계)');
}
function _mediaDisplaySize(w,h){
  w=+w||0;h=+h||0;
  const max=(typeof CFG==='object'&&CFG.MEDIA_MAX_DISPLAY)||2048;
  if(!w||!h)return {w:w||0,h:h||0,scale:1};
  const scale=Math.min(1,max/Math.max(w,h));
  return {w:Math.round(w*scale),h:Math.round(h*scale),scale:Math.round(scale*1000)/1000};
}
function _applyIntrinsicMediaSize(m,w,h){
  const wrap=m.closest&&m.closest('.ed-media-wrap');
  if(!wrap||!w||!h)return;
  const disp=_mediaDisplaySize(w,h);
  if(!m.style.width)m.style.width=disp.w+'px';
  wrap.setAttribute('data-original-w',String(w));
  wrap.setAttribute('data-original-h',String(h));
  if(!wrap.getAttribute('data-crop-base-w')){
    wrap.setAttribute('data-crop-base-w',String(w));
    wrap.setAttribute('data-crop-base-h',String(h));
    if(disp.scale<1)wrap.setAttribute('data-crop-scale',String(disp.scale));
    if(typeof _cropApply==='function')_cropApply(wrap);
  }
}
function mkImg(src){
  const i=document.createElement('img');
  i.src=src;
  i.style.cssText='height:auto;border-radius:'+CFG.MEDIA_RADIUS+';display:block;max-width:none';
  i.draggable=false;
  i.addEventListener('load',()=>{
    _applyIntrinsicMediaSize(i,i.naturalWidth||i.offsetWidth||0,i.naturalHeight||i.offsetHeight||0);
  },{once:true});
  return i;
}
function mkVid(src){
  const v=document.createElement('video');
  v.src=src;v.controls=true;v.muted=true;v.setAttribute('muted','');
  /* autoplay 기본 OFF — step 시스템이 제어. 필요시 에디터에서 수동 ON */
  v.style.cssText='border-radius:'+CFG.MEDIA_RADIUS+';display:block;max-width:none';
  v.addEventListener('loadedmetadata',()=>{
    _applyIntrinsicMediaSize(v,v.videoWidth||v.offsetWidth||0,v.videoHeight||v.offsetHeight||0);
  },{once:true});
  return v;
}

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

function _unwrapAnimElement(el){
  if(!el||!el.parentNode)return;
  _unwrapChars(el);
  delete el.dataset.anim;
  if(el.tagName==='SPAN'){
    const frag=document.createDocumentFragment();
    while(el.firstChild)frag.appendChild(el.firstChild);
    el.replaceWith(frag);
  }
}

function resetAnim(){
  const s=window.getSelection();
  if(s&&s.rangeCount>0){
    const node=s.getRangeAt(0).commonAncestorContainer;
    const wrapper=node.nodeType===Node.ELEMENT_NODE
      ?node.closest('[data-anim]')
      :(node.parentElement&&node.parentElement.closest('[data-anim]'));
    if(wrapper){push();_unwrapAnimElement(wrapper);msg('애니메이션 원본 복구');return;}
  }
  const target=sel||selBlock;
  if(!target)return msg('요소를 선택하세요');
  push();
  _unwrapChars(target);
  delete target.dataset.anim;
  target.querySelectorAll('[data-anim]').forEach(el=>_unwrapAnimElement(el));
  msg('애니메이션 원본 복구');
}

/* Re-apply char wrapping after undo/restore so live animations continue */
function _reapplyAnimChars(root){
  (root||document).querySelectorAll('[data-anim]').forEach(el=>{
    /* Only wrap if not already wrapped (check for existing .ed-anim-char) */
    if(!el.querySelector('.ed-anim-char'))_wrapChars(el);
  });
}

/* <<< end 2647-2745 <<< */
