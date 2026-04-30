# Agent Rules — Read First

## Session Context — Read Next

- After this file, read `PROJECT_CONTEXT.md` in the repository root before planning or editing.
- `PROJECT_CONTEXT.md` is the rolling handoff for the current project state, recent major changes, and user workflow preferences.

## Current Editor Source Only

- Work on the split editor modules under `engine/editor/`.
- Do not implement new behavior in `engine/editor.js`.
- Treat `engine/editor.js` as a legacy monolithic reference/rollback file only.
- If a change appears to require editing `engine/editor.js`, first check whether the active template or current presentation actually loads it. For current work, it should not be part of the implementation path.

## Active Editor Files

- `engine/editor/editor.core.js`
- `engine/editor/editor.block.js`
- `engine/editor/editor.io.js`
- `engine/editor/editor.main.js`
- Shared supporting files such as `engine/engine.css`, `engine/presentation.js`, and `engine/panel-context.js` when directly relevant.

## Legacy Boundary

`engine/editor.js` exists for old decks and rollback comparison. It is not the source of truth for current development.
