#!/bin/bash
# run_price_discrepancy_alert.sh — wrapper for the Shopee price discrepancy alert pipeline.
# Usage: bash scripts/run_price_discrepancy_alert.sh [channel]
#   channel: Channel ID (default: -1004450247696)

set -euo pipefail

CHANNEL="${1:--1004450247696}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

python3 "$REPO_DIR/scripts/shopee_price_discrepancy_alert.py" --channel "$CHANNEL" \
  | bun run "$REPO_DIR/scripts/post_daily_update.ts" >/dev/null 2>&1
