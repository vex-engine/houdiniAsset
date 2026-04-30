/* ================================================================
   DECK HASH — cache invalidation utility (shared by both engines)
   ================================================================ */
(()=>{
'use strict';
function djb2(str){let h=5381;for(let i=0;i<str.length;i++)h=((h<<5)+h+str.charCodeAt(i))>>>0;return h.toString(36)}
function computeDeckHash(){
  const deck=document.querySelector('.slide-deck');
  return deck?djb2(deck.innerHTML):'';
}
function stampDeckHash(hash){
  const m=document.querySelector('meta[name="deck-hash"]');
  if(m)m.setAttribute('content',hash||computeDeckHash());
}
function readDeckHash(){
  const m=document.querySelector('meta[name="deck-hash"]');
  return m?m.getAttribute('content'):'';
}
window._deckHash={compute:computeDeckHash,stamp:stampDeckHash,read:readDeckHash};
stampDeckHash();
})();

/* ================================================================
   PRESENTATION ENGINE
   ================================================================ */
(()=>{
'use strict';
const CFG={TRANSITION_MS:600,TOUCH_TIMEOUT:300,TOUCH_MIN_PX:50};
let slides,totalSlides;
const PF=document.querySelector('.progress-fill'),CN=document.querySelector('.current-num'),TN=document.querySelector('.total-num'),CF=document.querySelector('.slide-frame');
const S={cur:0,step:0,busy:false,info:[]};

const DECK=document.querySelector('.slide-deck');
const CW=1920,CH=1080;/* canvas size — must match CSS --canvas-w/h and editor CFG */
/* ============================================================
   AUTO-STEP — 슬라이드 단위 시각 순서 DFS 단일 패스 (인터리브 방지)
   기존 data-step 생성 순서가 아니라 실제 화면 위치(top → left)를 기준으로
   다시 번호를 매긴다. data-step-lock="1"만 명시적 고정값으로 인정한다.
   ============================================================ */
const STEP_ARTIFACT_SEL='.ed-drag-handle,.ed-block-resize,.ed-block-resize-w,.ed-block-resize-e,.ed-media-del,.ed-resize-handle,.ed-crop-handle,.ed-crosshair-h,.ed-crosshair-v,.ed-grid,.ed-snap-h,.ed-snap-v,.ed-guide-169';
const STEP_DIRECT_BLOCK_SEL='h1,h2,h3,h4,h5,h6,p,ul,ol,table,blockquote,pre,.ed-media-wrap,.card,.principle-card,.joka-cell,.joka-flow,.num-item,.flow-step,.usecase-box,.demo-desc,.demo-url,.demo-qr-col,.qna-big,.qna-thanks';
const STEP_ORDER_TOL=20;
function visualChildren(parent,slide){
  const s=slide||parent.closest&&parent.closest('.slide')||parent;
  const sr=s.getBoundingClientRect();
  return Array.from(parent.children)
    .filter(child=>!(child.matches&&child.matches(STEP_ARTIFACT_SEL)))
    .map((el,i)=>{
      const r=el.getBoundingClientRect();
      return {el,i,top:r.top-sr.top,left:r.left-sr.left};
    })
    .sort((a,b)=>{
      const dy=a.top-b.top;
      if(Math.abs(dy)>STEP_ORDER_TOL)return dy;
      const dx=a.left-b.left;
      if(Math.abs(dx)>STEP_ORDER_TOL)return dx;
      return a.i-b.i;
    })
    .map(item=>item.el);
}
function applyAutoSteps(slide){
  function isStepTarget(el, parentIsSeq){
    if(parentIsSeq) return true;
    if(el.hasAttribute('data-step') || el.hasAttribute('data-sort') || el.hasAttribute('data-anim-children')) return true;
    return el.parentElement===slide && el.matches&&el.matches(STEP_DIRECT_BLOCK_SEL);
  }
  const records=[];
  function walk(el, parentIsSeq){
    visualChildren(el,slide).forEach(child=>{
      const isTarget=isStepTarget(child, parentIsSeq);
      const isSeqContainer=child.getAttribute('data-anim-children')==='seq';
      if(isTarget){
        records.push({el:child,parentIsSeq});
      }
      walk(child, isSeqContainer);
    });
  }
  walk(slide, false);
  let maxStep=0;
  records.forEach(r=>{
    const child=r.el;
    const sort=Number(child.getAttribute('data-sort'));
    if(Number.isFinite(sort)&&sort>0){
      child.setAttribute('data-step',String(sort));
      child.removeAttribute('data-step-auto');
      maxStep=Math.max(maxStep,sort);
      return;
    }
    const step=Number(child.getAttribute('data-step'));
    if(Number.isFinite(step)&&step>0){
      maxStep=Math.max(maxStep,step);
      return;
    }
    maxStep++;
    child.setAttribute('data-step',String(maxStep));
    child.setAttribute('data-step-auto','1');
  });
}
function init(){
  slides=Array.from(document.querySelectorAll('.slide'));
  totalSlides=slides.length;
  TN.textContent=totalSlides;
  slides.forEach(applyAutoSteps);
  S.info=slides.map(s=>{let m=0;s.querySelectorAll('[data-step]').forEach(e=>{const v=+e.dataset.step;if(v>m)m=v});return{max:m}});
}
init();
/* Scale the fixed canvas to fit inside the slide-frame.
   Edit mode can layer a view-only zoom/pan on top of the fitted scale. */
let _fitScale=1,_deckScale=1;
let _editZoom=1,_editPanX=0,_editPanY=0;
const EDIT_VIEW_MIN_ZOOM=.25,EDIT_VIEW_MAX_ZOOM=6,EDIT_VIEW_EDGE=80;
function _clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function _clampEditPan(){
  const fw=CF.clientWidth,fh=CF.clientHeight;
  const maxX=Math.max(0,(CW*_deckScale+fw)/2-EDIT_VIEW_EDGE);
  const maxY=Math.max(0,(CH*_deckScale+fh)/2-EDIT_VIEW_EDGE);
  _editPanX=_clamp(_editPanX,-maxX,maxX);
  _editPanY=_clamp(_editPanY,-maxY,maxY);
}
function _setDeckTransform(){
  if(isEd()){
    _clampEditPan();
    DECK.style.transform='translate('+_editPanX+'px,'+_editPanY+'px) scale('+_deckScale+')';
  }else{
    DECK.style.transform='scale('+_deckScale+')';
  }
}
function updateScale(){
  const fw=CF.clientWidth,fh=CF.clientHeight;
  _fitScale=Math.min(fw/CW,fh/CH);
  _deckScale=_fitScale*(isEd()?_editZoom:1);
  _setDeckTransform();
}
function zoomEditViewAt(clientX,clientY,factor){
  if(!isEd())return _deckScale;
  const oldZoom=_editZoom;
  const nextZoom=_clamp(oldZoom*factor,EDIT_VIEW_MIN_ZOOM,EDIT_VIEW_MAX_ZOOM);
  if(Math.abs(nextZoom-oldZoom)<.0001)return _deckScale;
  const oldScale=_deckScale||(_fitScale*oldZoom)||1;
  const nextScale=_fitScale*nextZoom;
  const rect=DECK.getBoundingClientRect();
  const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  const k=nextScale/oldScale;
  _editPanX+=(clientX-cx)*(1-k);
  _editPanY+=(clientY-cy)*(1-k);
  _editZoom=nextZoom;
  updateScale();
  return _deckScale;
}
function panEditViewBy(dx,dy){
  if(!isEd())return;
  _editPanX+=dx;
  _editPanY+=dy;
  updateScale();
}
function resetEditView(){
  _editZoom=1;_editPanX=0;_editPanY=0;
  updateScale();
}
updateScale();
window.addEventListener('resize',updateScale);
function render(){slides.forEach((s,i)=>{s.classList.toggle('active',i===S.cur);s.classList.remove('exit-left','exit-right');s.setAttribute('aria-hidden',i!==S.cur)});reveal();ctrl()}
function reveal(){const s=slides[S.cur];if(!s)return;s.querySelectorAll('[data-step]').forEach(e=>e.classList.toggle('visible',+e.dataset.step<=S.step))}
function ctrl(){PF.style.width=(totalSlides>1?(S.cur/(totalSlides-1))*100:100)+'%';CN.textContent=S.cur+1;TN.textContent=totalSlides}
function prepSlideStep(slide,step){
  if(!slide)return;
  slide.classList.add('step-prep');
  slide.querySelectorAll('[data-step]').forEach(e=>e.classList.toggle('visible',+e.dataset.step<=step));
  void slide.offsetHeight;
}
function finishSlidePrep(slide){
  if(!slide)return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>slide.classList.remove('step-prep')));
}
function go(i,dir){
  i=Math.max(0,Math.min(i,totalSlides-1));
  if(i===S.cur||S.busy)return;
  S.busy=true;
  const c=slides[S.cur],n=slides[i];
  S.cur=i;S.step=S.info[i].max;
  prepSlideStep(n,S.step);
  c.classList.remove('active');
  c.classList.add(dir==='next'?'exit-left':'exit-right');
  c.setAttribute('aria-hidden','true');
  n.classList.add('active');
  n.setAttribute('aria-hidden','false');
  finishSlidePrep(n);
  ctrl();
  setTimeout(()=>{c.classList.remove('exit-left','exit-right');S.busy=false},CFG.TRANSITION_MS);
}
function jump(i){
  i=Math.max(0,Math.min(i,totalSlides-1));if(i===S.cur)return;
  const c=slides[S.cur],n=slides[i];
  S.cur=i;S.step=S.info[i].max;
  prepSlideStep(n,S.step);
  c.classList.remove('active');c.setAttribute('aria-hidden','true');
  n.classList.add('active');n.setAttribute('aria-hidden','false');
  finishSlidePrep(n);
  ctrl();
}
function isEd(){return document.body.classList.contains('editor-mode')}

