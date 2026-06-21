#!/usr/bin/env python3
"""Lazada low stock + high sales alert (SKU-level).

Detects individual SKUs that are selling fast but running low,
and projects when each will stock out.

Logic:
  1. Aggregate order quantities per seller_sku over the lookback window
  2. Map SKUs to item_ids, rank items by total volume, keep top N%
  3. For each top item, check each SKU against thresholds:
     - stock < stock_threshold, OR
     - stock / daily_velocity < days_threshold

Usage:
    python3 scripts/lazada_low_stock_alert.py --channel C0AUMS4UTJB
    python3 scripts/lazada_low_stock_alert.py --channel C0AUMS4UTJB --days 14 --top-pct 20

Stdout contract:
    {"ok": true, "platform": "lazada", "channel": "...", "text": "...", "blocks": [...]}
    {"ok": false, "error": "..."}
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

MALAYSIA_TZ = timezone(timedelta(hours=8))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON_BIN = os.path.join(REPO_ROOT, ".venv", "bin", "python")
ITEM_FETCH_BATCH = 50


def _run_safe_run(args_list: list[str]) -> dict:
    cmd = [PYTHON_BIN, "-m", "platform_helpers.lazada.safe_run", "--", *args_list]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=REPO_ROOT, timeout=300)
    if not result.stdout.strip():
        return {"ok": False, "error": result.stderr.strip() or f"empty stdout (exit={result.returncode})"}
    try:
        return json.loads(result.stdout.strip().splitlines()[-1])
    except json.JSONDecodeError as exc:
        return {"ok": False, "error": f"JSON parse error: {exc}; stdout={result.stdout[:200]!r}"}


def fetch_products(max_pages: int) -> dict:
    return _run_safe_run(["products", "get", "--filter", "all", "--limit", "50", "--max-pages", str(max_pages)])


def fetch_orders(days: int, max_pages: int) -> dict:
    return _run_safe_run(["orders", "get", "--days", str(days), "--status", "all", "--limit", "100", "--max-pages", str(max_pages)])


def fetch_order_items(order_ids: list[str]) -> dict:
    if not order_ids:
        return {"ok": True, "order_items": []}
    all_items: list[dict] = []
    for i in range(0, len(order_ids), ITEM_FETCH_BATCH):
        batch = order_ids[i : i + ITEM_FETCH_BATCH]
        result = _run_safe_run(["orders", "items-multiple", "--order-ids", json.dumps(batch)])
        if not result.get("ok"):
            return result
        for entry in result.get("order_items", []):
            if isinstance(entry, dict):
                items = entry.get("order_items", [])
                if isinstance(items, list):
                    all_items.extend(items)
    return {"ok": True, "order_items": all_items}


def _extract_item_id_from_url(url: str) -> int | None:
    if not url:
        return None
    m = re.search(r"/i(\d+)-", url)
    return int(m.group(1)) if m else None


def aggregate_sales(items_data: dict) -> dict[str, dict]:
    """Aggregate sales per seller_sku.

    Returns {seller_sku: {"item_id": int|None, "name": str, "sold": int}}.
    """
    sales: dict[str, dict] = {}
    for item in items_data.get("order_items", []):
        sku = item.get("sku") or item.get("seller_sku") or ""
        if not sku:
            continue
        item_id = item.get("item_id")
        if item_id is None:
            item_id = _extract_item_id_from_url(item.get("product_detail_url", ""))
        name = item.get("name") or item.get("variation") or ""
        quantity = item.get("quantity", 0) or 1
        if sku not in sales:
            sales[sku] = {"item_id": int(item_id) if item_id else None, "name": name, "sold": 0}
        sales[sku]["sold"] += int(quantity)
        if name and not sales[sku]["name"]:
            sales[sku]["name"] = name
    return sales


def compute_top_pct_cutoff(sales: dict[str, dict], top_pct: float) -> set[int]:
    """Aggregate to item level, then return top N% item_ids."""
    item_totals: dict[int, int] = defaultdict(int)
    for info in sales.values():
        if info["item_id"] is not None:
            item_totals[info["item_id"]] += info["sold"]

    if not item_totals:
        return set()

    sorted_items = sorted(item_totals.items(), key=lambda x: x[1], reverse=True)
    cutoff_index = max(1, math.ceil(len(sorted_items) * (top_pct / 100)))
    return {item_id for item_id, _ in sorted_items[:cutoff_index]}


def build_product_sku_map(products: list[dict]) -> dict[int, dict]:
    """Build {item_id: {"name": str, "skus": {seller_sku: quantity}}}."""
    result: dict[int, dict] = {}
    for p in products:
        item_id = p.get("item_id")
        if item_id is None:
            continue
        item_id = int(item_id)
        name = p.get("attributes", {}).get("name", f"Item {item_id}")
        skus: dict[str, int] = {}
        for sku in p.get("skus", []):
            seller_sku = sku.get("SellerSku", sku.get("seller_sku", ""))
            qty = int(sku.get("quantity", 0))
            if seller_sku:
                skus[seller_sku] = qty
        result[item_id] = {"name": name, "skus": skus}
    return result


def check_skus_for_item(
    item_id: int,
    product_map: dict[int, dict],
    sales: dict[str, dict],
    days: int,
    stock_threshold: int,
    days_threshold: float,
) -> tuple[dict, list[dict]]:
    """Check each SKU of an item against thresholds.

    Returns (item_info, flagged_skus).
    """
    pinfo = product_map.get(item_id, {"name": f"Item {item_id}", "skus": {}})
    item_info = {"item_id": item_id, "name": pinfo["name"]}

    # Build reverse map: seller_sku -> sold for this item
    item_skus_sold: dict[str, int] = defaultdict(int)
    for sku, info in sales.items():
        if info["item_id"] == item_id:
            item_skus_sold[sku] += info["sold"]

    flagged: list[dict] = []
    for seller_sku, stock in pinfo["skus"].items():
        if not seller_sku or seller_sku == "null":
            continue
        sold = item_skus_sold.get(seller_sku, 0)
        velocity = sold / days if days > 0 else 0
        stockout_days = stock / velocity if velocity > 0 else None

        below_stock = stock < stock_threshold and sold > 0
        below_days = stockout_days is not None and stockout_days < days_threshold
        if below_stock or below_days:
            flagged.append({
                "sku": seller_sku,
                "stock": stock,
                "sold": sold,
                "velocity": velocity,
                "stockout_days": stockout_days,
                "below_stock": below_stock,
                "below_days": below_days,
            })

    return item_info, flagged


def _format_eta(sku: dict) -> str:
    stockout_days = sku["stockout_days"]
    if stockout_days is not None:
        if stockout_days < 1:
            return "TODAY"
        elif stockout_days < 2:
            return f"~{stockout_days:.1f}d"
        else:
            return f"~{stockout_days:.0f}d"
    elif sku["below_stock"]:
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
        f"\U0001f6a8 *Lazada Low Stock Alert*\n"
        f"_{now.strftime('%a %b %-d, %Y')} \u00b7 Last {days}d \u00b7 "
        f"Top {top_pct:.0f}% \u00b7 Stock < {stock_threshold} or < {days_threshold:.0f}d_"
    )
    blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": header}})

    total_skus_flagged = 0

    for entry in flagged_items:
        item_info = entry["item_info"]
        skus = entry["skus"]
        total_skus_flagged += len(skus)

        skus.sort(key=lambda s: s["stockout_days"] if s["stockout_days"] is not None else 999)

        lines = [f"*{item_info['name']}* (`{item_info['item_id']}`)"]
        for sku in skus:
            eta = _format_eta(sku)
            warning = " \u26a0\ufe0f" if sku["below_stock"] else ""
            line = f"  {sku['sku']}  stock: {sku['stock']}  sold: {sku['sold']}  \u2192 {eta}{warning}"
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
    products = products_data.get("products", [])
    if not products:
        return {"ok": True, "platform": "lazada", "channel": channel,
                "text": f"Lazada Low Stock Alert ({now:%Y-%m-%d %H:%M}) \u2014 no products",
                "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": "\u2705 No active Lazada products."}}]}

    product_map = build_product_sku_map(products)

    # 2. Fetch orders
    orders_data = fetch_orders(days, max_pages)
    if not orders_data.get("ok"):
        return {"ok": False, "error": orders_data.get("error", "orders fetch failed")}
    orders = orders_data.get("orders", [])
    if not orders:
        return {"ok": True, "platform": "lazada", "channel": channel,
                "text": f"Lazada Low Stock Alert ({now:%Y-%m-%d %H:%M}) \u2014 no orders",
                "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": f"\u2705 No Lazada orders in the last {days} days."}}]}

    # 3. Fetch order items
    order_ids = [str(o.get("order_id", "")) for o in orders if o.get("order_id")]
    items_data = fetch_order_items(order_ids)
    if not items_data.get("ok"):
        return {"ok": False, "error": items_data.get("error", "order items fetch failed")}

    # 4. Aggregate sales per seller_sku
    sales = aggregate_sales(items_data)
    if not sales:
        return {"ok": True, "platform": "lazada", "channel": channel,
                "text": f"Lazada Low Stock Alert ({now:%Y-%m-%d %H:%M}) \u2014 no sales",
                "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": f"\u2705 No order items found in the last {days} days."}}]}

    # 5. Top N% items
    top_item_ids = compute_top_pct_cutoff(sales, top_pct)
    total_products = len(products)
    top_count = len(top_item_ids)

    # 6. Check SKUs for each top item
    flagged_items: list[dict] = []
    for item_id in top_item_ids:
        item_info, skus = check_skus_for_item(item_id, product_map, sales, days, stock_threshold, days_threshold)
        if skus:
            flagged_items.append({"item_info": item_info, "skus": skus})

    # 7. Output
    if not flagged_items:
        return {"ok": True, "platform": "lazada", "channel": channel,
                "text": f"Lazada Low Stock Alert ({now:%Y-%m-%d %H:%M}) \u2014 all clear",
                "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": (
                    f"\u2705 *Lazada Low Stock Check*\n\n"
                    f"All clear \u2014 {top_count} top-selling products checked, "
                    f"none below thresholds.\n"
                    f"_Scanned {total_products} products, {len(sales)} with sales in {days} days._"
                )}}]}

    flagged_items.sort(key=lambda e: min(
        (s["stockout_days"] if s["stockout_days"] is not None else 999) for s in e["skus"]
    ))

    total_skus = sum(len(e["skus"]) for e in flagged_items)
    text = f"Lazada Low Stock Alert ({now:%Y-%m-%d %H:%M}) \u2014 {total_skus} SKUs flagged"
    blocks = build_blocks(flagged_items, days, top_pct, stock_threshold, days_threshold)

    return {
        "ok": True, "platform": "lazada", "channel": channel,
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
    parser = argparse.ArgumentParser(description="Lazada low stock + high sales alert (SKU-level)")
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
