#!/bin/bash
# run_lazada_sla_alert.sh — wrapper for the Lazada near-SLA alert pipeline.
# Usage: bash scripts/run_lazada_sla_alert.sh [channel]
#   channel: Telegram chat ID (default: -1004450247696)

set -euo pipefail

CHANNEL="${1:--1004450247696}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

python3 "$REPO_DIR/scripts/lazada_near_sla_alert.py" --channel "$CHANNEL" \
  | bun run "$REPO_DIR/scripts/post_daily_update.ts" >/dev/null 2>&1
