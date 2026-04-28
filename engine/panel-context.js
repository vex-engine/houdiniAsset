/* ============================================================
   panel-context.js — 피그마 스타일 Context 전환 패널
   ------------------------------------------------------------
   · Selected target(없음/Text/이미지/영상/다중)에 따라
     <aside class="ed-panel"> 내용을 동적으로 교체한다.
   · editor.js 는 거의 손대지 않고, _setSel() 끝에 1줄
     PanelCtx.refresh() 호출만 하면 타이밍이 가장 정확하다.
   · 호출이 없어도 mouseup / click / keyup / MutationObserver로 자동 갱신.
   · 모든 EA.* 호출은 EA.fn && EA.fn() 패턴으로 안전.
   ============================================================ */
(function(){
  'use strict';
  if(window.PanelCtx){ return; }

  /* ---------- 섹션 마크업 ---------- */

  const SEC_MEDIA = ''
  + '<div class="ed-section"><div class="ed-section-title">Media</div>'
  + '  <button class="ed-btn" onclick="EA.insertImage&&EA.insertImage()"><span class="ed-btn-icon">🖼</span>Image (File)</button>'
  + '  <button class="ed-btn" onclick="EA.insertImageURL&&EA.insertImageURL()"><span class="ed-btn-icon">🔗</span>Image (URL)</button>'
  + '  <button class="ed-btn" onclick="EA.insertVideo&&EA.insertVideo()"><span class="ed-btn-icon">🎬</span>Video (YouTube)</button>'
  + '  <button class="ed-btn" onclick="EA.insertVideoFile&&EA.insertVideoFile()"><span class="ed-btn-icon">📁</span>Video (File)</button>'
  + '</div>';

  const SEC_ALIGN = ''
  + '<div class="ed-section"><div class="ed-section-title">Align</div>'
  + '  <div class="ed-align-row"><button onclick="EA.alignEl&&EA.alignEl(\'left\')">← L</button><button onclick="EA.alignEl&&EA.alignEl(\'centerH\')">↔ Center</button><button onclick="EA.alignEl&&EA.alignEl(\'right\')">R →</button></div>'
  + '  <div class="ed-align-row" style="margin-top:4px"><button onclick="EA.alignEl&&EA.alignEl(\'top\')">↑ T</button><button onclick="EA.alignEl&&EA.alignEl(\'centerV\')">↕ Mid</button><button onclick="EA.alignEl&&EA.alignEl(\'bottom\')">B ↓</button></div>'
  + '</div>';

  const SEC_LAYER = ''
  + '<div class="ed-section"><div class="ed-section-title">Layer</div>'
  + '  <div style="display:flex;gap:5px">'
  + '    <button class="ed-btn" style="flex:1;text-align:center" onclick="EA.zIndex&&EA.zIndex(1)">↑ Front</button>'
  + '    <button class="ed-btn" style="flex:1;text-align:center" onclick="EA.zIndex&&EA.zIndex(-1)">↓ Back</button>'
  + '  </div>'
  + '</div>';

  const SEC_BG = ''
  + '<div class="ed-section"><div class="ed-section-title">Slide BG</div>'
  + '  <div style="display:flex;gap:6px;align-items:center">'
  + '    <input type="color" id="edSlideBg" value="#000000" onchange="EA.setSlideBg&&EA.setSlideBg(this.value)" style="width:28px;height:28px;border:none;background:none;cursor:pointer">'
  + '    <button class="ed-btn" style="flex:1;text-align:center" onclick="EA.setSlideBg&&EA.setSlideBg(\'#000000\')">Default (Black)</button>'
  + '  </div>'
  + '</div>';

  const SEC_GRID = ''
  + '<div class="ed-section"><div class="ed-section-title">Grid</div>'
  + '  <div class="ed-grid-row"><label>Size</label><input class="ed-grid-input" id="edGridSize" value="50" onchange="EA.updateGrid&&EA.updateGrid()"><label>px</label></div>'
  + '  <div class="ed-grid-row"><label>Color</label><input type="color" id="edGridColor" value="#3ECF8E" onchange="EA.updateGrid&&EA.updateGrid()" style="width:24px;height:24px;border:none;background:none;cursor:pointer"></div>'
  + '  <div class="ed-grid-row"><label>Alpha</label><input type="range" id="edGridAlpha" min="1" max="30" value="6" oninput="EA.updateGrid&&EA.updateGrid()" style="flex:1;cursor:pointer"><span id="edGridAlphaVal" style="font-size:11px;color:#bbb;min-width:24px">6%</span></div>'
  + '</div>';

  const SEC_ANIM = ''
  + '<div class="ed-section"><div class="ed-section-title">Animation</div>'
  + '  <div class="ed-anim-row">'
  + '    <select id="edAnimPreset">'
  + '      <option value="">-- Preset --</option>'
  + '      <optgroup label="Jiggle">'
  + '        <option value="jiggle-slow">Jiggle — Slow</option>'
  + '        <option value="jiggle-mid">Jiggle — Mid</option>'
  + '        <option value="jiggle-fast">Jiggle — Fast</option>'
  + '      </optgroup>'
  + '      <optgroup label="Blink">'
  + '        <option value="blink-slow">Blink — Slow</option>'
  + '        <option value="blink-mid">Blink — Mid</option>'
  + '        <option value="blink-fast">Blink — Fast</option>'
  + '      </optgroup>'
  + '      <optgroup label="Pulse">'
  + '        <option value="pulse-slow">Pulse — Slow</option>'
  + '        <option value="pulse-mid">Pulse — Mid</option>'
  + '        <option value="pulse-fast">Pulse — Fast</option>'
  + '      </optgroup>'
  + '    </select>'
  + '  </div>'
  + '  <div class="ed-anim-row">'
  + '    <button class="ed-anim-apply" onclick="EA.applyAnim&&EA.applyAnim(\'block\')">Apply Block</button>'
  + '    <button class="ed-anim-apply" onclick="EA.applyAnim&&EA.applyAnim(\'sel\')">Apply Selection</button>'
  + '    <button class="ed-anim-remove" onclick="EA.removeAnim&&EA.removeAnim()">Remove</button>'
  + '    <button class="ed-anim-reset" onclick="EA.resetAnim&&EA.resetAnim()" title="Restore original text state">Reset</button>'
  + '  </div>'
  + '</div>';

  const SEC_BLOCK_ADD = ''
  + '<div class="ed-section"><div class="ed-section-title">Add Block</div>'
  + '  <div style="display:flex;gap:4px;flex-wrap:wrap">'
  + '    <button class="ed-btn" style="flex:1;min-width:60px" onclick="EA.insertBlock&&EA.insertBlock(\'text\')">+ Text</button>'
  + '    <button class="ed-btn" style="flex:1;min-width:60px" onclick="EA.insertBlock&&EA.insertBlock(\'heading\')">+ Heading</button>'
  + '    <button class="ed-btn" style="flex:1;min-width:60px" onclick="EA.insertBlock&&EA.insertBlock(\'card\')">+ Card</button>'
  + '  </div>'
  + '  <div style="display:flex;gap:4px;margin-top:4px">'
  + '    <button class="ed-btn" style="flex:1" onclick="EA.groupSelection&&EA.groupSelection()" title="Ctrl+G">⊟ Group</button>'
  + '    <button class="ed-btn" style="flex:1" onclick="EA.ungroupSelection&&EA.ungroupSelection()" title="Ctrl+Shift+G">⊡ Ungroup</button>'
  + '  </div>'
  + '  <button class="ed-btn" style="width:100%;margin-top:4px" onclick="EA.resetPosition&&EA.resetPosition()" title="Ctrl+0">⟲ Reset Position</button>'
  + '</div>';

  const SEC_MOVE_HINT = ''
  + '<div class="ed-section"><div class="ed-section-title">Shortcuts</div>'
  + '  <div style="font-size:12px;color:#bbb;line-height:1.6;padding:6px 0">'
  + '    <div>• <b style="color:#3ECF8E">Drag</b>: Move / <b style="color:#3ECF8E">Alt + Drag</b>: Duplicate</div>'
  + '    <div>• <b style="color:#3ECF8E">Arrows</b>: 1px / Shift: 10px</div>'
  + '    <div>• <b style="color:#3ECF8E">Double-click</b>: Edit</div>'
  + '    <div>• <b style="color:#3ECF8E">Shift+Click</b>: Multi-select</div>'
  + '    <div>• <b style="color:#3ECF8E">ESC</b>: Step Back</div>'
  + '  </div>'
  + '</div>';

  const SEC_DUPE_DEL = ''
  + '<div class="ed-section"><div class="ed-section-title">Selection</div>'
  + '  <div style="display:flex;gap:5px">'
  + '    <button class="ed-btn" style="flex:1;text-align:center" onclick="EA.duplicateEl&&EA.duplicateEl()" title="Ctrl+D"><span class="ed-btn-icon">⊕</span>Duplicate</button>'
  + '    <button class="ed-btn danger" style="flex:1;text-align:center" onclick="EA.deleteElement&&EA.deleteElement()"><span class="ed-btn-icon">🗑</span>Delete</button>'
  + '  </div>'
  + '</div>';

  const SEC_TEXT_HINT = ''
  + '<div class="ed-section"><div class="ed-section-title" style="color:#3ECF8E">📝 Text Selected</div>'
  + '  <div style="font-size:12px;color:#bbb;line-height:1.5;padding:4px 0">Double-click to edit</div>'
  + '</div>';

  /* Text 에디터 — 핵심 (펼친 상태). B/I, 정렬, Size, Color 6개 */
  const SEC_TEXT_EDITOR = ''
  + '<div class="ed-section"><div class="ed-section-title">Text</div>'
  + '  <div style="display:flex;gap:4px;margin-bottom:6px">'
  + '    <button class="pc-tb" onclick="EA.execCmd&&EA.execCmd(\'bold\')" title="Bold"><b>B</b></button>'
  + '    <button class="pc-tb" onclick="EA.execCmd&&EA.execCmd(\'italic\')" title="Italic"><i>I</i></button>'
  + '    <div class="pc-sep"></div>'
  + '    <button class="pc-tb" onclick="EA.setAlign&&EA.setAlign(\'left\')" title="Left">◧</button>'
  + '    <button class="pc-tb" onclick="EA.setAlign&&EA.setAlign(\'center\')" title="Center">◫</button>'
  + '    <button class="pc-tb" onclick="EA.setAlign&&EA.setAlign(\'right\')" title="Right">◨</button>'
  + '  </div>'
  + '  <div class="pc-row" style="margin-bottom:6px">'
  + '    <button class="pc-mode-btn active" id="pcSizeBlock" onclick="EA.setSizeMode&&EA.setSizeMode(\'block\');this.classList.add(\'active\');document.getElementById(\'pcSizeSel\').classList.remove(\'active\')">Block</button>'
  + '    <button class="pc-mode-btn" id="pcSizeSel" onclick="EA.setSizeMode&&EA.setSizeMode(\'sel\');this.classList.add(\'active\');document.getElementById(\'pcSizeBlock\').classList.remove(\'active\')">Sel</button>'
  + '    <select class="pc-size-select" onchange="EA.setSize&&EA.setSize(this.value)">'
  + '      <option value="">Size</option>'
  + '      <option value="0.65rem">XS</option><option value="0.85rem">S</option>'
  + '      <option value="1.1rem">M</option><option value="1.5rem">L</option>'
  + '      <option value="2rem">XL</option><option value="3rem">2XL</option><option value="5rem">3XL</option>'
  + '    </select>'
  + '    <input class="pc-size-input" id="pcCustomSize" placeholder="px" onkeydown="if(event.key===\'Enter\')EA.setSize&&EA.setSize(this.value)">'
  + '  </div>'
  + '  <div id="pcPaletteTabs" style="display:flex;gap:3px;margin-bottom:6px">'
  + '    <button class="ed-palette-tab active" data-pal="green" onclick="EA.setPalette&&EA.setPalette(\'green\');PanelCtx._setPalTab(this)">Green</button>'
  + '    <button class="ed-palette-tab" data-pal="gold" onclick="EA.setPalette&&EA.setPalette(\'gold\');PanelCtx._setPalTab(this)">Gold</button>'
  + '    <button class="ed-palette-tab" data-pal="pink" onclick="EA.setPalette&&EA.setPalette(\'pink\');PanelCtx._setPalTab(this)">Pink</button>'
  + '    <button class="ed-palette-tab" data-pal="custom" onclick="EA.setPalette&&EA.setPalette(\'custom\');PanelCtx._setPalTab(this)">Custom</button>'
  + '  </div>'
  + '  <div class="ed-palette-swatches" id="pcSwatches" style="margin-bottom:6px"></div>'
  + '  <div style="display:flex;gap:6px;align-items:center">'
  + '    <input type="color" id="pcColorPicker" value="#3ECF8E" onchange="EA.setColor&&EA.setColor(this.value)" style="width:28px;height:28px;border:none;background:none;cursor:pointer;border-radius:50%">'
  + '    <div class="ed-gradient-bar" id="pcGradientBar" style="flex:1"></div>'
  + '  </div>'
  + '</div>';

  /* Text 에디터 — Advanced (접이식) */
  const SEC_TEXT_ADVANCED = ''
  + '<div class="ed-section collapsible collapsed" id="pcTextAdv">'
  + '  <div class="ed-section-title" onclick="this.parentNode.classList.toggle(\'collapsed\')">Advanced</div>'
  + '  <div class="ed-section-body">'
  + '    <div class="pc-row" style="margin-bottom:6px">'
  + '      <label class="pc-label">Line</label>'
  + '      <input class="pc-spacing-input" id="pcLineH" placeholder="1.8" onkeydown="if(event.key===\'Enter\')EA.setLineHeight&&EA.setLineHeight(this.value)">'
  + '      <label class="pc-label">Kern</label>'
  + '      <input class="pc-spacing-input" id="pcLetterS" placeholder="0" onkeydown="if(event.key===\'Enter\')EA.setLetterSpacing&&EA.setLetterSpacing(this.value)">'
  + '    </div>'
  + '    <div style="display:flex;gap:4px">'
  + '      <button class="ed-btn" style="flex:1;text-align:center;font-size:12px" onclick="EA.savePaletteFile&&EA.savePaletteFile()">Save .plt</button>'
  + '      <button class="ed-btn" style="flex:1;text-align:center;font-size:12px" onclick="EA.loadPaletteFile&&EA.loadPaletteFile()">Load .plt</button>'
  + '    </div>'
  + '  </div>'
  + '</div>';

  /* 자식 순차 등장 토글 */
  const SEC_ANIM_CHILDREN = ''
  + '<div class="ed-section" id="pcAnimChildrenSec"><div class="ed-section-title">Block Reveal</div>'
  + '  <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#e8e8e8;cursor:pointer;padding:4px 0">'
  + '    <input type="checkbox" id="edAnimChildren" onchange="EA.toggleAnimChildren&&EA.toggleAnimChildren(this.checked)" style="cursor:pointer">'
  + '    <span>Reveal children one-by-one</span>'
  + '  </label>'
  + '  <div id="pcAnimChildrenInfo" style="font-size:12px;color:#bbb;line-height:1.5;padding:4px 0 0 0">Direct children of the selected block appear one-by-one on scroll/space.</div>'
  + '</div>';

  const SEC_STEP_ORDER = ''
  + '<div class="ed-section"><div class="ed-section-title">Reveal Order</div>'
  + '  <div style="display:flex;gap:6px;align-items:center">'
  + '    <input type="number" class="pc-num-input" id="pcStepOrder" min="1" step="1" placeholder="Auto" oninput="EA.setStepOrder&&EA.setStepOrder(this.value)" onchange="EA.setStepOrder&&EA.setStepOrder(this.value)" onkeydown="if(event.key===\'Enter\')EA.setStepOrder&&EA.setStepOrder(this.value)">'
  + '    <button class="ed-btn" style="flex:1;text-align:center" onclick="var e=document.getElementById(\'pcStepOrder\');if(e)e.value=\'\';EA.setStepOrder&&EA.setStepOrder(\'\')">Auto</button>'
  + '  </div>'
  + '  <div style="font-size:11px;color:#aaa;line-height:1.4;padding-top:5px">Same number appears together.</div>'
  + '</div>';

  const SEC_IMG_PROPS = ''
  + '<div class="ed-section"><div class="ed-section-title" style="color:#3ECF8E">🖼 Image</div>'
  + '  <div style="font-size:12px;color:#bbb;line-height:1.6;padding:6px 0">'
  + '    Drag corner: Resize<br>'
  + '    Drag: Move<br>'
  + '    Alt + Drag: Duplicate'
  + '  </div>'
  + '</div>';

  const SEC_VIDEO_PROPS = ''
  + '<div class="ed-section"><div class="ed-section-title" style="color:#3ECF8E">🎬 Video</div>'
  + '  <button class="ed-btn" id="edBtnPlay" onclick="EA.toggleVideoPlay&&EA.toggleVideoPlay()" title="Click again to stop">▶ Play</button>'
  + '  <button class="ed-btn" id="edBtnAutoplay" onclick="EA.toggleVideoAutoplay&&EA.toggleVideoAutoplay()">Autoplay OFF</button>'
  + '  <button class="ed-btn" id="edBtnLoop" onclick="EA.toggleVideoLoop&&EA.toggleVideoLoop()">Loop OFF</button>'
  + '  <button class="ed-btn" id="edBtnMute" onclick="EA.toggleVideoMute&&EA.toggleVideoMute()">Mute OFF</button>'
  + '  <div style="font-size:12px;color:#bbb;line-height:1.5;padding:6px 0 0 0">💡 If panel hidden during playback, <b style="color:#3ECF8E">Double-click</b></div>'
  + '</div>';

  /* ✂ Crop — 이미지/영상 공용. 픽셀 절대값 4방향 + Scale */
  const SEC_CROP = ''
  + '<div class="ed-section pc-crop-panel"><div class="ed-section-title" style="color:#FFB300">✂ Crop</div>'
  + '  <div class="pc-help">프레임은 T/R/B/L px로 자르고, Scale은 미디어와 프레임을 함께 키웁니다.</div>'
  + '  <div class="pc-crop-grid">'
  + '    <label>Top <input type="number" class="pc-num-input" id="pcCropT" placeholder="0" min="0" step="1" oninput="PanelCtx._applyCrop()"></label>'
  + '    <label>Right <input type="number" class="pc-num-input" id="pcCropR" placeholder="0" min="0" step="1" oninput="PanelCtx._applyCrop()"></label>'
  + '    <label>Bottom <input type="number" class="pc-num-input" id="pcCropB" placeholder="0" min="0" step="1" oninput="PanelCtx._applyCrop()"></label>'
  + '    <label>Left <input type="number" class="pc-num-input" id="pcCropL" placeholder="0" min="0" step="1" oninput="PanelCtx._applyCrop()"></label>'
  + '  </div>'
  + '  <div class="pc-crop-scale">'
  + '    <div class="pc-crop-scale-head"><span>Scale</span><input type="number" class="pc-num-input" id="pcCropScale" value="1" step="0.05" min="0.1" max="8" oninput="PanelCtx._applyCropScale(this.value)"></div>'
  + '    <input type="range" id="pcCropScaleRange" min="0.1" max="4" step="0.05" value="1" oninput="PanelCtx._applyCropScale(this.value)">'
  + '  </div>'
  + '  <div class="pc-crop-actions">'
  + '    <button class="ed-btn" onclick="EA.resetCrop&&EA.resetCrop()"><span class="ed-btn-icon">↺</span>Reset Crop</button>'
  + '    <button class="ed-btn" onclick="EA.resetCropScale&&EA.resetCropScale()">Reset Scale</button>'
  + '  </div>'
  + '</div>';

  const SEC_MULTI_HINT = ''
  + '<div class="ed-section"><div class="ed-section-title" style="color:#3ECF8E">⊟ Multi-select</div>'
  + '  <div style="font-size:12px;color:#bbb;line-height:1.6;padding:6px 0" id="pcMultiCount">Multiple</div>'
  + '</div>';

  /* v2.1 — Group actions (Wrap as Card / Frame, Unwrap) */
  const SEC_GROUP_ACTIONS = ''
  + '<div class="ed-section"><div class="ed-section-title">Group</div>'
  + '  <div style="display:flex;gap:5px">'
  + '    <button class="ed-btn" style="flex:1;text-align:center" onclick="EA.wrapAsCard&&EA.wrapAsCard()" title="W"><span class="ed-btn-icon">⊟</span>Wrap in Card</button>'
  + '    <button class="ed-btn" style="flex:1;text-align:center" onclick="EA.wrapAsFrame&&EA.wrapAsFrame()" title="Shift+W"><span class="ed-btn-icon">⊡</span>Wrap in Frame</button>'
  + '  </div>'
  + '  <button class="ed-btn" style="width:100%;margin-top:4px" onclick="EA.unwrapBlock&&EA.unwrapBlock()" title="Ctrl+Shift+G"><span class="ed-btn-icon">↗</span>Unwrap</button>'
  + '</div>';

  /* v2.1 — Auto Layout (group 컨텍스트 전용) */
  const SEC_AUTO_LAYOUT = ''
  + '<div class="ed-section" id="pcAutoLayoutSec"><div class="ed-section-title">Auto Layout</div>'
  + '  <div class="pc-direction-row" style="margin-bottom:8px">'
  + '    <button id="pcLayH"   onclick="EA.setLayout&&EA.setLayout(\'h\');PanelCtx._refreshLayoutUI()">→ H</button>'
  + '    <button id="pcLayV"   onclick="EA.setLayout&&EA.setLayout(\'v\');PanelCtx._refreshLayoutUI()">↓ V</button>'
  + '    <button id="pcLayOff" onclick="EA.setLayout&&EA.setLayout(\'\');PanelCtx._refreshLayoutUI()">Off</button>'
  + '  </div>'
  + '  <div class="pc-row" style="margin-bottom:8px;display:flex;align-items:center;gap:6px">'
  + '    <label class="pc-label" style="min-width:30px;font-size:10px;color:#bbb">Gap</label>'
  + '    <input class="pc-num-input" id="pcGap" placeholder="0" onchange="EA.setGap&&EA.setGap(this.value)">'
  + '    <span style="font-size:10px;color:#888">px</span>'
  + '  </div>'
  + '  <div style="margin-bottom:6px;font-size:10px;color:#bbb;font-family:JetBrains Mono,monospace">PADDING</div>'
  + '  <div class="pc-pad-grid">'
  + '    <div><label>T</label><input class="pc-num-input" id="pcPadT" placeholder="0" onchange="PanelCtx._applyPad()"></div>'
  + '    <div><label>R</label><input class="pc-num-input" id="pcPadR" placeholder="0" onchange="PanelCtx._applyPad()"></div>'
  + '    <div><label>B</label><input class="pc-num-input" id="pcPadB" placeholder="0" onchange="PanelCtx._applyPad()"></div>'
  + '    <div><label>L</label><input class="pc-num-input" id="pcPadL" placeholder="0" onchange="PanelCtx._applyPad()"></div>'
  + '  </div>'
  + '  <div style="display:flex;gap:4px;margin-top:8px">'
  + '    <button class="ed-btn" style="flex:1;font-size:10px;text-align:center" onclick="EA.setLayoutAlign&&EA.setLayoutAlign(\'start\')">Start</button>'
  + '    <button class="ed-btn" style="flex:1;font-size:10px;text-align:center" onclick="EA.setLayoutAlign&&EA.setLayoutAlign(\'center\')">Center</button>'
  + '    <button class="ed-btn" style="flex:1;font-size:10px;text-align:center" onclick="EA.setLayoutAlign&&EA.setLayoutAlign(\'end\')">End</button>'
  + '    <button class="ed-btn" style="flex:1;font-size:10px;text-align:center" onclick="EA.setLayoutAlign&&EA.setLayoutAlign(\'stretch\')">Stretch</button>'
  + '  </div>'
  + '</div>';

  /* v2.1 — Component / Instance */
  const SEC_COMPONENT = ''
  + '<div class="ed-section"><div class="ed-section-title">Component</div>'
  + '  <button class="ed-btn" style="width:100%;text-align:center" onclick="EA.makeComponent&&EA.makeComponent()" title="Ctrl+Alt+K"><span class="ed-btn-icon">◇</span>Create Component</button>'
  + '  <button class="ed-btn" style="width:100%;margin-top:4px;text-align:center" onclick="EA.detachInstance&&EA.detachInstance()" title="Ctrl+Alt+B"><span class="ed-btn-icon">◈</span>Detach Instance</button>'
  + '</div>';

  /* v2.1 — Constraints */
  const SEC_CONSTRAINTS = ''
  + '<div class="ed-section collapsible collapsed"><div class="ed-section-title" onclick="this.parentNode.classList.toggle(\'collapsed\')">Constraints</div>'
  + '  <div class="ed-section-body">'
  + '    <div class="pc-row" style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
  + '      <label class="pc-label" style="min-width:18px;font-size:10px;color:#bbb">H</label>'
  + '      <select class="pc-size-select" id="pcConstrainH" onchange="EA.setConstraintH&&EA.setConstraintH(this.value)">'
  + '        <option value="left">Left</option><option value="center">Center</option>'
  + '        <option value="right">Right</option><option value="l-r">L+R</option><option value="scale">Scale</option>'
  + '      </select>'
  + '    </div>'
  + '    <div class="pc-row" style="display:flex;align-items:center;gap:6px">'
  + '      <label class="pc-label" style="min-width:18px;font-size:10px;color:#bbb">V</label>'
  + '      <select class="pc-size-select" id="pcConstrainV" onchange="EA.setConstraintV&&EA.setConstraintV(this.value)">'
  + '        <option value="top">Top</option><option value="center">Center</option>'
  + '        <option value="bottom">Bottom</option><option value="t-b">T+B</option><option value="scale">Scale</option>'
  + '      </select>'
  + '    </div>'
  + '  </div>'
  + '</div>';

  /* ---------- Context 조합 (v2.1: group 신설, multi에 GROUP 액션 추가) ---------- */
  const CONTEXTS = {
    none:  SEC_MEDIA + SEC_BG + SEC_GRID + SEC_BLOCK_ADD + SEC_MOVE_HINT,
    text:  SEC_TEXT_HINT + SEC_TEXT_EDITOR + SEC_TEXT_ADVANCED + SEC_STEP_ORDER + SEC_ANIM_CHILDREN + SEC_ANIM + SEC_ALIGN + SEC_LAYER + SEC_CONSTRAINTS + SEC_DUPE_DEL,
    image: SEC_IMG_PROPS + SEC_CROP + SEC_STEP_ORDER + SEC_ANIM_CHILDREN + SEC_ANIM + SEC_ALIGN + SEC_LAYER + SEC_CONSTRAINTS + SEC_DUPE_DEL,
    video: SEC_VIDEO_PROPS + SEC_CROP + SEC_STEP_ORDER + SEC_ANIM_CHILDREN + SEC_ANIM + SEC_ALIGN + SEC_LAYER + SEC_CONSTRAINTS + SEC_DUPE_DEL,
    multi: SEC_MULTI_HINT + SEC_STEP_ORDER + SEC_GROUP_ACTIONS + SEC_ALIGN + SEC_LAYER + SEC_DUPE_DEL,
    group: SEC_GROUP_ACTIONS + SEC_AUTO_LAYOUT + SEC_COMPONENT + SEC_STEP_ORDER + SEC_ANIM_CHILDREN + SEC_ALIGN + SEC_LAYER + SEC_CONSTRAINTS + SEC_DUPE_DEL
  };
  function detectContext(el, selBlocks, selBlock){
    try{
      const blocks = selBlocks || window._edSelBlocks || window.selBlocks || null;
      if(blocks && blocks.length > 1) return 'multi';
      const s = el || selBlock || window.sel || window.selBlock || null;
      if(!s) return 'none';
      /* v2.1: ed-group이면 group 컨텍스트 (Auto Layout / Component 노출) */
      if(s.classList && s.classList.contains('ed-group')) return 'group';
      if(s.classList && s.classList.contains('ed-media-wrap')){
        if(s.querySelector('img'))    return 'image';
        if(s.querySelector('video'))  return 'video';
        if(s.querySelector('iframe')) return 'video';
        return 'image';
      }
      return 'text';
    }catch(e){ return 'none'; }
  }

  let panelEl = null;
  let lastCtx = null;

  function getPanel(){
    if(panelEl && document.body.contains(panelEl)) return panelEl;
    panelEl = document.querySelector('aside.ed-panel');
    return panelEl;
  }

  function updateMultiCount(selBlocks){
    const blocks = selBlocks || window._edSelBlocks || window.selBlocks || [];
    const n = blocks.length || 0;
    const el = document.getElementById('pcMultiCount');
    if(el) el.textContent = n + ' selected';
  }

  /* 자식 순차 등장 체크박스 동기화 */
  function updateAnimChildrenUI(el){
    const cb = document.getElementById('edAnimChildren');
    const sec = document.getElementById('pcAnimChildrenSec');
    const info = document.getElementById('pcAnimChildrenInfo');
    if(!cb || !sec) return;
    const target = el || window.sel || window.selBlock || null;
    if(!target || !target.children || target.children.length < 2){
      cb.checked = false;
      cb.disabled = true;
      sec.style.opacity = '0.5';
      if(info) info.textContent = 'Requires 2+ direct children.';
      return;
    }
    cb.disabled = false;
    sec.style.opacity = '1';
    cb.checked = target.getAttribute('data-anim-children') === 'seq';
    if(info) info.textContent = '' + target.children.length + ' children will appear sequentially.';
  }
  function updateStepOrderUI(el, selBlocks){
    const input=document.getElementById('pcStepOrder');
    if(!input)return;
    const blocks=(selBlocks&&selBlocks.length)?selBlocks:null;
    if(blocks){
      const vals=blocks.map(b=>b.getAttribute&&b.getAttribute('data-sort')||'');
      const first=vals[0]||'';
      input.value=vals.every(v=>v===first)?first:'';
      input.placeholder=vals.every(v=>v===first)?'Auto':'Mixed';
      return;
    }
    const target=el||window.sel||window.selBlock||null;
    input.value=target&&target.getAttribute?target.getAttribute('data-sort')||'':'';
    input.placeholder='Auto';
  }
  function _paintGradient(bar){
    if(!bar)return;
    bar.style.height='14px';
    bar.style.borderRadius='4px';
    bar.style.cursor='crosshair';
    bar.style.background='linear-gradient(to right,#f00 0%,#f80 17%,#ff0 33%,#0f0 50%,#0ff 67%,#00f 83%,#f0f 100%)';
  }
  function _setPalTab(btn){
    const parent = btn.parentNode;
    if(!parent)return;
    parent.querySelectorAll('.ed-palette-tab').forEach(t=>t.classList.remove('active'));
    btn.classList.add('active');
  }

  /* v2.1 — Auto Layout UI 동기화: 현재 ed-group의 attribute를 패널 입력에 반영 */
  function _refreshLayoutUI(){
    if(!window.EA||!EA._readGroupAttrs)return;
    const a=EA._readGroupAttrs();
    if(!a)return;
    /* Direction 토글 active */
    ['pcLayH','pcLayV','pcLayOff'].forEach(id=>{const b=document.getElementById(id);if(b)b.classList.remove('active');});
    if(a.layout==='h')      { const x=document.getElementById('pcLayH'); if(x)x.classList.add('active'); }
    else if(a.layout==='v') { const x=document.getElementById('pcLayV'); if(x)x.classList.add('active'); }
    else                    { const x=document.getElementById('pcLayOff'); if(x)x.classList.add('active'); }
    /* Gap */
    const gap=document.getElementById('pcGap');
    if(gap)gap.value=a.gap||'';
    /* Padding (개별값 우선, 없으면 단축값) */
    const fall=a.pad||'';
    [['pcPadT',a.padT||fall],['pcPadR',a.padR||fall],['pcPadB',a.padB||fall],['pcPadL',a.padL||fall]].forEach(function(p){
      var id=p[0],v=p[1];
      const e=document.getElementById(id);if(e)e.value=v;
    });
    /* Constraints */
    const ch=document.getElementById('pcConstrainH'); if(ch)ch.value=a.constrainH||'left';
    const cv=document.getElementById('pcConstrainV'); if(cv)cv.value=a.constrainV||'top';
  }

  /* v2.1 — Padding grid의 4개 input → setPadding 호출 */
  function _applyPad(){
    if(!window.EA||!EA.setPadding)return;
    const t=document.getElementById('pcPadT')&&document.getElementById('pcPadT').value;
    const r=document.getElementById('pcPadR')&&document.getElementById('pcPadR').value;
    const b=document.getElementById('pcPadB')&&document.getElementById('pcPadB').value;
    const l=document.getElementById('pcPadL')&&document.getElementById('pcPadL').value;
    EA.setPadding(t,r,b,l);
  }

  /* ✂ Crop grid → EA.setCrop 호출 */
  function _applyCrop(){
    if(!window.EA||!EA.setCrop){console.warn('[crop] EA.setCrop not ready');return;}
    var get=function(id){var e=document.getElementById(id);return e?(parseInt(e.value,10)||0):0};
    var t=get('pcCropT'),r=get('pcCropR'),b=get('pcCropB'),l=get('pcCropL');
    EA.setCrop('t',t);
    EA.setCrop('r',r);
    EA.setCrop('b',b);
    EA.setCrop('l',l);
  }
  function _applyCropScale(v){
    if(!window.EA||!EA.setCropScale){console.warn('[crop] EA.setCropScale not ready');return;}
    var scale=parseFloat(v)||1;
    var n=document.getElementById('pcCropScale');
    var r=document.getElementById('pcCropScaleRange');
    if(n&&document.activeElement!==n)n.value=String(Math.round(scale*100)/100);
    if(r&&document.activeElement!==r)r.value=String(Math.min(4,Math.max(0.1,scale)));
    EA.setCropScale(scale);
  }

  /* 미디어 선택됐을 때 패널 입력값 동기화 */
  function _refreshCropUI(){
    if(!window.EA||!EA.readCrop)return;
    var c=EA.readCrop();if(!c)return;
    [['pcCropT',c.t],['pcCropR',c.r],['pcCropB',c.b],['pcCropL',c.l]].forEach(function(p){
      var e=document.getElementById(p[0]);if(e)e.value=(p[1]||'');
    });
    var scale=c.scale||1;
    var n=document.getElementById('pcCropScale');if(n)n.value=String(Math.round(scale*100)/100);
    var r=document.getElementById('pcCropScaleRange');if(r)r.value=String(Math.min(4,Math.max(0.1,scale)));
  }

  function render(ctx, selBlocks, el){
    const p = getPanel();
    if(!p) return;
    if(ctx === lastCtx){
      if(ctx === 'multi') updateMultiCount(selBlocks);
      if(ctx === 'multi' || ctx === 'text' || ctx === 'image' || ctx === 'video' || ctx === 'group') updateStepOrderUI(el, selBlocks);
      if(ctx === 'text' || ctx === 'image' || ctx === 'video' || ctx === 'group') updateAnimChildrenUI(el);
      if(ctx === 'group') _refreshLayoutUI();
      if(ctx === 'image' || ctx === 'video') _refreshCropUI();
      return;
    }
    p.innerHTML = CONTEXTS[ctx] || CONTEXTS.none;
    lastCtx = ctx;
    if(ctx === 'multi') updateMultiCount(selBlocks);
    if(ctx === 'multi' || ctx === 'text' || ctx === 'image' || ctx === 'video' || ctx === 'group') updateStepOrderUI(el, selBlocks);
    if(ctx === 'text' || ctx === 'image' || ctx === 'video' || ctx === 'group') updateAnimChildrenUI(el);
    if(ctx === 'group') _refreshLayoutUI();
    if(ctx === 'image' || ctx === 'video') _refreshCropUI();
    if(ctx === 'text'){
      _paintGradient(document.getElementById('pcGradientBar'));
      if(window._renderSw) window._renderSw();
    }
  }

  /* refresh(el, selBlocks, selBlock)
     editor.js _setSel 이 현재 Sel 상태를 그대로 넘겨준다.
     인자가 하나도 없이 호출된 경Right(보조 리스너 등)는 render 안 함 —
     editor.js의 sel/selBlocks는 IIFE 내부라 window 에서 못 읽어 잘못된 none 렌더가 덮어쓰는 문제 방지. */
  function refresh(el, selBlocks, selBlock){
    if(arguments.length === 0){
      // 보조 리스너로부터 인자 없이 호출된 경Right — 상태를 모르니 건드리지 말 것
      return;
    }
    render(detectContext(el, selBlocks, selBlock), selBlocks, el || selBlock);
  }

  /* bindListeners — 의도적으로 비활성화.
     editor.js _setSel 이 직접 refresh(el,...) 를 호출하므로 보조 리스너 불필요.
     mouseup/click 리스너는 editor.js Sel 상태가 설정된 뒤 호출돼도
     인자 없이 refresh 하면 window.sel이 IIFE 내부라 읽히지 않아
     항상 'none' 으로 덮어씀 → alt-Drag 점핑 원인도 여기였음. */
  function bindListeners(){
    // no-op (editor.js 호출만 신뢰)
  }

  function init(){
    if(!getPanel()) return setTimeout(init, 50);
    // 최초 로드 시 'none' 상태로 강제 렌더 (refresh 는 인자 있어야만 동작)
    render('none', null);
    bindListeners();
  }

  window.PanelCtx = {
    refresh: refresh,
    init: init,
    detectContext: detectContext,
    _setPalTab: _setPalTab,
    _refreshLayoutUI: _refreshLayoutUI,
    _applyPad: _applyPad,
    _applyCrop: _applyCrop,
    _applyCropScale: _applyCropScale,
    _refreshCropUI: _refreshCropUI,
    _version: '2.1'
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
