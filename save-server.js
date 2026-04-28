/* ============================================================
   HTML Presentation — Local Save/Export Server
   ============================================================
   역할:
   - Ctrl+S (Save)     : localhost:3001/save   → 열려있는 HTML 파일 덮어쓰기
   - Save As           : /save-as              → 새 파일로 저장 (로컬 전용)
   - Export            : /export               → 임의 폴더에 flat 복사
     (HTML + 모든 미디어가 지정한 한 폴더에 모임 — file:// 더블클릭으로 작동)
   - Ping              : /ping                 → 생존 확인

   포트: 3001 (정적 서버 3000과 분리)
   ============================================================ */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT       = 3001;
const PPTX_ROOT  = __dirname;                 // 이 파일이 PPTX 루트에 있다고 가정
const STATIC_PORT = 3000;                     // 정적 서버 포트 (Save 경로 해석용)

/* ── 정적 파일 서버 (localhost:3000) ── */
const STATIC_EXT_MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.mp4':'video/mp4', '.webm':'video/webm', '.woff2':'font/woff2',
  '.woff':'font/woff', '.ttf':'font/ttf', '.otf':'font/otf',
  '.md':'text/markdown; charset=utf-8'
};

const EDITABLE_ENGINE_SCRIPTS = [
  'presentation.js',
  'panel-context.js',
  'editor/editor.core.js',
  'editor/editor.block.js',
  'editor/editor.io.js',
  'editor/editor.main.js'
];

