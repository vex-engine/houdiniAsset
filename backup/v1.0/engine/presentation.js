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
function init(){slides=Array.from(document.querySelectorAll('.slide'));totalSlides=slides.length;TN.textContent=totalSlides;S.info=slides.map(s=>{let m=0;s.querySelectorAll('[data-step]').forEach(e=>{const v=+e.dataset.step;if(v>m)m=v});return{max:m}})}
init();
/* Scale the fixed canvas to fit inside the slide-frame (never enlarge past 1:1) */
let _deckScale=1;
function updateScale(){
  const fw=CF.clientWidth,fh=CF.clientHeight;
  _deckScale=Math.min(fw/CW,fh/CH);
  DECK.style.transform='scale('+_deckScale+')';
}
updateScale();
window.addEventListener('resize',updateScale);
function render(){slides.forEach((s,i)=>{s.classList.toggle('active',i===S.cur);s.classList.remove('exit-left','exit-right');s.setAttribute('aria-hidden',i!==S.cur)});reveal();ctrl()}
function reveal(){const s=slides[S.cur];if(!s)return;s.querySelectorAll('[data-step]').forEach(e=>e.classList.toggle('visible',+e.dataset.step<=S.step))}
function ctrl(){PF.style.width=(totalSlides>1?(S.cur/(totalSlides-1))*100:100)+'%';CN.textContent=S.cur+1;TN.textContent=totalSlides}
function go(i,dir){i=Math.max(0,Math.min(i,totalSlides-1));if(i===S.cur||S.busy)return;S.busy=true;const c=slides[S.cur],n=slides[i];c.classList.remove('active');c.classList.add(dir==='next'?'exit-left':'exit-right');n.classList.add('active');n.setAttribute('aria-hidden','false');S.cur=i;S.step=S.info[i].max;reveal();ctrl();setTimeout(()=>{c.classList.remove('exit-left','exit-right');S.busy=false},CFG.TRANSITION_MS)}
function jump(i){i=Math.max(0,Math.min(i,totalSlides-1));if(i===S.cur)return;slides[S.cur].classList.remove('active');slides[S.cur].setAttribute('aria-hidden','true');S.cur=i;S.step=S.info[i].max;slides[i].classList.add('active');slides[i].setAttribute('aria-hidden','false');reveal();ctrl()}
function isEd(){return document.body.classList.contains('editor-mode')}

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
    case'ArrowRight':case'ArrowDown':e.preventDefault();go(S.cur+1,'next');break;
    case'ArrowLeft':case'ArrowUp':e.preventDefault();go(S.cur-1,'prev');break;
    /* Space = 스텝 단위 진행(블록 하나씩), PageDown/PageUp = 페이지 단위 이동 */
    case' ':e.preventDefault();if(S.step<S.info[S.cur].max){S.step++;reveal()}else go(S.cur+1,'next');break;
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
  c.classList.remove('active');
  c.classList.add(dir==='next'?'exit-left':'exit-right');
  n.classList.add('active');
  n.setAttribute('aria-hidden','false');
  S.cur=i;
  /* 첫 슬라이드는 항상 max (전체 표시) */
  S.step=(i===0)?S.info[i].max:entryStep;
  reveal();ctrl();
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
    }
  }else{
    /* 현재 슬라이드에 되돌릴 스텝 있으면 스텝 후진. 첫 슬라이드에선 스텝 고정. */
    if(S.cur===0){
      /* 맨 앞 슬라이드에서 위로 굴려도 변화 없음 */
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

window.pAPI={S,go,jump,render,updateScale,get deckScale(){return _deckScale},get slides(){return slides},get total(){return totalSlides},
  reinit(){init();if(S.cur>=totalSlides)S.cur=Math.max(0,totalSlides-1);slides.forEach((s,i)=>s.setAttribute('data-slide',i));S.step=S.info[S.cur]?S.info[S.cur].max:0;render()}
};
})();