/* 공통: 스텝 단위 전진/후진 (휠·스페이스·화살표 통합 로직).
   현재 슬라이드 스텝이 남아있으면 step±, 아니면 다음/이전 슬라이드로 이동.
   다음 슬라이드 진입 시 step=0, 이전 슬라이드 진입 시 step=max (휠과 동일). */
function advanceStep(dir){
  if(S.busy)return;
  if(dir==='next'){
    if(S.step<S.info[S.cur].max){S.step++;reveal()}
    else if(S.cur<totalSlides-1){goStep(S.cur+1,'next',0)}
    else {/* 마지막 슬라이드 끝 — 휠 누적 리셋 (flash 방지) */ _wheelAcc=0;}
  }else{
    if(S.cur===0){/* 첫 슬라이드 — 휠 누적 리셋 */ _wheelAcc=0;}
    else if(S.step>0){S.step--;reveal()}
    else if(S.cur>0){goStep(S.cur-1,'prev',S.info[S.cur-1].max)}
  }
}
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
  if((e.key==='e'||e.key==='E')&&!e.ctrlKey&&!e.metaKey){if(e.target.isContentEditable)return;e.preventDefault();EA.toggle();return}
  if((e.key==='g'||e.key==='G')&&!e.ctrlKey&&isEd()){if(e.target.isContentEditable)return;e.preventDefault();document.body.classList.toggle('show-grid');return}
  if(isEd()){
    if(e.key==='PageDown'){e.preventDefault();if(S.cur<totalSlides-1){jump(S.cur+1);EA._sw()}return}
    if(e.key==='PageUp'){e.preventDefault();if(S.cur>0){jump(S.cur-1);EA._sw()}return}
    return;
  }
  switch(e.key){
    /* 휠·스페이스·화살표 = 스텝 단위 (블록 하나씩). PageUp/PageDown = 슬라이드 단위. */
    case'ArrowRight':case'ArrowDown':e.preventDefault();advanceStep('next');break;
    case'ArrowLeft':case'ArrowUp':e.preventDefault();advanceStep('prev');break;
    case' ':e.preventDefault();advanceStep('next');break;
    case'PageDown':e.preventDefault();go(S.cur+1,'next');break;
    case'PageUp':e.preventDefault();go(S.cur-1,'prev');break;
    case'Home':e.preventDefault();go(0,'prev');break;
    case'End':e.preventDefault();go(totalSlides-1,'next');break;
    case'f':case'F':if(!document.fullscreenElement)CF.requestFullscreen().catch(()=>{});else document.exitFullscreen();break;
    case'n':case'N':document.body.classList.toggle('show-notes');break;
  }
});
let tx=0,tt=0;
CF.addEventListener('touchstart',e=>{if(isEd())return;tx=e.changedTouches[0].clientX;tt=Date.now()},{passive:true});
CF.addEventListener('touchend',e=>{if(isEd())return;const dx=e.changedTouches[0].clientX-tx;if(Date.now()-tt>CFG.TOUCH_TIMEOUT||Math.abs(dx)<CFG.TOUCH_MIN_PX)return;dx<0?go(S.cur+1,'next'):go(S.cur-1,'prev')},{passive:true});

