#!/bin/bash
# run_daily_summary.sh — wrapper for the daily summary pipeline.
# Usage: bash scripts/run_daily_summary.sh <platform> <mode>
#   platform: shopee | lazada
#   mode: morning | evening

set -euo pipefail

PLATFORM="$1"
MODE="${2:-morning}"
CHANNEL="${3:--1004450247696}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

case "$PLATFORM" in
  shopee) SCRIPT="$REPO_DIR/scripts/shopee_daily_summary.py" ;;
  lazada) SCRIPT="$REPO_DIR/scripts/lazada_daily_summary.py" ;;
  *) echo "Unknown platform: $PLATFORM" >&2; exit 1 ;;
esac

python3 "$SCRIPT" --mode "$MODE" --channel "$CHANNEL" | bun run "$REPO_DIR/scripts/post_daily_update.ts" >/dev/null 2>&1
