#!/usr/bin/env bash
# ============================================================
# verify_html.sh — compatibility wrapper
#
# Official verification lives in scripts/verify_engine.sh.
# Keep this file only so old handoff notes / muscle memory still work.
# ============================================================
set -e
cd "$(dirname "$0")/.."

echo "[deprecated] scripts/verify_html.sh delegates to scripts/verify_engine.sh"
exec bash scripts/verify_engine.sh
