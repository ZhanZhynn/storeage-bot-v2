#!/usr/bin/env python3
"""Shopee price discrepancy alert — detect pricing mistakes in recent escrows.

Compares order_selling_price (total set price) vs escrow_amount (actual
seller payout) for each recently paid order. Flags orders where:
  - The percentage gap exceeds a threshold, OR
  - Escrow is negative, OR
  - Net shipping cost to seller exceeds a RM threshold

Logic:
  1. Fetch orders created within the lookback window
  2. Batch-fetch escrow details for those orders
  3. For each order: compare order_selling_price vs escrow_amount
  4. Compute net shipping cost from escrow data
  5. Flag if gap > threshold OR escrow_amount < 0 OR net shipping > threshold
  6. Build Slack/Telegram alert blocks and output JSON to stdout

Usage:
    # Slack
    python3 scripts/shopee_price_discrepancy_alert.py --channel C0B2QN88GSH
    python3 scripts/shopee_price_discrepancy_alert.py --channel C0B2QN88GSH --hours 12 --threshold 30

    # Telegram
    python3 scripts/shopee_price_discrepancy_alert.py --channel -1004450247696
    python3 scripts/shopee_price_discrepancy_alert.py --channel -1004450247696 --status COMPLETED

    # Pipe to post_daily_update.ts for delivery
    python3 scripts/shopee_price_discrepancy_alert.py --channel -1004450247696 --status COMPLETED --hours 24 --threshold 50 --shipping-threshold 5 --time-range-field create_time | bun run scripts/post_daily_update.ts

Stdout contract:
    {"ok": true, "platform": "shopee", "channel": "...", "text": "...", "blocks": [...]}
    {"ok": false, "error": "..."}
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

# ── Constants ────────────────────────────────────────────────────────────
LOOKBACK_HOURS = 24
DISCREPANCY_THRESHOLD_PCT = 30.0
SHIPPING_FEE_THRESHOLD_RM = 5.0
# ─────────────────────────────────────────────────────────────────────────

MALAYSIA_TZ = timezone(timedelta(hours=8))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON_BIN = os.path.join(REPO_ROOT, ".venv", "bin", "python")
ESCROW_BATCH_SIZE = 50


def _run_safe_run(platform: str, command_args: list[str]) -> dict:
    module = f"platform_helpers.{platform}.safe_run"
    cmd = [PYTHON_BIN, "-m", module, "--", *command_args]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        timeout=300,
    )
    if not result.stdout.strip():
        return {
            "ok": False,
            "error": result.stderr.strip() or f"empty stdout (exit={result.returncode})",
        }
    try:
        return json.loads(result.stdout.strip().splitlines()[-1])
    except json.JSONDecodeError as exc:
        return {
            "ok": False,
            "error": f"JSON parse error: {exc}; stdout={result.stdout[:200]!r}",
        }


def _money(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return 0.0
    return 0.0


def fetch_recent_orders(hours: int, max_pages: int, order_status: str | None = None, time_range_field: str | None = None) -> dict:
    now_ts = int(datetime.now(timezone.utc).timestamp())
    from_ts = now_ts - (hours * 3600)
    # Use update_time for COMPLETED orders (to catch recently completed),
    # create_time for everything else — unless overridden by --time-range-field
    if time_range_field:
        time_field = time_range_field
    else:
        time_field = "update_time" if order_status == "COMPLETED" else "create_time"
    args = [
        "orders", "get",
        "--time-from", str(from_ts),
        "--time-to", str(now_ts),
        "--time-range-field", time_field,
        "--response-optional-fields", "order_status",
        "--page-size", "50",
        "--max-pages", str(max_pages),
    ]
    if order_status:
        args.extend(["--order-status", order_status])
    return _run_safe_run("shopee", args)


def fetch_escrow_batch(order_sns: list[str]) -> dict:
    return _run_safe_run(
        "shopee",
        ["payment", "escrow-batch", "--order-sn-list", ",".join(order_sns)],
    )


def detect_discrepancies(
    escrow_details: list[dict],
    hours: int,
    threshold_pct: float,
    shipping_threshold_rm: float,
) -> list[dict]:
    flagged: list[dict] = []
    now = datetime.now(MALAYSIA_TZ)

    for detail in escrow_details:
        order_sn = detail.get("order_sn", "unknown")
        order_income = detail.get("order_income") or {}
        items = order_income.get("items") or detail.get("items") or []

        selling_price = _money(order_income.get("order_selling_price"))
        escrow_amount = _money(order_income.get("escrow_amount"))

        # CB-SIP: derive escrow_amount from primary currency
        if escrow_amount == 0 and selling_price > 0:
            pri = _money(order_income.get("escrow_amount_pri"))
            rate = _money(order_income.get("exchange_rate"))
            if pri > 0 and rate > 0:
                escrow_amount = pri * rate

        if selling_price <= 0:
            continue

        negative_escrow = escrow_amount < 0
        gap_pct = (
            ((selling_price - escrow_amount) / selling_price * 100)
            if selling_price > 0
            else 0
        )

        # Net shipping cost to seller (only meaningful when order has shipped)
        actual_shipping = _money(order_income.get("actual_shipping_fee"))
        net_shipping = (
            actual_shipping
            + _money(order_income.get("reverse_shipping_fee"))
            + _money(order_income.get("final_return_to_seller_shipping_fee"))
            - _money(order_income.get("buyer_paid_shipping_fee"))
            - _money(order_income.get("shopee_shipping_rebate"))
        )
        shipping_flag = actual_shipping > 0 and net_shipping > shipping_threshold_rm

        if gap_pct > threshold_pct or negative_escrow or shipping_flag:
            item_names = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                name = item.get("item_name") or "Unknown"
                sku = item.get("model_sku") or item.get("item_sku") or ""
                qty = int(_money(item.get("quantity_purchased")) or 1)
                item_names.append({"name": name, "sku": sku, "qty": qty})

            fee_breakdown = _compute_fee_breakdown(order_income, selling_price)

            flagged.append({
                "order_sn": order_sn,
                "selling_price": selling_price,
                "escrow_amount": escrow_amount,
                "gap_pct": round(gap_pct, 1),
                "negative_escrow": negative_escrow,
                "net_shipping": round(net_shipping, 2),
                "shipping_flag": shipping_flag,
                "items": item_names,
                "fee_breakdown": fee_breakdown,
            })

    return flagged


def _compute_fee_breakdown(order_income: dict, selling_price: float) -> list[dict]:
    """Return grouped fee categories sorted by absolute amount descending."""
    categories = {
        "Discounts": [
            "seller_discount", "shopee_discount", "voucher_from_seller",
            "voucher_from_shopee", "coins",
        ],
        "Platform Fees": [
            "commission_fee", "service_fee", "seller_transaction_fee",
            "seller_order_processing_fee", "campaign_fee", "fbs_fee",
            "ads_escrow_top_up_fee_or_technical_support_fee",
        ],
        "Seller Shipping Cost": None,  # computed separately
        "Taxes": [
            "escrow_tax", "withholding_tax", "cross_border_tax",
            "sales_tax_on_lvg", "final_escrow_product_gst",
            "final_escrow_shipping_gst", "final_product_vat_tax",
            "final_shipping_vat_tax", "shipping_fee_sst",
            "reverse_shipping_fee_sst", "vat_on_imported_goods",
            "withholding_vat_tax", "withholding_pit_tax", "th_import_duty",
        ],
    }

    result: list[dict] = []
    for cat_name, fields in categories.items():
        if cat_name == "Seller Shipping Cost":
            total = (
                _money(order_income.get("actual_shipping_fee"))
                + _money(order_income.get("reverse_shipping_fee"))
                + _money(order_income.get("final_return_to_seller_shipping_fee"))
                - _money(order_income.get("buyer_paid_shipping_fee"))
                - _money(order_income.get("shopee_shipping_rebate"))
            )
        else:
            total = sum(_money(order_income.get(f)) for f in fields)
        if total == 0:
            continue
        pct = (total / selling_price * 100) if selling_price > 0 else 0
        result.append({
            "category": cat_name,
            "amount": round(total, 2),
            "pct": round(pct, 1),
        })

    result.sort(key=lambda c: abs(c["amount"]), reverse=True)
    return result


def build_blocks(
    flagged_orders: list[dict],
    hours: int,
    threshold_pct: float,
    total_orders_checked: int,
) -> list[dict]:
    now = datetime.now(MALAYSIA_TZ)
    total_flagged = len(flagged_orders)

    header = (
        f"\U0001f6a8 *Shopee Price Discrepancy Alert*\n"
        f"_{now.strftime('%a %b %-d, %Y')} \u00b7 Last {hours}h \u00b7 "
        f"Threshold: >{threshold_pct:.0f}%_"
    )
    blocks: list[dict] = [
        {"type": "section", "text": {"type": "mrkdwn", "text": header}},
    ]

    for order in flagged_orders:
        order_sn = order["order_sn"]
        selling = order["selling_price"]
        escrow = order["escrow_amount"]
        pct = order["gap_pct"]
        neg = order["negative_escrow"]
        ship_flag = order.get("shipping_flag", False)
        net_ship = order.get("net_shipping", 0.0)
        fees = order.get("fee_breakdown") or []

        markers = []
        if neg:
            markers.append("\u26a0\ufe0f *NEGATIVE ESCROW*")
        if ship_flag:
            markers.append("\U0001f6a2 *HIGH SHIPPING COST*")
        marker = " \u2022 ".join(markers) + " \u2022 " if markers else ""

        lines = [
            f"{marker}*Order:* `{order_sn}`",
            f"  Selling: RM {selling:,.2f} \u00b7 Escrow: RM {escrow:,.2f} "
            f"({pct:.1f}% gap)",
        ]

        if ship_flag:
            ship_pct = (net_ship / selling * 100) if selling > 0 else 0
            lines.append(
                f"  Net Shipping: RM {net_ship:,.2f} ({ship_pct:.1f}% of selling price)"
            )

        for item in order["items"]:
            qty_str = f" x{item['qty']}" if item["qty"] != 1 else ""
            sku_str = f" (`{item['sku']}`)" if item["sku"] else ""
            lines.append(f"  \u2022 {item['name']}{sku_str}{qty_str}")

        if fees:
            fee_parts = [f"{f['category']}: {f['pct']:.1f}%" for f in fees]
            lines.append(f"  _Fees breakdown: {' \u00b7 '.join(fee_parts)}_")

        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": "\n".join(lines)},
        })

    context = (
        f"_{total_flagged} order{'s' if total_flagged != 1 else ''} "
        f"flagged \u00b7 {total_orders_checked} orders checked._"
    )
    blocks.append({
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": context}],
    })

    return blocks


def build_payload(
    *,
    channel: str,
    hours: int,
    threshold_pct: float,
    shipping_threshold_rm: float,
    order_status: str | None,
    time_range_field: str | None,
    max_pages: int,
) -> dict:
    now = datetime.now(MALAYSIA_TZ)

    orders_data = fetch_recent_orders(hours, max_pages, order_status, time_range_field)
    if not orders_data.get("ok"):
        return {"ok": False, "error": orders_data.get("error", "orders fetch failed")}

    orders = orders_data.get("orders", [])
    if not orders:
        return {
            "ok": True,
            "platform": "shopee",
            "channel": channel,
            "text": f"Shopee Price Discrepancy Alert ({now:%Y-%m-%d %H:%M}) \u2014 no paid orders",
            "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": (
                f"\u2705 No new paid Shopee orders in the last {hours}h."
            )}}],
        }

    PAID_STATUSES = {"READY_TO_SHIP", "PROCESSED", "SHIPPED", "COMPLETED", "INVOICE_PENDING"}
    paid_orders = [
        o for o in orders
        if o.get("order_sn") and (
            order_status  # API already filtered server-side
            or o.get("order_status", "") in PAID_STATUSES
        )
    ]
    order_sns = [str(o.get("order_sn", "")) for o in paid_orders]

    all_escrow_details: list[dict] = []
    for i in range(0, len(order_sns), ESCROW_BATCH_SIZE):
        batch = order_sns[i : i + ESCROW_BATCH_SIZE]
        escrow_data = fetch_escrow_batch(batch)
        if not escrow_data.get("ok"):
            return {"ok": False, "error": escrow_data.get("error", "escrow fetch failed")}
        details = escrow_data.get("escrow_details", [])
        for d in details:
            if isinstance(d, dict):
                all_escrow_details.append(d.get("escrow_detail") or d)

    flagged = detect_discrepancies(all_escrow_details, hours, threshold_pct, shipping_threshold_rm)

    if not flagged:
        return {
            "ok": True,
            "platform": "shopee",
            "channel": channel,
            "text": f"Shopee Price Discrepancy Alert ({now:%Y-%m-%d %H:%M}) \u2014 all clear",
            "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": (
                f"\u2705 *Shopee Price Discrepancy Check*\n\n"
                f"All clear \u2014 {len(order_sns)} orders checked, "
                f"no orders with >{threshold_pct:.0f}% selling-to-escrow gap "
                f"or >RM {shipping_threshold_rm:.0f} net shipping.\n"
                f"_Last {hours}h_"
            )}}],
        }

    total_flagged = len(flagged)
    text = (
        f"Shopee Price Discrepancy Alert ({now:%Y-%m-%d %H:%M}) \u2014 "
        f"{total_flagged} order{'s' if total_flagged != 1 else ''} flagged"
    )
    blocks = build_blocks(flagged, hours, threshold_pct, len(order_sns))

    return {
        "ok": True,
        "platform": "shopee",
        "channel": channel,
        "text": text,
        "blocks": blocks,
        "summary": {
            "orders_checked": len(order_sns),
            "orders_flagged": total_flagged,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Shopee price discrepancy alert — detect pricing mistakes in recent escrows"
    )
    parser.add_argument("--channel", required=True, help="Channel ID (Slack or Telegram)")
    parser.add_argument(
        "--hours", type=int, default=LOOKBACK_HOURS,
        help=f"Lookback window in hours (default: {LOOKBACK_HOURS})",
    )
    parser.add_argument(
        "--threshold", type=float, default=DISCREPANCY_THRESHOLD_PCT,
        help=f"Percentage threshold to flag (default: {DISCREPANCY_THRESHOLD_PCT}%%)",
    )
    parser.add_argument(
        "--shipping-threshold", type=float, default=SHIPPING_FEE_THRESHOLD_RM,
        help=f"Net shipping cost (RM) threshold to flag (default: {SHIPPING_FEE_THRESHOLD_RM})",
    )
    parser.add_argument(
        "--status", default=None,
        choices=["UNPAID", "READY_TO_SHIP", "PROCESSED", "SHIPPED", "COMPLETED", "IN_CANCEL", "CANCELLED", "INVOICE_PENDING"],
        help="Filter by order status (default: all paid statuses)",
    )
    parser.add_argument(
        "--time-range-field", default=None,
        choices=["create_time", "update_time"],
        help="Time range field for order fetch (default: auto — update_time for COMPLETED, create_time otherwise)",
    )
    parser.add_argument("--max-pages", type=int, default=5)

    args = parser.parse_args()

    try:
        payload = build_payload(
            channel=args.channel,
            hours=args.hours,
            threshold_pct=args.threshold,
            shipping_threshold_rm=args.shipping_threshold,
            order_status=args.status,
            time_range_field=args.time_range_field,
            max_pages=args.max_pages,
        )
    except Exception as exc:
        payload = {"ok": False, "error": str(exc)}

    print(json.dumps(payload, ensure_ascii=True))
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