/* Wheel navigation — presentation mode.
   휠 한 번 = 스텝 한 개 전진/후진 (블록 하나씩).
   슬라이드 끝에 도달하면 다음/이전 슬라이드로 넘어감.
   다음 슬라이드 진입 시 step=0 (아무것도 안 보임), 이전 슬라이드 진입 시 step=max (전체 보임).
   첫 슬라이드는 예외: 항상 전체 표시, 휠 위로 동작 안 함. */
let _wheelLock=0,_wheelAcc=0;
/* go()를 쓰되 진입 스텝을 파라미터로 받음 */
function goStep(i,dir,entryStep){
  i=Math.max(0,Math.min(i,totalSlides-1));
  if(i===S.cur||S.busy)return;
  S.busy=true;
  const c=slides[S.cur],n=slides[i];
  /* Flash 방지: active 추가 전에 새 슬라이드의 step 상태 먼저 세팅.
     'active' 가 먼저 붙으면 한 프레임 동안 [data-step] 요소들이 (visible 없이 또는 잔여 visible 로)
     전부 보일 수 있음. visible 클래스 정리 + reflow 강제 후에 active 붙여야 flash 없음. */
  S.cur=i;
  S.step=(i===0)?S.info[i].max:entryStep;
  prepSlideStep(n,S.step);
  c.classList.remove('active');
  c.classList.add(dir==='next'?'exit-left':'exit-right');
  c.setAttribute('aria-hidden','true');
  n.classList.add('active');
  n.setAttribute('aria-hidden','false');
  finishSlidePrep(n);
  ctrl();
  setTimeout(()=>{c.classList.remove('exit-left','exit-right');S.busy=false},CFG.TRANSITION_MS);
}
CF.addEventListener('wheel',e=>{
  if(isEd())return;
  e.preventDefault();
  const now=Date.now();
  if(now<_wheelLock)return;
  const dy=e.deltaY;
  if(Math.abs(dy)<4)return;
  _wheelAcc+=dy;
  if(Math.abs(_wheelAcc)<30)return;
  const dir=_wheelAcc>0?'next':'prev';
  _wheelAcc=0;
  if(S.busy){_wheelLock=now+100;return}
  if(dir==='next'){
    /* 현재 슬라이드에 남은 스텝 있으면 스텝 진행 */
    if(S.step<S.info[S.cur].max){
      S.step++;reveal();
      _wheelLock=now+250;/* 스텝 간 최소 간격 */
    }else if(S.cur<totalSlides-1){
      /* 다음 슬라이드 진입: step=0부터 시작 (블록 하나씩 나타나게) */
      _wheelLock=now+CFG.TRANSITION_MS+50;
      goStep(S.cur+1,'next',0);
    }else{
      /* 마지막 슬라이드 끝 — 더 이상 진행 불가, 락 걸어 연쇄 발사 방지 */
      _wheelLock=now+300;_wheelAcc=0;
    }
  }else{
    /* 현재 슬라이드에 되돌릴 스텝 있으면 스텝 후진. 첫 슬라이드에선 스텝 고정. */
    if(S.cur===0 && S.step<=0){
      /* 맨 앞 슬라이드에서 위로 굴려도 변화 없음 — 락 걸어 연쇄 발사 방지 */
      _wheelLock=now+300;_wheelAcc=0;
    }else if(S.step>0){
      S.step--;reveal();
      _wheelLock=now+250;
    }else if(S.cur>0){
      /* 이전 슬라이드 진입: step=max로 (전체 표시) */
      _wheelLock=now+CFG.TRANSITION_MS+50;
      goStep(S.cur-1,'prev',S.info[S.cur-1].max);
    }
  }
},{passive:false});