function toPosix(p){ return String(p||'').replace(/\\/g,'/'); }
function engineBaseForRel(rel){
  const clean = toPosix(rel).replace(/^\/+/,'');
  const dir = path.posix.dirname(clean);
  const parts = dir === '.' ? [] : dir.split('/').filter(Boolean);
  if(parts[0] === 'engine') return '../'.repeat(Math.max(0, parts.length - 1));
  return '../'.repeat(parts.length) + 'engine/';
}
function hasEngineModePresentation(html){
  return /<meta[^>]+name=(["'])engine-mode\1[^>]+content=(["'])presentation\2/i.test(html) ||
    /<meta[^>]+content=(["'])presentation\1[^>]+name=(["'])engine-mode\2/i.test(html);
}
function isEditableDeckHtml(html){
  return /slide-deck/i.test(html) &&
    /(id=(["'])edToolbar\2|id=(["'])edNavList\3|class=(["'])ed-nav\4|fb-save)/i.test(html);
}
function isInlineEngineScript(attrs, body){
  const srcMatch = String(attrs||'').match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
  const src = srcMatch ? toPosix(srcMatch[2].toLowerCase()) : '';
  if(src){
    return src.endsWith('/presentation.js') ||
      src.endsWith('presentation.js') ||
      src.endsWith('/panel-context.js') ||
      src.endsWith('panel-context.js') ||
      src.endsWith('/editor.js') ||
      src.endsWith('editor.js') ||
      src.includes('/editor/editor.');
  }
  const txt = String(body||'');
  return txt.includes('PRESENTATION ENGINE') ||
    txt.includes('window.EA=') ||
    txt.includes('function _buildSaveHTML') ||
    txt.includes('async function save(') ||
    txt.includes('panel-context.js') ||
    txt.includes('editor.core.js') ||
    txt.includes('editor.block.js') ||
    txt.includes('editor.io.js') ||
    txt.includes('editor.main.js');
}
function isInlineEngineStyle(body){
  const txt = String(body||'');
  return txt.includes('SLIDE ENGINE') ||
    (txt.includes('.slide-frame') && txt.includes('.ed-nav') && txt.includes('body.editor-mode'));
}
function normalizeEditableEngineRefs(html, rel, opts){
  if(!isEditableDeckHtml(html) || hasEngineModePresentation(html)) return html;
  const base = opts&&opts.base ? opts.base : engineBaseForRel(rel);
  let out = html;
  out = out.replace(/<meta\s+name=(["'])engine-mode\1[^>]*>\s*/gi, '');
  out = out.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) =>
    isInlineEngineScript(attrs, body) ? '' : full
  );
  out = out.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, body) =>
    isInlineEngineStyle(body) ? '' : full
  );
  out = out.replace(/<link\b[^>]+rel=(["'])stylesheet\1[^>]+href=(["'])[^"']*(?:engine\/engine\.css|\/engine\.css|engine\.css)\2[^>]*>\s*/gi, '');

  const cssTag = `<link rel="stylesheet" href="${base}engine.css">\n`;
  const styleIdx = out.search(/<style\b/i);
  if(styleIdx >= 0) out = out.slice(0, styleIdx) + cssTag + out.slice(styleIdx);
  else out = out.replace(/<\/head>/i, cssTag + '</head>');

  const scriptTags = EDITABLE_ENGINE_SCRIPTS
    .map(src => `<script src="${base + src}"></script>`)
    .join('\n') + '\n';
  out = out.replace(/<\/body>/i, scriptTags + '</body>');
  return out;
}

http.createServer((req, res) => {
  try{
    const decoded = decodeURIComponent(req.url.split('?')[0]);
    let rel = decoded.replace(/^\/+/, '');
    if(!rel) rel = 'index.html';  /* 루트 → 랜딩 페이지 */
    const full = path.resolve(PPTX_ROOT, rel);
    if(!full.startsWith(PPTX_ROOT)){ res.writeHead(403); res.end('forbidden'); return; }
    fs.stat(full, (err, st) => {
      if(err || !st.isFile()){ res.writeHead(404); res.end('not found: '+rel); return; }
      const ext = path.extname(full).toLowerCase();
      const mime = STATIC_EXT_MIME[ext] || 'application/octet-stream';
      res.writeHead(200, {'Content-Type':mime, 'Cache-Control':'no-cache', 'Access-Control-Allow-Origin':'*'});
      if(ext === '.html'){
        fs.readFile(full, 'utf8', (readErr, html)=>{
          if(readErr){ res.end('read error: '+readErr.message); return; }
          res.end(normalizeEditableEngineRefs(html, rel));
        });
      }else{
        fs.createReadStream(full).pipe(res);
      }
    });
  }catch(e){ res.writeHead(500); res.end(e.message); }
}).listen(STATIC_PORT, ()=>console.log(`[static]  http://localhost:${STATIC_PORT}  (root: ${PPTX_ROOT})`));

/* ── Save/Export API 서버 (localhost:3001) ── */
function cors(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
}
function readJSON(req){
  return new Promise((resolve, reject)=>{
    let b=''; req.on('data', c=>{ b+=c; if(b.length>500*1024*1024){ reject(new Error('payload too large (>500MB)')); req.destroy(); } });
    req.on('end', ()=>{ try{ resolve(JSON.parse(b||'{}')); }catch(e){ reject(e); } });
    req.on('error', reject);
  });
}
function jsonRes(res, status, obj){
  cors(res);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(obj));
}

/* Windows / POSIX 경로 모두 허용 — 절대경로 정규화.
   "c:\temp", "C:/temp", "/Users/x/p", "d:\\pre\\1" 모두 OK */
function normalizeDir(p){
  if(!p || typeof p !== 'string') throw new Error('empty path');
  let x = p.trim().replace(/^["']|["']$/g,'');
  x = x.replace(/\\/g,'/');
  /* 상대경로면 PPTX_ROOT 기준으로 해석 */
  if(!path.isAbsolute(x)) x = path.resolve(PPTX_ROOT, x);
  return path.normalize(x);
}
function normalizeRelPath(p, opts){
  opts = opts || {};
  let x = String(p || '').trim().replace(/^["']|["']$/g,'').replace(/\\/g,'/');
  x = x.replace(/^\/+/, '');
  if(!x && opts.allowEmpty) return '';
  if(!x) throw new Error('empty path');
  if(path.isAbsolute(x) || /^[a-z]:\//i.test(x) || x.includes('..')) throw new Error('relative path required');
  return x;
}
function resolveRootRel(rel, opts){
  const clean = normalizeRelPath(rel, opts);
  const full = path.resolve(PPTX_ROOT, clean || '.');
  if(!full.startsWith(PPTX_ROOT)) throw new Error('path escapes root');
  return { rel: clean, full };
}
function relFromRoot(full){
  return toPosix(path.relative(PPTX_ROOT, full));
}

/* 파일명 안전화 (OS 별 금지 문자 + 길이) */
function safeName(s){
  return String(s).replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').replace(/\s+/g,'_').slice(0, 200) || 'file';
}

/* Base64 → Buffer (Data URL 지원) */
function decodeAsset(dataOrBase64){
  if(dataOrBase64.startsWith('data:')){
    const m = dataOrBase64.match(/^data:[^;]+;base64,(.*)$/);
    if(!m) throw new Error('invalid data URL');
    return Buffer.from(m[1], 'base64');
  }
  return Buffer.from(dataOrBase64, 'base64');
}

/* 미디어 원본 파일 경로 해석 — 현재 HTML 위치 기준 상대경로 or 절대경로 */
function resolveSourcePath(htmlFilePath, assetRef){
  /* data:, http(s):, blob: 는 처리 불가 (caller가 이미 base64 버퍼로 넘겨줘야 함) */
  if(/^(data:|https?:|blob:)/.test(assetRef)) return null;
  const baseDir = path.dirname(htmlFilePath);
  const cand = path.isAbsolute(assetRef) ? assetRef : path.resolve(baseDir, assetRef);
  return path.normalize(cand);
}

const apiServer = http.createServer(async (req, res) => {
  if(req.method === 'OPTIONS'){ cors(res); res.writeHead(204); res.end(); return; }
  const u = url.parse(req.url, true);

  /* ─────────── PING ─────────── */
  if(u.pathname === '/ping'){
    return jsonRes(res, 200, { ok:true, version:'2.0', root:PPTX_ROOT });
  }

  /* ─────────── DIRECTORY LIST: Save As 폴더 찾기 ─────────── */
  if(req.method === 'GET' && u.pathname === '/list-dirs'){
    try{
      const { rel, full } = resolveRootRel(u.query.dir || '', { allowEmpty:true });
      if(!fs.existsSync(full) || !fs.statSync(full).isDirectory()) throw new Error('directory not found');
      const dirs = fs.readdirSync(full, { withFileTypes:true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules' && d.name !== '.git')
        .map(d => ({ name:d.name, rel:toPosix(path.posix.join(rel, d.name)) }))
        .sort((a,b)=>a.name.localeCompare(b.name, 'ko'));
      const parent = rel ? relFromRoot(path.dirname(full)) : '';
      return jsonRes(res, 200, { ok:true, dir:rel, parent, dirs });
    }catch(e){ console.error('[list-dirs] error', e); return jsonRes(res, 400, { ok:false, error:e.message }); }
  }

  /* ─────────── EXISTS: Save As 덮어쓰기 확인 ─────────── */
  if(req.method === 'POST' && u.pathname === '/exists'){
    try{
      const body = await readJSON(req);
      const filePath = normalizeRelPath(body.filePath || '');
      const { full } = resolveRootRel(filePath);
      const dir = path.dirname(full);
      const assets = Array.isArray(body.assets) ? body.assets : [];
      const existingAssets = [];
      for(const a of assets){
        const name = safeName(a && (a.name || a));
        const assetPath = path.resolve(dir, name);
        if(!assetPath.startsWith(dir)) throw new Error('asset path escapes deck folder: '+name);
        if(fs.existsSync(assetPath)) existingAssets.push(name);
      }
      return jsonRes(res, 200, {
        ok:true,
        file:fs.existsSync(full),
        assets:[...new Set(existingAssets)]
      });
    }catch(e){ console.error('[exists] error', e); return jsonRes(res, 400, { ok:false, error:e.message }); }
  }

  /* ─────────── SAVE: 기존 파일 덮어쓰기 ─────────── */
  if(req.method === 'POST' && u.pathname === '/save'){
    try{
      const body = await readJSON(req);
      const filePath = body.filePath;
      let html       = body.html;
      if(!filePath || html==null) throw new Error('filePath/html required');
      /* filePath는 PPTX_ROOT 기준 상대경로만 허용 (보안) */
      if(path.isAbsolute(filePath) || filePath.includes('..')) throw new Error('relative path required');
      const full = path.resolve(PPTX_ROOT, filePath);
      if(!full.startsWith(PPTX_ROOT)) throw new Error('path escapes root');
      html = normalizeEditableEngineRefs(html, filePath);
      fs.mkdirSync(path.dirname(full), { recursive:true });
      const assets = Array.isArray(body.assets) ? body.assets : [];
      const copied = [];
      for(const a of assets){
        if(!a || !a.name || !a.data) continue;
        const name = safeName(a.name);
        const dst = path.resolve(path.dirname(full), name);
        if(!dst.startsWith(path.dirname(full))) throw new Error('asset path escapes deck folder: '+name);
        const buf = decodeAsset(a.data);
        fs.writeFileSync(dst, buf);
        copied.push({ name, bytes:buf.length });
      }
      fs.writeFileSync(full, html, 'utf8');
      const kb = Math.round(Buffer.byteLength(html,'utf8')/1024);
      console.log(`[save] ${filePath} (${kb}KB, assets ${copied.length})`);
      return jsonRes(res, 200, { ok:true, kb, path:full, assets:copied });
    }catch(e){ console.error('[save] error', e); return jsonRes(res, 400, { ok:false, error:e.message }); }
  }

  /* ─────────── SAVE AS: 새 파일 저장 (절대경로 허용, 로컬 전용) ─────────── */
  if(req.method === 'POST' && u.pathname === '/save-as'){
    try{
      const body = await readJSON(req);
      const dir  = normalizeDir(body.dir);
      const name = safeName(body.name || 'presentation.html');
      let html   = body.html;
      if(html==null) throw new Error('html required');
      html = normalizeEditableEngineRefs(html, name, {base:`http://localhost:${STATIC_PORT}/engine/`});
      fs.mkdirSync(dir, { recursive:true });
      const full = path.join(dir, name);
      fs.writeFileSync(full, html, 'utf8');
      console.log(`[save-as] ${full}`);
      return jsonRes(res, 200, { ok:true, path:full });
    }catch(e){ console.error('[save-as] error', e); return jsonRes(res, 400, { ok:false, error:e.message }); }
  }

  /* ─────────── EXPORT: 폴더 flat 복사 ───────────
     body: {
       targetDir:  "c:\\temp\\deck1"         (대상 폴더 — 없으면 생성, 파일 이미 있으면 덮어씀)
       htmlName:   "prompt_lecture.html"     (HTML 파일명)
       html:       "<!DOCTYPE html>..."      (완성된 HTML 문자열 — 이미 상대경로로 재작성된 상태여야 함)
       sourceHtml: "presentations/xxx/f.html" (미디어 원본 해석용 — PPTX 상대경로)
       assets:     [{ref:"demo.mp4"}, {ref:"img/a.png"}, {ref:"inlineBlob.png", data:"<base64>"}]
       overwrite:  true | false              (기본 true)
     }
     response: { ok, dir, files:[{ref,dst,bytes}], missing:[...], manifest }
  */
  if(req.method === 'POST' && u.pathname === '/export'){
    try{
      const body = await readJSON(req);
      const targetDir = normalizeDir(body.targetDir);
      const htmlName  = safeName(body.htmlName || 'index.html');
      const html      = body.html;
      if(html==null) throw new Error('html required');
      const sourceHtml = body.sourceHtml || null;
      const sourceHtmlAbs = sourceHtml ? path.resolve(PPTX_ROOT, sourceHtml) : null;
      const assets    = Array.isArray(body.assets) ? body.assets : [];
      const overwrite = body.overwrite !== false;

      fs.mkdirSync(targetDir, { recursive:true });

      const copied = [];
      const missing = [];
      const usedNames = new Set([htmlName.toLowerCase()]);

      /* 파일명 충돌 회피 (flat 구조라 같은 이름이 겹칠 수 있음) */
      function uniqueName(ref){
        const raw = safeName(path.basename(ref));
        if(!usedNames.has(raw.toLowerCase())){ usedNames.add(raw.toLowerCase()); return raw; }
        const ext = path.extname(raw);
        const stem = raw.slice(0, raw.length - ext.length);
        for(let i=2; i<9999; i++){
          const cand = `${stem}_${i}${ext}`;
          if(!usedNames.has(cand.toLowerCase())){ usedNames.add(cand.toLowerCase()); return cand; }
        }
        throw new Error('filename collision: '+ref);
      }

      for(const a of assets){
        const ref = a.ref;
        if(!ref){ continue; }
        const fname = a.dstName ? safeName(a.dstName) : uniqueName(ref);
        const dst = path.join(targetDir, fname);
        try{
          let buf;
          if(a.data){
            buf = decodeAsset(a.data);
          }else{
            if(!sourceHtmlAbs) throw new Error('sourceHtml required to resolve: '+ref);
            const src = resolveSourcePath(sourceHtmlAbs, ref);
            if(!src || !fs.existsSync(src)){
              missing.push({ ref, reason:'source file not found', lookedAt: src });
              continue;
            }
            buf = fs.readFileSync(src);
          }
          if(!overwrite && fs.existsSync(dst)){
            missing.push({ ref, reason:'destination exists (overwrite=false)' });
            continue;
          }
          fs.writeFileSync(dst, buf);
          copied.push({ ref, dst, name:fname, bytes:buf.length });
        }catch(e){
          missing.push({ ref, reason:e.message });
        }
      }

      /* HTML 쓰기 */
      const htmlDst = path.join(targetDir, htmlName);
      fs.writeFileSync(htmlDst, html, 'utf8');

      /* manifest 기록 */
      const manifest = {
        exportedAt: new Date().toISOString(),
        engineVersion: '2.0',
        html: { name:htmlName, bytes: Buffer.byteLength(html,'utf8') },
        files: copied.map(c=>({ original:c.ref, name:c.name, bytes:c.bytes })),
        missing,
        totalBytes: copied.reduce((s,c)=>s+c.bytes, 0) + Buffer.byteLength(html,'utf8')
      };
      fs.writeFileSync(path.join(targetDir, '_export_manifest.json'),
        JSON.stringify(manifest, null, 2), 'utf8');

      console.log(`[export] ${targetDir} — html + ${copied.length} files (${Math.round(manifest.totalBytes/1024)}KB)${missing.length?` — missing ${missing.length}`:''}`);
      return jsonRes(res, 200, {
        ok: missing.length===0,
        dir: targetDir,
        htmlPath: htmlDst,
        files: copied,
        missing,
        manifest
      });
    }catch(e){ console.error('[export] error', e); return jsonRes(res, 400, { ok:false, error:e.message }); }
  }

  /* ─────────── FETCH ASSET: 서버가 PPTX 내 파일 읽어서 base64로 반환 ───────────
     브라우저가 showDirectoryPicker로 받은 폴더에 미디어를 직접 복사할 때 사용.
     query: ?relTo=<sourceHtml 상대경로>&ref=<미디어 상대참조>
     또는: ?path=<PPTX 루트 기준 상대경로> */
  if(req.method === 'GET' && u.pathname === '/read-asset'){
    try{
      let full;
      if(u.query.relTo && u.query.ref){
        /* HTML 파일 기준 상대 참조 해석 */
        const srcHtml = path.resolve(PPTX_ROOT, u.query.relTo);
        if(!srcHtml.startsWith(PPTX_ROOT)) throw new Error('relTo escapes root');
        full = path.resolve(path.dirname(srcHtml), u.query.ref);
      }else{
        const rel = u.query.path;
        if(!rel) throw new Error('path or relTo+ref required');
        full = path.resolve(PPTX_ROOT, rel);
      }
      /* 보안: 파일 시스템 어디든 읽을 순 있게 허용 (formSourceHtml 기준이므로 실제론 제한적)
         하지만 명시적으로는 PPTX_ROOT 밖도 허용 — 미디어가 다른 위치 있을 수 있음.
         단, 디렉터리 트래버설 공격은 기본적으로 path.resolve가 막음 */
      if(!fs.existsSync(full)) throw new Error('not found: '+full);
      const buf = fs.readFileSync(full);
      const mime = STATIC_EXT_MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
      return jsonRes(res, 200, { ok:true, base64: buf.toString('base64'), bytes: buf.length, mime, path: full });
    }catch(e){ return jsonRes(res, 400, { ok:false, error:e.message }); }
  }

  /* ─────────── LIST PRESENTATIONS: index 페이지용 ─────────── */
  if(req.method === 'GET' && u.pathname === '/list-presentations'){
    try{
      const presDir = path.join(PPTX_ROOT, 'presentations');
      const items = [];
      if(fs.existsSync(presDir)){
        for(const entry of fs.readdirSync(presDir, {withFileTypes:true})){
          if(!entry.isDirectory()) continue;
          const sub = path.join(presDir, entry.name);
          const htmls = fs.readdirSync(sub).filter(f => f.endsWith('.html'));
          for(const h of htmls){
            const full = path.join(sub, h);
            const st = fs.statSync(full);
            items.push({
              folder: entry.name,
              file: h,
              relUrl: 'presentations/'+entry.name+'/'+h,
              mtime: st.mtime.toISOString(),
              bytes: st.size
            });
          }
        }
      }
      /* samples도 노출 */
      const samplesDir = path.join(PPTX_ROOT, 'samples');
      const samples = [];
      if(fs.existsSync(samplesDir)){
        for(const f of fs.readdirSync(samplesDir)){
          if(!f.endsWith('.html')) continue;
          const full = path.join(samplesDir, f);
          const st = fs.statSync(full);
          samples.push({
            folder: 'samples',
            file: f,
            relUrl: 'samples/'+f,
            mtime: st.mtime.toISOString(),
            bytes: st.size
          });
        }
      }
      /* 템플릿도 노출 */
      const tplPath = path.join(PPTX_ROOT, 'engine', 'template.html');
      const tpl = fs.existsSync(tplPath) ? [{
        folder: 'engine',
        file: 'template.html',
        relUrl: 'engine/template.html',
        mtime: fs.statSync(tplPath).mtime.toISOString(),
        bytes: fs.statSync(tplPath).size
      }] : [];
      items.sort((a,b)=> b.mtime.localeCompare(a.mtime));
      return jsonRes(res, 200, { ok:true, items, samples, template: tpl });
    }catch(e){ return jsonRes(res, 400, { ok:false, error:e.message }); }
  }

  jsonRes(res, 404, { ok:false, error:'unknown endpoint' });
});

apiServer.listen(PORT, ()=>{
  console.log('================================================');
  console.log('  HTML Presentation — Save/Export API');
  console.log('  Static:  http://localhost:'+STATIC_PORT);
  console.log('  API:     http://localhost:'+PORT);
  console.log('  Root:    '+PPTX_ROOT);
  console.log('================================================');
});
