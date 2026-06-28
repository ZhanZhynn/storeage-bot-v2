#!/bin/bash
# run_item_performance_monitor.sh — wrapper for the item performance monitor pipeline.
# Usage: bash scripts/run_item_performance_monitor.sh [channel] [platform]
#   channel: Telegram chat ID (default: -1004450247696)
#   platform: shopee, lazada, or both (default: both)

set -euo pipefail

usage() {
  echo "Usage: $0 [channel] [platform]"
  echo ""
  echo "Item Performance Monitor — SKU-level sales classification"
  echo ""
  echo "Arguments:"
  echo "  channel    Telegram chat ID (default: -1004450247696)"
  echo "  platform   shopee, lazada, or both (default: both)"
  echo ""
  echo "Examples:"
  echo "  $0                                  # Both platforms to default channel"
  echo "  $0 -1004450247696 shopee            # Shopee only to specific channel"
  echo "  $0 -1004450247696 lazada            # Lazada only"
  echo "  $0 -1004450247696 both              # Both platforms"
  echo ""
  echo "Output:"
  echo "  - Telegram message: summary table with categories"
  echo "  - Telegram file: Excel spreadsheet with full SKU details"
  echo ""
  echo "Categories:"
  echo "  🦸 Hero Product   Top 20% by sales volume"
  echo "  📈 Potential      Velocity increased >30% vs previous period"
  echo "  📉 Falling Behind Velocity dropped >30% vs previous period"
  echo "  💀 Dead Stock     Zero sales in last 28 days"
  echo "  ✅ Stable         Default category"
  exit 0
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

CHANNEL="${1:--1004450247696}"
PLATFORM="${2:-both}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

python3 "$REPO_DIR/scripts/item_performance_monitor.py" --channel "$CHANNEL" --platform "$PLATFORM" \
  | bun run "$REPO_DIR/scripts/post_daily_update.ts" >/dev/null 2>&1