/* Auto-restore saved edits on page load */
try{
  const saved=localStorage.getItem('ed_save');
  if(saved){
    const storedHash=localStorage.getItem('ed_save_hash')||'';
    const fileHash=window._deckHash.read();
    if(fileHash&&storedHash&&fileHash!==storedHash){
      localStorage.removeItem('ed_save');
      localStorage.removeItem('ed_save_hash');
      console.log('[deck] 원본 파일 변경 감지 — 캐시 무효화');
    }else{
      const d=document.querySelector('.slide-deck');
      const ov=[];d.querySelectorAll('.ed-guide-169,.ed-crosshair-h,.ed-crosshair-v,.ed-grid,.ed-snap-h,.ed-snap-v').forEach(e=>{ov.push(e);e.remove()});
      d.innerHTML=saved;
      ov.forEach(e=>d.appendChild(e));
      d.querySelectorAll('.slide').forEach(s=>{s.classList.remove('active','exit-left','exit-right');s.removeAttribute('aria-hidden')});
      d.querySelectorAll('.visible').forEach(e=>e.classList.remove('visible'));
      d.querySelectorAll('.ed-drag-handle,.ed-media-del,.ed-resize-handle').forEach(e=>e.remove());
      d.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));
      init();
    }
  }
}catch(e){}

