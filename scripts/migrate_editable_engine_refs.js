#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targets = process.argv.slice(2);

if (!targets.length) {
  console.error('Usage: node scripts/migrate_editable_engine_refs.js <deck.html> [...]');
  process.exit(2);
}

const engineScripts = [
  'presentation.js',
  'panel-context.js',
  'editor/editor.core.js',
  'editor/editor.block.js',
  'editor/editor.io.js',
  'editor/editor.main.js',
];

const inlineMarkers = [
  'PRESENTATION ENGINE',
  'panel-context.js',
  'editor.core.js',
  'editor.block.js',
  'editor.io.js',
  'editor.main.js',
];

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

function engineBaseForFile(absFile) {
  const rel = toPosix(path.relative(root, absFile));
  const dir = path.posix.dirname(rel);
  const parts = dir === '.' ? [] : dir.split('/').filter(Boolean);
  if (parts[0] === 'engine') return '../'.repeat(Math.max(0, parts.length - 1));
  return '../'.repeat(parts.length) + 'engine/';
}

function scriptSrc(attrs) {
  const m = attrs.match(/\bsrc\s*=\s*(['"])(.*?)\1/i);
  return m ? m[2] : '';
}

function isEngineScript(attrs, body) {
  const src = toPosix(scriptSrc(attrs).toLowerCase());
  if (src) {
    return src.endsWith('/presentation.js') ||
      src.endsWith('presentation.js') ||
      src.endsWith('/panel-context.js') ||
      src.endsWith('panel-context.js') ||
      src.endsWith('/editor.js') ||
      src.endsWith('editor.js') ||
      src.includes('/editor/editor.');
  }
  return body.includes('window.EA=') ||
    body.includes('function _buildSaveHTML') ||
    body.includes('async function save(') ||
    inlineMarkers.some(marker => body.includes(marker));
}

function isEngineStyle(body) {
  return body.includes('SLIDE ENGINE') ||
    (body.includes('.slide-frame') &&
     body.includes('.ed-nav') &&
     body.includes('body.editor-mode'));
}

function migrateFile(file) {
  const abs = path.resolve(root, file);
  let html = fs.readFileSync(abs, 'utf8');
  const before = html;
  const base = engineBaseForFile(abs);

  html = html.replace(/<meta\s+name=(["'])engine-mode\1[^>]*>\s*/gi, '');
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    return isEngineScript(attrs || '', body || '') ? '' : full;
  });
  html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, body) => {
    return isEngineStyle(body || '') ? '' : full;
  });
  html = html.replace(/<link\b[^>]+rel=(["'])stylesheet\1[^>]+href=(["'])[^"']*(?:engine\/engine\.css|\/engine\.css|engine\.css)\2[^>]*>\s*/gi, '');

  const cssHref = base + 'engine.css';
  const cssTag = `<link rel="stylesheet" href="${cssHref}">\n`;
  const styleIdx = html.search(/<style\b/i);
  if (styleIdx >= 0) html = html.slice(0, styleIdx) + cssTag + html.slice(styleIdx);
  else html = html.replace(/<\/head>/i, cssTag + '</head>');

  const scriptTags = engineScripts.map(src => `<script src="${base + src}"></script>`).join('\n') + '\n';
  html = html.replace(/<\/body>/i, scriptTags + '</body>');

  if (html !== before) {
    fs.writeFileSync(abs, html, 'utf8');
    console.log(`migrated ${toPosix(path.relative(root, abs))}`);
  } else {
    console.log(`unchanged ${toPosix(path.relative(root, abs))}`);
  }
}

targets.forEach(migrateFile);
