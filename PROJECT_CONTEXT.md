# PROJECT_CONTEXT

This is the first follow-up document to read after `AGENTS.md`.

## Repository Shape

- GitHub repository: `vex-engine/apps`
- Current branch: `pptx`
- `main` is the remote default branch and should remain in place.
- This repository is intended to hold multiple apps over time. A future structural migration may place this project under an actual `pptx/` folder, but the current local project root is still the PPTX app itself.

## Current Editor Source

- Active editor code lives under `engine/editor/`.
- Do not add new editor behavior to `engine/editor.js`; it is a legacy monolithic reference only.
- Load order remains: `presentation.js`, `panel-context.js`, `editor.core.js`, `editor.block.js`, `editor.io.js`, `editor.main.js`.

## Recent Major Changes

- Branch renamed from `codex/push-current-work` to `pptx`; remote `origin/pptx` now tracks the local branch.
- Edit canvas zoom and pan support was added through `pAPI.zoomEditViewAt`, `pAPI.panEditViewBy`, and `pAPI.editView`.
- Object move/duplicate logic now includes shared snapping, shift-axis locking, and selected-only handle behavior.
- Media drag/drop from Windows Explorer was corrected to place images/videos around the actual mouse drop point. The fix avoids relying on CSS transforms because editor mode forces `[data-step]` transforms to `none`.
- Save As / Export code was simplified in this working tree; check `engine/editor/editor.io.js` carefully before changing persistence behavior.
- Server/index code now exposes and displays Git metadata when available.
- A new presentation copy exists under `presentations/미드저니_나노바나나_그록_활용2/`, with related media assets.

## Known Pitfalls

- In editor mode, `body.editor-mode [data-step]{ transform:none!important }` overrides transforms on media wrappers because media wrappers also receive `data-step`.
- For drop placement, compute `left/top` directly from the loaded media size rather than using `translate(-50%, -50%)`.
- Keep `apps` as the repository name. Do not rename the repository when the user asks about the PPTX project name.
- `ㄱㄱ` means the user wants the previously discussed plan executed immediately.
- The user may say "형"; concise Korean explanations are preferred for workflow clarification.

## Verification

- Preferred engine check: `bash scripts/verify_engine.sh`
- Minimal JavaScript check when editing one file: `node --check <file>`
- Last known full verification after media drop fix: `bash scripts/verify_engine.sh` passed `ALL GREEN`.