S.cur=0;const hm=location.hash.match(/^#slide-(\d+)$/);if(hm){const n=+hm[1];if(n>=1&&n<=totalSlides)S.cur=n-1}
S.step=S.info[S.cur].max;render();

window.pAPI={S,go,jump,render,updateScale,zoomEditViewAt,panEditViewBy,resetEditView,
  get deckScale(){return _deckScale},
  get fitScale(){return _fitScale},
  get editView(){return {zoom:_editZoom,panX:_editPanX,panY:_editPanY,scale:_deckScale,fitScale:_fitScale}},
  get slides(){return slides},get total(){return totalSlides},
  reinit(){init();if(S.cur>=totalSlides)S.cur=Math.max(0,totalSlides-1);slides.forEach((s,i)=>s.setAttribute('data-slide',i));S.step=S.info[S.cur]?S.info[S.cur].max:0;render()}
};

/* ============================================================
   SELF-CHECK — 페이지 로드 후 엔진 연결 상태 확인
   ============================================================
   Edit 툴 사고, 인라인 임베드 누락 등으로 editor.js / panel-context.js 가
   로드되지 않으면 에디터 기능이 침묵 실패. 사용자는 영문을 모르고 버그 리포트.
   이 self-check 는 그런 케이스를 콘솔 + 화면 배너로 명확히 알려준다.
   ============================================================ */
console.log('[engine] presentation.js loaded — v2.2 (2026-04-24, file:// safe self-check)');
setTimeout(()=>{
  /* Export 결과물 케이스 — self-check 스킵 */
  const em=document.querySelector('meta[name="engine-mode"]');
  if(em && em.getAttribute('content')==='presentation'){
    console.log('[engine] self-check skipped — engine-mode=presentation (export)');
    return;
  }
  if(location.protocol==='file:'){
    console.log('[engine] self-check skipped — file:// (assumed export)');
    return;
  }
  const missing=[];
  if(!window.EA)missing.push('editor.js');
  if(!window.PanelCtx)missing.push('panel-context.js');
  if(missing.length===0){
    console.log('[engine] self-check OK: EA + PanelCtx 모두 로드됨');
    return;
  }
  console.warn('[engine] self-check FAIL — 누락:', missing.join(', '));
  /* 화면 상단에 경고 배너 표시 (presentation 모드에서만 — editor-mode 에선 패널이 이미 깨져있을 것) */
  try{
    const banner=document.createElement('div');
    banner.setAttribute('data-engine-warning','');
    banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#ff5f57;color:#000;font:bold 13px/1.5 monospace;padding:8px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.4)';
    banner.innerHTML='⚠ 엔진 로드 실패 — 누락: <b>'+missing.join(', ')+'</b> — HTML 의 &lt;script&gt; 태그 확인 필요. 검증: <code>scripts/verify_html.sh</code>';
    document.body.appendChild(banner);
  }catch(e){}
}, 300);/* editor.js / panel-context.js 로드 완료 대기 */
})();
