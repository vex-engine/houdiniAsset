/* =========================================================================
   editor.io.js — SAVE / EXPORT / FileSystemDirectoryHandle / SAVE AS
   Load order: 3rd (after block.js)
   ========================================================================= */
'use strict';

/* >>> editor.js original lines 1344-2237 >>> */
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
      if(document.querySelector('script[src*="panel-context.js"]'))return;
      const ioScript=Array.from(document.querySelectorAll('script[src]')).find(sc=>(sc.getAttribute('src')||'').indexOf('editor.io.js')>=0);
      const tryUrls=[];
      if(ioScript&&ioScript.src){
        tryUrls.push(new URL('../panel-context.js',ioScript.src).href);
      }else{
        tryUrls.push('engine/panel-context.js');
      }
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

function _engineBaseForFile(filePath){
  const fp=String(filePath||_getFilePath()).replace(/\\/g,'/').replace(/^\/+/,'');
  const parts=fp.split('/').filter(Boolean);
  parts.pop();
  if(parts[0]==='engine'){
    return '../'.repeat(Math.max(0,parts.length-1));
  }
  return '../'.repeat(parts.length)+'engine/';
}
function _isInlineEngineScript(sc){
  const src=(sc.getAttribute('src')||'').toLowerCase();
  const txt=sc.textContent||'';
  if(src){
    return src.endsWith('presentation.js') ||
      src.endsWith('panel-context.js') ||
      src.endsWith('editor.js') ||
      src.indexOf('editor/editor.')>=0;
  }
  return txt.indexOf('PRESENTATION ENGINE')>=0 ||
    txt.indexOf('window.EA=')>=0 ||
    txt.indexOf('function _buildSaveHTML')>=0 ||
    txt.indexOf('async function save(')>=0 ||
    txt.indexOf('panel-context.js —')>=0 ||
    txt.indexOf('editor.core.js —')>=0 ||
    txt.indexOf('editor.block.js —')>=0 ||
    txt.indexOf('editor.io.js —')>=0 ||
    txt.indexOf('editor.main.js —')>=0;
}
function _isInlineEngineStyle(st){
  const txt=st.textContent||'';
  return txt.indexOf('SLIDE ENGINE')>=0 ||
    (txt.indexOf('.slide-frame')>=0 &&
     txt.indexOf('.ed-nav')>=0 &&
     txt.indexOf('body.editor-mode')>=0);
}
function _ensureEditableExternalEngine(cl,filePath,opts){
  const base=(opts&&opts.base)||_engineBaseForFile(filePath);
  const head=cl.querySelector('head');
  const body=cl.querySelector('body');
  if(!head||!body)return;

  cl.querySelectorAll('meta[name="engine-mode"]').forEach(m=>m.remove());
  cl.querySelectorAll('script').forEach(sc=>{
    if(_isInlineEngineScript(sc))sc.remove();
  });
  cl.querySelectorAll('style').forEach(st=>{
    if(_isInlineEngineStyle(st))st.remove();
  });
  cl.querySelectorAll('link[rel="stylesheet"]').forEach(l=>{
    const href=(l.getAttribute('href')||'').replace(/\\/g,'/');
    if(href.endsWith('engine/engine.css')||href.endsWith('/engine.css')||href==='engine.css')l.remove();
  });

  const engineCss=base+'engine.css';
  const link=cl.createElement?cl.createElement('link'):document.createElement('link');
  link.setAttribute('rel','stylesheet');
  link.setAttribute('href',engineCss);
  const lastPreconnect=Array.from(head.querySelectorAll('link[rel="preconnect"],link[href*="fonts.googleapis"],link[href*="fonts.gstatic"]')).pop();
  if(lastPreconnect&&lastPreconnect.nextSibling)head.insertBefore(link,lastPreconnect.nextSibling);
  else head.insertBefore(link,head.firstChild);

  [
    'presentation.js',
    'panel-context.js',
    'editor/editor.core.js',
    'editor/editor.block.js',
    'editor/editor.io.js',
    'editor/editor.main.js'
  ].forEach(src=>{
    const sc=cl.createElement?cl.createElement('script'):document.createElement('script');
    sc.setAttribute('src',base+src);
    body.appendChild(sc);
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
          return src.indexOf('editor.js')>=0 || src.indexOf('editor/editor.')>=0 || (s.textContent||'').indexOf('EA.toggle')>=0 || (s.textContent||'').indexOf('_buildSaveHTML')>=0;
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

function _mediaExtFromMime(mime,fallbackName){
  const ext=(fallbackName&&fallbackName.match(/\.[a-z0-9]+$/i)||[''])[0].toLowerCase();
  if(ext)return ext;
  return ({
    'image/png':'.png','image/jpeg':'.jpg','image/jpg':'.jpg','image/webp':'.webp',
    'image/gif':'.gif','image/svg+xml':'.svg','image/avif':'.avif',
    'video/mp4':'.mp4','video/webm':'.webm','video/quicktime':'.mov',
    'audio/mpeg':'.mp3','audio/wav':'.wav','audio/ogg':'.ogg'
  })[mime]||'.bin';
}
function _safePersistStem(name){
  const raw=String(name||'clipboard_media').replace(/[?#].*$/,'').split(/[\\/]/).pop()||'clipboard_media';
  const noExt=raw.replace(/\.[a-z0-9]+$/i,'');
  return (noExt||'clipboard_media').replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').replace(/\s+/g,'_').slice(0,50)||'clipboard_media';
}
function _uniquePersistName(used,preferred,mime,i){
  const ext=_mediaExtFromMime(mime,preferred);
  let stem=_safePersistStem(preferred);
  if(/^(image|clipboard|media|blob_media)$/i.test(stem))stem='clipboard_'+Date.now().toString(36);
  let name=stem+ext;
  let n=i||1;
  while(used.has(name.toLowerCase())){
    name=stem+'_'+(++n)+ext;
  }
  used.add(name.toLowerCase());
  return name;
}
function _basenameOfAssetRef(ref){
  return String(ref||'').replace(/[?#].*$/,'').split(/[\\/]/).pop()||'';
}
function _hashFromAssetId(id){
  const m=String(id||'').match(/^sha256-([a-f0-9]{64})$/i);
  return m?m[1].toLowerCase():'';
}
function _assetIdFromHash(hash){
  return hash?'sha256-'+String(hash).toLowerCase():'';
}
function _hexFromArrayBuffer(buf){
  const a=new Uint8Array(buf);
  let out='';
  for(let i=0;i<a.length;i++)out+=(a[i]<16?'0':'')+a[i].toString(16);
  return out;
}
async function _sha256ArrayBuffer(buf){
  if(!window.crypto||!crypto.subtle||!crypto.subtle.digest)return '';
  const digest=await crypto.subtle.digest('SHA-256',buf);
  return _hexFromArrayBuffer(digest);
}
async function _sha256Blob(blob){
  if(!blob||!blob.arrayBuffer)return '';
  return _sha256ArrayBuffer(await blob.arrayBuffer());
}
async function _sha256Bytes(bytes){
  if(!bytes)return '';
  const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  const buf=view.buffer.slice(view.byteOffset,view.byteOffset+view.byteLength);
  return _sha256ArrayBuffer(buf);
}
function _seedAssetNamesFromClone(cl,used){
  const byHash=new Map();
  cl.querySelectorAll('img[src],video[src],source[src],audio[src]').forEach(el=>{
    const src=el.getAttribute('src')||'';
    if(!src||src.startsWith('blob:'))return;
    const base=_basenameOfAssetRef(src);
    if(base)used.add(base.toLowerCase());
    const hash=_hashFromAssetId(el.getAttribute('data-asset-id'));
    if(hash&&base&&!byHash.has(hash))byHash.set(hash,base);
  });
  return byHash;
}
async function _blobForURL(src,el){
  const entry=(typeof _blobFileMap!=='undefined')&&_blobFileMap.get(src);
  if(entry&&entry.file)return {blob:entry.file,name:entry.name||el.dataset?.filename||'clipboard_media'};
  try{
    const r=await fetch(src);
    if(!r.ok)throw new Error('fetch status '+r.status);
    const b=await r.blob();
    return {blob:b,name:el.dataset?.filename||'clipboard_media'};
  }catch(e){
    return {error:e.message||String(e)};
  }
}
function _missingMediaPlaceholder(src,reason){
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">'
    +'<rect width="640" height="360" fill="#111"/>'
    +'<rect x="12" y="12" width="616" height="336" fill="none" stroke="#ff5f57" stroke-width="4" stroke-dasharray="14 10"/>'
    +'<text x="320" y="160" text-anchor="middle" fill="#ff5f57" font-family="Arial,sans-serif" font-size="28" font-weight="700">Missing clipboard media</text>'
    +'<text x="320" y="205" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="18">Delete this block and paste the original again</text>'
    +'</svg>';
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
async function _persistBlobMediaInClone(cl,writeBlob,opts){
  opts=opts||{};
  const used=new Set();
  const nameByHash=_seedAssetNamesFromClone(cl,used);
  const saved=[],missing=[];
  const els=Array.from(cl.querySelectorAll('img[src^="blob:"],video[src^="blob:"],source[src^="blob:"],audio[src^="blob:"]'));
  for(let i=0;i<els.length;i++){
    const el=els[i],src=el.getAttribute('src');
    const got=await _blobForURL(src,el);
    if(!got.blob){
      missing.push({src,reason:got.error||'blob not available'});
      if(opts.removeMissing){
        const wrap=el.closest&&el.closest('.ed-media-wrap');
        if(wrap)wrap.remove();
        else el.remove();
      }else if(opts.replaceMissing){
        el.setAttribute('src',_missingMediaPlaceholder(src,got.error||'blob not available'));
        el.setAttribute('data-missing-blob',src);
        el.setAttribute('data-missing-reason',got.error||'blob not available');
        el.removeAttribute('data-source');
      }
      continue;
    }
    const hash=await _sha256Blob(got.blob);
    const assetId=_assetIdFromHash(hash);
    let name=hash&&nameByHash.get(hash);
    let didWrite=false;
    if(!name){
      name=_uniquePersistName(used,got.name||el.dataset?.filename,got.blob.type,i+1);
      if(hash)nameByHash.set(hash,name);
      await writeBlob(name,got.blob);
      didWrite=true;
    }
    el.setAttribute('src',name);
    el.setAttribute('data-filename',name);
    if(assetId)el.setAttribute('data-asset-id',assetId);
    el.setAttribute('data-asset-bytes',String(got.blob.size||0));
    el.removeAttribute('data-source');
    if(didWrite)saved.push({src,name,hash,bytes:got.blob.size,type:got.blob.type||'application/octet-stream'});
  }
  return {saved,missing};
}
function _removeDeadBlobMediaFromLive(missing){
  (missing||[]).forEach(m=>{
    const src=m&&m.src;if(!src)return;
    document.querySelectorAll('img[src="'+src+'"],video[src="'+src+'"],source[src="'+src+'"],audio[src="'+src+'"]').forEach(el=>{
      const wrap=el.closest&&el.closest('.ed-media-wrap');
      if(wrap)wrap.remove();
      else el.remove();
    });
  });
  if(missing&&missing.length){
    try{pAPI.reinit();buildNav();attachHandles&&attachHandles();}catch(e){}
  }
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
    const assets=[];
    const blobResult=await _persistBlobMediaInClone(cl,async(name,blob)=>{
      assets.push({name,data:await _blobToBase64(blob)});
    },{removeMissing:true});
    _ensureEditableExternalEngine(cl,_getFilePath());
    const fullHTML='<!DOCTYPE html>\n'+cl.outerHTML;
    const lsSave=()=>{try{localStorage.setItem(CFG.LS_SAVE,expDeck?expDeck.innerHTML:'');localStorage.setItem(CFG.LS_HASH,expMeta?expMeta.getAttribute('content'):'')}catch(e){}};

    /* ── Save API 서버로 파일 직접 저장 ── */
    try{
      await fetch(CFG.SAVE_API+'/ping',{signal:AbortSignal.timeout(800)});
      const filePath=_getFilePath();
      const res=await fetch(CFG.SAVE_API+'/save',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({filePath,html:fullHTML,assets}),
        signal:AbortSignal.timeout(10000)
      });
      const json=await res.json();
      if(!json.ok)throw new Error(json.error);
      _removeDeadBlobMediaFromLive(blobResult.missing);
      lsSave();
      _setDirty(false);
      msg('💾 저장됨 ('+json.kb+'KB, 미디어 '+(json.assets?json.assets.length:0)+'개'
        +(blobResult.missing.length?', 죽은 blob '+blobResult.missing.length+'개 자동 삭제':'')+')');
      return;
    }catch(e){
      if(e.name!=='AbortError')console.warn('[SaveAPI]',e.message);
      if(assets.length){
        await confirmDlg('저장 실패: blob 미디어를 실제 파일로 저장하려면 서버시작.bat이 필요합니다.\n\n'
          +'HTML에 임시 blob URL을 남기면 다음 실행 때 이미지가 깨지므로 저장하지 않았습니다.\n\n'
          +e.message,{okOnly:true});
        return;
      }
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
    const queuedAssetKeys=new Set();
    const usedNames=new Set();
    const sourceHtml=_getFilePath(); /* PPTX 루트 기준 상대경로 */

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
    function relPath(fromDir,toPath){
      const from=String(fromDir||'').replace(/\\/g,'/').split('/').filter(Boolean);
      const to=String(toPath||'').replace(/\\/g,'/').split('/').filter(Boolean);
      while(from.length&&to.length&&from[0]===to[0]){from.shift();to.shift();}
      return '../'.repeat(from.length)+to.join('/');
    }
    function localURLToAssetRef(src){
      try{
        const u=new URL(src,location.href);
        if(u.origin!==location.origin)return null;
        const rootRel=decodeURIComponent(u.pathname.replace(/^\/+/,''));
        if(!rootRel)return null;
        const fromDir=String(sourceHtml||'').replace(/\\/g,'/').replace(/[^/]*$/,'');
        return relPath(fromDir,rootRel);
      }catch(e){return null}
    }
    function queueAsset(a){
      const key=String(a.ref||'')+' -> '+String(a.dstName||'');
      if(queuedAssetKeys.has(key))return;
      queuedAssetKeys.add(key);
      assetsToCopy.push(a);
    }
    function rewriteAssetRefs(fromName,toName){
      if(!fromName||!toName||fromName===toName)return;
      cl.querySelectorAll('[src]').forEach(el=>{
        if(el.getAttribute('src')===fromName)el.setAttribute('src',toName);
      });
      cl.querySelectorAll('[poster]').forEach(el=>{
        if(el.getAttribute('poster')===fromName)el.setAttribute('poster',toName);
      });
      cl.querySelectorAll('[style]').forEach(el=>{
        const st=el.getAttribute('style');
        if(!st||st.indexOf(fromName)<0)return;
        const rewritten=st.replace(/url\((['"]?)([^'")]+)\1\)/gi,(m,q,u)=>{
          return u===fromName?'url('+q+toName+q+')':m;
        });
        if(rewritten!==st)el.setAttribute('style',rewritten);
      });
    }
    function markAssetMeta(name,hash,bytes){
      if(!name||!hash)return;
      cl.querySelectorAll('img[src],video[src],source[src],audio[src]').forEach(el=>{
        if(el.getAttribute('src')!==name)return;
        el.setAttribute('data-asset-id',_assetIdFromHash(hash));
        if(bytes!=null)el.setAttribute('data-asset-bytes',String(bytes));
        if(el.dataset)el.dataset.filename=name;
      });
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
        queueAsset({ref, dstName:name, data:src});
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
          queueAsset({ref, dstName:name, blob:entry.file, fallbackRef:entry.name||el.dataset?.filename||''});
          el.setAttribute('src', name);
        }else{
          /* 맵에 없음 — 페이지 리로드 후 src가 blob으로 남은 이상 상태.
             폴백: fetch로 시도 (같은 세션이면 가능) */
          try{
            const fname=el.dataset?.filename||'blob_media';
            const r=await fetch(src); const b=await r.blob();
            const ref=src;
            const name=allocName(ref, fname);
            queueAsset({ref, dstName:name, blob:b, fallbackRef:fname});
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
      /* 같은 localhost/static URL은 원본 파일로 복사, 외부 http(s)는 링크 유지 */
      if(/^https?:\/\//.test(src)){
        const localRef=localURLToAssetRef(src);
        if(localRef){
          const name=allocName(localRef);
          queueAsset({ref:localRef, dstName:name});
          el.setAttribute('src', name);
        }
        continue;
      }
      /* 상대경로 / 절대경로 — 서버가 원본 읽어서 복사 */
      const name=allocName(src);
      queueAsset({ref:src, dstName:name});
      el.setAttribute('src', name);
    }

    /* 7b. iframe[src] — 유튜브 등은 http, 로컬 파일은 복사 */
    for(const el of cl.querySelectorAll('iframe[src]')){
      const src=el.getAttribute('src');
      if(!src || /^https?:\/\//.test(src) || src.startsWith('data:')) continue;
      const name=allocName(src);
      queueAsset({ref:src, dstName:name});
      el.setAttribute('src', name);
    }

    /* 7c. poster, srcset, style="background-image:url(...)" 전수 스캔 */
    for(const el of cl.querySelectorAll('[poster]')){
      const src=el.getAttribute('poster');
      if(src && !/^(data:|https?:)/.test(src)){
        const already=dstNameByRef.has(src);
        const name=allocName(src);
        if(!already) queueAsset({ref:src, dstName:name});
        el.setAttribute('poster', name);
      }
    }
    for(const el of cl.querySelectorAll('[style]')){
      const st=el.getAttribute('style');
      if(st && /url\(/i.test(st)){
        const rewritten=st.replace(/url\((['"]?)([^'")]+)\1\)/gi,(m,q,u)=>{
          if(/^(data:|https?:|blob:)/.test(u)) return m;
          const already=dstNameByRef.has(u);
          const name=allocName(u);
          if(!already) queueAsset({ref:u, dstName:name});
          return 'url('+q+name+q+')';
        });
        if(rewritten!==st) el.setAttribute('style', rewritten);
      }
    }

    /* ── 8. 브라우저가 직접 폴더에 파일 쓰기 (showDirectoryPicker 핸들) ── */
    msg('파일 쓰는 중…');

    /* 8a. 미디어 하나씩 복사. 실제 bytes SHA-256 기준으로 같은 asset은 1번만 쓴다. */
    const copied=[]; const missing=[];
    const nameByHash=new Map();
    let reusedCount=0;
    async function readViaServer(ref){
      const url=CFG.SAVE_API+'/read-asset?relTo='+encodeURIComponent(sourceHtml)+'&ref='+encodeURIComponent(ref);
      const r=await fetch(url);
      const j=await r.json();
      if(!j.ok)throw new Error(j.error||'server asset read failed');
      const bin=atob(j.base64);
      const arr=new Uint8Array(bin.length);
      for(let k=0;k<bin.length;k++) arr[k]=bin.charCodeAt(k);
      return {arr,bytes:j.bytes,mime:j.mime||'application/octet-stream'};
    }
    for(let i=0;i<assetsToCopy.length;i++){
      const a=assetsToCopy[i];
      msg('미디어 복사 '+(i+1)+'/'+assetsToCopy.length+'…');
      try{
        let bytes,hash,write;
        if(a.blob){
          /* 세션 맵에서 꺼낸 원본 File 객체 — 어느 폴더에 있었든 무관 */
          hash=await _sha256Blob(a.blob);
          bytes=a.blob.size;
          write=()=>_writeBlobToDir(dirHandle, a.dstName, a.blob);
        }else if(a.data){
          /* data URL — 브라우저에서 직접 디코드 */
          const blob=await (await fetch(a.data)).blob();
          hash=await _sha256Blob(blob);
          bytes=blob.size;
          write=()=>_writeBlobToDir(dirHandle, a.dstName, blob);
        }else{
          /* 서버에서 원본 파일 받아오기 (HTML 기준 상대경로) */
          const read=await readViaServer(a.ref);
          hash=await _sha256Bytes(read.arr);
          bytes=read.bytes;
          write=()=>_writeBytesToDir(dirHandle, a.dstName, read.arr, read.mime);
        }
        const canonical=hash&&nameByHash.get(hash);
        if(canonical){
          rewriteAssetRefs(a.dstName,canonical);
          markAssetMeta(canonical,hash,bytes);
          reusedCount++;
          continue;
        }
        try{
          await write();
        }catch(writeErr){
          if(!a.blob||!a.fallbackRef)throw writeErr;
          console.warn('[export] blob copy failed; trying source file fallback', a.ref, a.fallbackRef, writeErr);
          const read=await readViaServer(a.fallbackRef);
          const fallbackHash=await _sha256Bytes(read.arr);
          const fallbackCanonical=fallbackHash&&nameByHash.get(fallbackHash);
          if(fallbackCanonical){
            rewriteAssetRefs(a.dstName,fallbackCanonical);
            markAssetMeta(fallbackCanonical,fallbackHash,read.bytes);
            reusedCount++;
            continue;
          }
          hash=fallbackHash||hash;
          if(hash)nameByHash.set(hash,a.dstName);
          await _writeBytesToDir(dirHandle, a.dstName, read.arr, read.mime);
          bytes=read.bytes;
        }
        if(hash)nameByHash.set(hash,a.dstName);
        markAssetMeta(a.dstName,hash,bytes);
        copied.push({ref:a.ref, name:a.dstName, hash, bytes});
      }catch(e){
        console.warn('[export] copy failed', a.ref, e);
        missing.push({ref:a.ref, reason:e.message});
      }
    }

    /* 8b. media dedupe rewrite까지 끝난 뒤 deck-hash/HTML을 최종화한다. */
    const expMeta=cl.querySelector('meta[name="deck-hash"]');
    if(expDeck&&expMeta){
      let h=5381;const s=expDeck.innerHTML;
      for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0;
      expMeta.setAttribute('content', h.toString(36));
    }
    const fullHTML='<!DOCTYPE html>\n'+cl.outerHTML;
    const warnings=_validateExportedHTML(fullHTML);
    await _writeFileToDir(dirHandle, safeHtmlName, fullHTML, 'text/html;charset=utf-8');

    /* 8c. manifest — 누락/경고/dedupe 있을 때 생성 */
    const needManifest = missing.length > 0 || warnings.length > 0 || reusedCount > 0;
    if(needManifest){
      const manifest={
        exportedAt: new Date().toISOString(),
        engineVersion: '2.1',
        html: { name:safeHtmlName, bytes: fullHTML.length },
        files: copied,
        deduped: reusedCount,
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
      if(reusedCount>0)report+='• 중복 재사용: '+reusedCount+'개\n';
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
      msg('✔ Export 완료 — '+dirHandle.name+'/'+safeHtmlName+' ('+copyCount+'개 미디어'
        +(reusedCount?(', 중복 '+reusedCount+'개 재사용'):'')+')');
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
    const blobResult=await _persistBlobMediaInClone(cl,(name,blob)=>_writeBlobToDir(dirHandle,name,blob),{removeMissing:true});
    _ensureEditableExternalEngine(cl,safeName,{base:location.origin.replace(/\/$/,'')+'/engine/'});
    const fullHTML='<!DOCTYPE html>\n'+cl.outerHTML;
    await _writeFileToDir(dirHandle, safeName, fullHTML, 'text/html;charset=utf-8');
    _removeDeadBlobMediaFromLive(blobResult.missing);
    try{localStorage.setItem(CFG.LS_SAVE,expDeck?expDeck.innerHTML:'');localStorage.setItem(CFG.LS_HASH,expMeta?expMeta.getAttribute('content'):'')}catch(e){}
    _setDirty(false);
    msg('✔ Save As 완료 → '+dirHandle.name+'/'+safeName
      +(blobResult.missing.length?' (죽은 blob '+blobResult.missing.length+'개 자동 삭제)':''));
  }catch(e){console.error('[SaveAs]',e);msg('Save As 실패: '+e.message)}
}

/* downloadHTML alias kept for compatibility */
function downloadHTML(){exportHTML()}

/* <<< end 1344-2237 <<< */
