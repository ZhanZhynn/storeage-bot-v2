#!/usr/bin/env python3
"""Shopee low stock + high sales alert (SKU-level).

Detects individual SKUs (models) that are selling fast but running low,
and projects when each will stock out.

Logic:
  1. Aggregate order quantities per (item_id, model_id) over the lookback window
  2. Rank items by total volume, keep top N%
  3. For each top item, fetch models and check each against thresholds:
     - stock < stock_threshold, OR
     - stock / daily_velocity < days_threshold

Usage:
    python3 scripts/shopee_low_stock_alert.py --channel C0B2QN88GSH
    python3 scripts/shopee_low_stock_alert.py --channel C0B2QN88GSH --days 14 --top-pct 20

Stdout contract:
    {"ok": true, "platform": "shopee", "channel": "...", "text": "...", "blocks": [...]}
    {"ok": false, "error": "..."}
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

MALAYSIA_TZ = timezone(timedelta(hours=8))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON_BIN = os.path.join(REPO_ROOT, ".venv", "bin", "python")
ITEM_FETCH_BATCH = 50


def _run_safe_run(platform: str, command_args: list[str]) -> dict:
    module = f"platform_helpers.{platform}.safe_run"
    cmd = [PYTHON_BIN, "-m", module, "--", *command_args]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=REPO_ROOT, timeout=300)
    if not result.stdout.strip():
        return {"ok": False, "error": result.stderr.strip() or f"empty stdout (exit={result.returncode})"}
    try:
        return json.loads(result.stdout.strip().splitlines()[-1])
    except json.JSONDecodeError as exc:
        return {"ok": False, "error": f"JSON parse error: {exc}; stdout={result.stdout[:200]!r}"}


def fetch_products(max_pages: int) -> dict:
    return _run_safe_run("shopee", ["products", "get", "--item-status", "NORMAL", "--page-size", "50", "--max-pages", str(max_pages)])


def fetch_orders(days: int, max_pages: int) -> dict:
    return _run_safe_run("shopee", ["orders", "get", "--days", str(days), "--max-pages", str(max_pages)])


def fetch_order_items(order_sns: list[str]) -> dict:
    if not order_sns:
        return {"ok": True, "items": []}
    all_items: list[dict] = []
    for i in range(0, len(order_sns), ITEM_FETCH_BATCH):
        batch = order_sns[i : i + ITEM_FETCH_BATCH]
        result = _run_safe_run("shopee", ["orders", "items", "--order-sn-list", ",".join(batch)])
        if not result.get("ok"):
            return result
        all_items.extend(result.get("items", []))
    return {"ok": True, "items": all_items}


def fetch_product_detail(item_id: int) -> dict:
    return _run_safe_run("shopee", ["products", "get-one", "--item-id", str(item_id)])


def aggregate_sales(items_data: dict) -> dict[tuple[int, int], dict]:
    """Aggregate sales per (item_id, model_id).

    Returns {(item_id, model_id): {"name": str, "sold": int}}.
    """
    sales: dict[tuple[int, int], dict] = {}
    for item in items_data.get("items", []):
        item_id = item.get("item_id")
        model_id = item.get("model_id")
        if item_id is None:
            continue
        key = (int(item_id), int(model_id) if model_id is not None else 0)
        quantity = int(item.get("model_quantity_purchased") or item.get("quantity", 0))
        name = item.get("model_name") or item.get("item_name") or ""
        if key not in sales:
            sales[key] = {"name": name, "sold": 0}
        sales[key]["sold"] += quantity
        # Prefer model_name over item_name
        if name and not sales[key]["name"]:
            sales[key]["name"] = name
    return sales


def compute_top_pct_cutoff(sales: dict[tuple[int, int], dict], top_pct: float) -> set[int]:
    """Aggregate to item level, then return top N% item_ids."""
    item_totals: dict[int, int] = defaultdict(int)
    for (item_id, _model_id), info in sales.items():
        item_totals[item_id] += info["sold"]

    if not item_totals:
        return set()

    sorted_items = sorted(item_totals.items(), key=lambda x: x[1], reverse=True)
    cutoff_index = max(1, math.ceil(len(sorted_items) * (top_pct / 100)))
    return {item_id for item_id, _ in sorted_items[:cutoff_index]}


def _extract_stock(entity: dict) -> int:
    """Extract available stock from stock_info_v2 or fallback to legacy field."""
    siv2 = entity.get("stock_info_v2")
    if isinstance(siv2, dict):
        summary = siv2.get("summary_info", {})
        if isinstance(summary, dict):
            return int(summary.get("total_available_stock", 0) or 0)
    return int(entity.get("stock") or 0)


def check_skus_for_item(
    item_id: int,
    sales: dict[tuple[int, int], dict],
    days: int,
    stock_threshold: int,
    days_threshold: float,
) -> tuple[dict, list[dict]]:
    """Fetch models for an item, check each SKU against thresholds.

    Returns (item_info, flagged_skus) where item_info has name/has_model
    and flagged_skus is a list of dicts for SKUs that triggered.
    """
    detail = fetch_product_detail(item_id)
    if not detail.get("ok"):
        return {}, []

    has_model = detail.get("has_model", False)
    base_info = detail.get("item_base_info", {})
    item_name = base_info.get("item_name", f"Item {item_id}")
    item_info = {"item_id": item_id, "name": item_name, "has_model": has_model}

    if not has_model:
        stock = _extract_stock(base_info)
        # Single-item product: model_id = 0
        total_sold = sales.get((item_id, 0), {}).get("sold", 0)
        velocity = total_sold / days if days > 0 else 0
        stockout_days = stock / velocity if velocity > 0 else None

        below_stock = stock < stock_threshold and total_sold > 0
        below_days = stockout_days is not None and stockout_days < days_threshold
        if below_stock or below_days:
            return item_info, [{
                "sku_name": "(single)",
                "stock": stock,
                "sold": total_sold,
                "velocity": velocity,
                "stockout_days": stockout_days,
                "below_stock": below_stock,
                "below_days": below_days,
            }]
        return item_info, []

    models = detail.get("models", [])
    flagged: list[dict] = []
    for m in models:
        model_id = m.get("model_id", 0)
        model_name = m.get("model_name", f"Model {model_id}")
        stock = _extract_stock(m)
        total_sold = sales.get((item_id, model_id), {}).get("sold", 0)
        velocity = total_sold / days if days > 0 else 0
        stockout_days = stock / velocity if velocity > 0 else None

        below_stock = stock < stock_threshold and total_sold > 0
        below_days = stockout_days is not None and stockout_days < days_threshold
        if below_stock or below_days:
            flagged.append({
                "sku_name": model_name,
                "stock": stock,
                "sold": total_sold,
                "velocity": velocity,
                "stockout_days": stockout_days,
                "below_stock": below_stock,
                "below_days": below_days,
            })

    return item_info, flagged


def _format_eta(sku: dict) -> str:
    stock = sku["stock"]
    stockout_days = sku["stockout_days"]
    below_stock = sku["below_stock"]

    if stockout_days is not None:
        if stockout_days < 1:
            return "TODAY"
        elif stockout_days < 2:
            return f"~{stockout_days:.1f}d"
        else:
            return f"~{stockout_days:.0f}d"
    elif below_stock:
        return "restock"
    return "ok"


def build_blocks(
    flagged_items: list[dict],
    days: int,
    top_pct: float,
    stock_threshold: int,
    days_threshold: float,
) -> list[dict]:
    now = datetime.now(MALAYSIA_TZ)
    blocks: list[dict] = []

    header = (
        f"\U0001f6a8 *Shopee Low Stock Alert*\n"
        f"_{now.strftime('%a %b %-d, %Y')} \u00b7 Last {days}d \u00b7 "
        f"Top {top_pct:.0f}% \u00b7 Stock < {stock_threshold} or < {days_threshold:.0f}d_"
    )
    blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": header}})

    total_skus_flagged = 0

    for entry in flagged_items:
        item_info = entry["item_info"]
        skus = entry["skus"]
        total_skus_flagged += len(skus)

        # Sort SKUs: most urgent first (by stockout_days)
        skus.sort(key=lambda s: s["stockout_days"] if s["stockout_days"] is not None else 999)

        lines = [f"*{item_info['name']}* (`{item_info['item_id']}`)"]
        for sku in skus:
            eta = _format_eta(sku)
            warning = " \u26a0\ufe0f" if sku["below_stock"] else ""
            line = f"  {sku['sku_name']}  stock: {sku['stock']}  sold: {sku['sold']}  \u2192 {eta}{warning}"
            lines.append(line)

        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(lines)}})

    if total_skus_flagged > 5:
        blocks.append({
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": f"_{total_skus_flagged} SKUs across {len(flagged_items)} products need restock._"}],
        })

    return blocks


def build_payload(
    *,
    channel: str,
    days: int,
    top_pct: float,
    stock_threshold: int,
    days_threshold: float,
    max_pages: int,
) -> dict:
    now = datetime.now(MALAYSIA_TZ)

    # 1. Fetch products
    products_data = fetch_products(max_pages)
    if not products_data.get("ok"):
        return {"ok": False, "error": products_data.get("error", "products fetch failed")}
    products = products_data.get("items", [])
    if not products:
        return {"ok": True, "platform": "shopee", "channel": channel,
                "text": f"Shopee Low Stock Alert ({now:%Y-%m-%d %H:%M}) \u2014 no products",
                "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": "\u2705 No active Shopee products."}}]}

    # 2. Fetch orders
    orders_data = fetch_orders(days, max_pages)
    if not orders_data.get("ok"):
        return {"ok": False, "error": orders_data.get("error", "orders fetch failed")}
    orders = orders_data.get("orders", [])
    if not orders:
        return {"ok": True, "platform": "shopee", "channel": channel,
                "text": f"Shopee Low Stock Alert ({now:%Y-%m-%d %H:%M}) \u2014 no orders",
                "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": f"\u2705 No Shopee orders in the last {days} days."}}]}

    # 3. Fetch order items
    order_sns = [str(o.get("order_sn", "")) for o in orders if o.get("order_sn")]
    items_data = fetch_order_items(order_sns)
    if not items_data.get("ok"):
        return {"ok": False, "error": items_data.get("error", "order items fetch failed")}

    # 4. Aggregate sales per (item_id, model_id)
    sales = aggregate_sales(items_data)
    if not sales:
        return {"ok": True, "platform": "shopee", "channel": channel,
                "text": f"Shopee Low Stock Alert ({now:%Y-%m-%d %H:%M}) \u2014 no sales",
                "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": f"\u2705 No order items found in the last {days} days."}}]}

    # 5. Top N% items
    top_item_ids = compute_top_pct_cutoff(sales, top_pct)
    total_products = len(products)
    top_count = len(top_item_ids)

    # 6. Check SKUs for each top item
    flagged_items: list[dict] = []
    for item_id in top_item_ids:
        item_info, skus = check_skus_for_item(item_id, sales, days, stock_threshold, days_threshold)
        if skus:
            flagged_items.append({"item_info": item_info, "skus": skus})

    # 7. Output
    if not flagged_items:
        return {"ok": True, "platform": "shopee", "channel": channel,
                "text": f"Shopee Low Stock Alert ({now:%Y-%m-%d %H:%M}) \u2014 all clear",
                "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": (
                    f"\u2705 *Shopee Low Stock Check*\n\n"
                    f"All clear \u2014 {top_count} top-selling products checked, "
                    f"none below thresholds.\n"
                    f"_Scanned {total_products} products, {len(sales)} with sales in {days} days._"
                )}}]}

    # Sort items by most urgent SKU
    flagged_items.sort(key=lambda e: min(
        (s["stockout_days"] if s["stockout_days"] is not None else 999) for s in e["skus"]
    ))

    total_skus = sum(len(e["skus"]) for e in flagged_items)
    text = f"Shopee Low Stock Alert ({now:%Y-%m-%d %H:%M}) \u2014 {total_skus} SKUs flagged"
    blocks = build_blocks(flagged_items, days, top_pct, stock_threshold, days_threshold)

    return {
        "ok": True, "platform": "shopee", "channel": channel,
        "text": text, "blocks": blocks,
        "summary": {
            "total_products": total_products,
            "products_with_sales": len(sales),
            "top_selling_count": top_count,
            "flagged_items": len(flagged_items),
            "flagged_skus": total_skus,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Shopee low stock + high sales alert (SKU-level)")
    parser.add_argument("--channel", required=True, help="Channel ID")
    parser.add_argument("--days", type=int, default=7, help="Order lookback window in days")
    parser.add_argument("--top-pct", type=float, default=20, help="Top N%% of products by volume")
    parser.add_argument("--stock-threshold", type=int, default=10, help="Stock below this = low")
    parser.add_argument("--days-threshold", type=float, default=7, help="Stockout within N days = low")
    parser.add_argument("--max-pages", type=int, default=10)
    args = parser.parse_args()

    try:
        payload = build_payload(
            channel=args.channel, days=args.days, top_pct=args.top_pct,
            stock_threshold=args.stock_threshold, days_threshold=args.days_threshold,
            max_pages=args.max_pages,
        )
    except Exception as exc:
        payload = {"ok": False, "error": str(exc)}

    print(json.dumps(payload, ensure_ascii=True))
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
