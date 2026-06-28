# Item Performance Monitor — Implementation Plan

## Overview
Build a daily SKU performance monitoring system that classifies products into categories (Dead Stock, Falling Behind, Potential, Hero) and delivers a summary table + Excel file to Telegram.

---

## Architecture

```
┌─────────────────────┐     JSON + Excel     ┌──────────────────────┐
│  Python Script       │ ───────────────────► │  TypeScript Poster    │
│  (data + analysis)   │                      │  (Telegram upload)    │
└─────────────────────┘                      └──────────────────────┘
        │                                            │
        ├── Shopee API (products, orders)            ├── sendMessage (table)
        └── Lazada API (products, orders)            └── sendDocument (Excel)
```

**Pattern:** Follows existing alert pipeline — Python script pipes JSON to `post_daily_update.ts`.

---

## Files to Create

### 1. `scripts/item_performance_monitor.py` (main script)

**Responsibilities:**
- Fetch all active products from Shopee + Lazada
- Fetch orders for two periods:
  - **Current period**: last 14 days
  - **Previous period**: 14–28 days ago
- Aggregate sales per SKU (quantity sold)
- Compute per-SKU metrics:
  - `current_sold` — units sold in current period
  - `previous_sold` — units sold in previous period
  - `velocity` — `current_sold / 14` (daily rate)
  - `trend_pct` — `((current - previous) / previous) * 100` (or `∞` / `-100%`)
  - `stock` — current available stock
  - `stockout_days` — `stock / velocity` (if velocity > 0)

**Classification logic (per SKU):**

| Category         | Rule                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| Dead Stock       | `current_sold == 0` AND `previous_sold == 0` (zero sales in 28 days) |
| Falling Behind   | `trend_pct < -30%` (velocity dropped >30%)                           |
| Potential/Gaining | `trend_pct > +30%` (velocity increased >30%)                        |
| Hero Product     | Top 20% by `current_sold` volume (among all SKUs with sales)         |
| Stable           | Everything else (default)                                             |

**Priority order:** A SKU can only be in one category. Apply in this order:
1. Dead Stock (overrides all)
2. Hero Product (if also gaining, show as Hero)
3. Falling Behind
4. Potential/Gaining
5. Stable

**Output JSON contract** (stdout):
```json
{
  "ok": true,
  "platform": "shopee+lazada",
  "channel": "-1004450247696",
  "text": "Item Performance Report — June 28, 2026",
  "blocks": [...],
  "excel_path": "/tmp/item_performance_2026-06-28.xlsx",
  "summary": {
    "total_skus": 150,
    "hero": 12,
    "potential": 8,
    "falling_behind": 5,
    "dead_stock": 22,
    "stable": 103
  }
}
```

**CLI arguments:**
- `--channel` — Telegram chat ID (default: `-1004450247696`)
- `--days` — Lookback window (default: 14)
- `--platform` — `shopee`, `lazada`, or `both` (default: `both`)
- `--top-pct` — Top % for hero classification (default: 20)

**Key functions to implement:**
```python
# Data fetching
def fetch_shopee_performance(days: int) -> dict[str, SKURecord]
def fetch_lazada_performance(days: int) -> dict[str, SKURecord]

# Classification
def classify_skus(records: dict[str, SKURecord], top_pct: int = 20) -> list[ClassifiedSKU]

# Output
def build_markdown_table(classified: list[ClassifiedSKU]) -> str
def build_excel(classified: list[ClassifiedSKU], path: str) -> str
def build_telegram_blocks(classified: list[ClassifiedSKU], summary: dict) -> list[dict]
```

**SKU Record dataclass:**
```python
@dataclass
class SKURecord:
    platform: str          # "shopee" | "lazada"
    item_id: str
    sku_id: str
    sku_name: str
    product_name: str
    stock: int
    current_sold: int
    previous_sold: int
    velocity: float
    trend_pct: float | None
    stockout_days: float | None
```

**Markdown table format:**
```
📊 Item Performance Report — June 28, 2026

🦸 Hero Products (12)
| SKU | Product | Platform | Sold (14d) | Trend | Stock | Stockout |
|-----|---------|----------|------------|-------|-------|----------|
| Red/L | T-Shirt | Shopee | 85 | +42% | 120 | 20d |
...

📈 Potential / Gaining (8)
| SKU | Product | Platform | Sold (14d) | Trend | Stock | Stockout |
|-----|---------|----------|------------|-------|-------|----------|
| Blue/M | Pants | Lazada | 28 | +65% | 45 | 23d |
...

📉 Falling Behind (5)
| SKU | Product | Platform | Sold (14d) | Trend | Stock | Stockout |
|-----|---------|----------|------------|-------|-------|----------|
| Black/S | Jacket | Shopee | 3 | -55% | 80 | — |
...

💀 Dead Stock (22)
| SKU | Product | Platform | Last Sold | Stock |
|-----|---------|----------|-----------|-------|
| White/XL | Hat | Shopee | 32d ago | 15 |
...

✅ Stable (103)
_No items in this category shown by default._
```

---

### 2. `scripts/run_item_performance_monitor.sh` (shell wrapper)

```bash
#!/usr/bin/env bash
set -euo pipefail
CHANNEL="${1:--1004450247696}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$REPO_DIR/scripts/item_performance_monitor.py" --channel "$CHANNEL" \
  | bun run "$REPO_DIR/scripts/post_daily_update.ts" >/dev/null 2>&1
```

---

## Files to Modify

### 3. `scripts/post_daily_update.ts` — Add file upload support

**Changes:**
- In `postToTelegram()`: after sending the text message, check if `excel_path` is present in the JSON payload
- If present and file exists, call `uploadTelegramFile()` to send the Excel as a document
- Add a caption with the report title

**Key addition:**
```typescript
// After sendMessage succeeds
if (payload.excel_path) {
  const fs = require("fs");
  if (fs.existsSync(payload.excel_path)) {
    await uploadTelegramFile({
      botToken,
      chatId: channelId,
      filePath: payload.excel_path,
      filename: path.basename(payload.excel_path),
      caption: payload.text || "Item Performance Report",
    });
  }
}
```

---

### 4. `platform_helpers/setup.py` — Add openpyxl dependency

Add `openpyxl>=3.1.0` to `install_requires`.

---

## Cron Schedule

Add to existing cron seed script or create new:

| Title                  | Schedule        | Channel              | Description                    |
| ---------------------- | --------------- | -------------------- | ------------------------------ |
| Item Performance Report | 09:00 AM daily | Telegram `-1004450247696` | Daily SKU performance analysis |

---

## Implementation Order

1. Install `openpyxl` in the Python venv
2. Create `scripts/item_performance_monitor.py` with:
   - Shopee data fetching (reuse `safe_run` pattern from existing scripts)
   - Lazada data fetching (reuse `safe_run` pattern)
   - Sales aggregation and velocity computation
   - Classification logic
   - Markdown table generation
   - Excel generation
   - JSON output
3. Modify `scripts/post_daily_update.ts` to support file uploads
4. Create `scripts/run_item_performance_monitor.sh`
5. Test with `--platform shopee` and `--platform lazada` individually, then `both`
6. Add cron job

---

## Testing Strategy

1. **Unit test classification logic** — mock SKU records, verify correct category assignment
2. **Dry run** — run script with `--channel` to a test Telegram chat
3. **Verify Excel output** — open generated file, check formatting and data
4. **Cron test** — schedule a one-time test run via `ode task create`
