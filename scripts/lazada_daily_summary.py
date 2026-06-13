#!/usr/bin/env python3
"""Lazada order summary - data fetcher.

Fetches order status breakdown (morning) or daily orders + sales (evening)
via the platform helper CLI, then prints a JSON envelope to stdout.
The TS poster (`post_daily_update.ts`) is responsible for delivering
the payload to Slack.

Usage:
    python3 scripts/lazada_daily_summary.py --mode morning --channel C0AUMS4UTJB
    python3 scripts/lazada_daily_summary.py --mode evening --channel C0AUMS4UTJB

Stdout contract:
    {"ok": true, "channel": "C...", "text": "...", "blocks": [...]} on success
    {"ok": false, "error": "..."} on failure (exit code 1)
"""

from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

MALAYSIA_TZ = timezone(timedelta(hours=8))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON_BIN = os.path.join(REPO_ROOT, ".venv", "bin", "python")

MORNING_STATUSES = [
    ("topack", "To Pack", ":package:"),
    ("toship", "To Ship", ":truck:"),
    ("pending", "Pending", ":hourglass_flowing_sand:"),
    ("ready_to_ship", "Ready to Ship", ":white_check_mark:"),
]

MAX_RETRIES = 3
RETRY_DELAY_BASE = 2

LAZADA_SELLER_CENTER_URL = (
    "https://sellercenter.lazada.com.my/apps/order/list"
    "?oldVersion=1&status=topack"
)


def _run_safe_run(command_args: list[str]) -> dict:
    cmd = [PYTHON_BIN, "-m", "platform_helpers.lazada.safe_run", "--", *command_args]
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


def fetch_orders_summary(days: int, date: str | None = None) -> dict:
    last_error: str | None = None
    for attempt in range(MAX_RETRIES):
        args = ["orders", "summary", "--days", str(days), "--short"]
        if date:
            args.extend(["--date", date])
        data = _run_safe_run(args)
        if data.get("ok"):
            return data
        last_error = data.get("error", "Unknown error")
        print(
            f"Attempt {attempt + 1}/{MAX_RETRIES} failed: {last_error}",
            file=sys.stderr,
        )
        if attempt < MAX_RETRIES - 1:
            wait = (RETRY_DELAY_BASE ** attempt) + random.uniform(0.5, 1.0)
            print(f"Retrying in {wait:.1f}s...", file=sys.stderr)
            time.sleep(wait)
    return {"ok": False, "error": last_error}


def format_morning_message(status_breakdown: dict, error: str | None) -> str:
    today = datetime.now(MALAYSIA_TZ).strftime("%Y-%m-%d")
    if error:
        return (
            f":warning: *Morning Order Summary Error* :warning:\n\n"
            f"```Error: {error}```\n\nPlease check the logs for details."
        )
    lines = [
        f":sunrise: *Good Morning! Here's your Lazada orders summary for {today}* :sunrise:",
        "",
    ]
    total = 0
    for status, label, emoji in MORNING_STATUSES:
        count = status_breakdown.get(status, 0)
        total += count
        lines.append(f"{emoji} *{label}:* {count} orders")
    if total == 0:
        lines.extend(["", ":wave: All caught up! No pending orders."])
    else:
        lines.extend(["", f":muscle: *Total needing attention: {total} orders*"])
    lines.extend(["", f":link: <{LAZADA_SELLER_CENTER_URL}|Open Seller Center>"])
    return "\n".join(lines)


def format_evening_message(total_orders: int, total_sales: float, date: str, error: str | None) -> str:
    date_formatted = datetime.strptime(date, "%Y-%m-%d").strftime("%B %d, %Y")
    if error:
        return (
            f":warning: *Evening Order Summary Error* :warning:\n\n"
            f"```Error: {error}```\n\nPlease check the logs for details."
        )
    lines = [
        f":city_sunset: *Good Evening! Lazada Daily Summary for {date_formatted}* :city_sunset:",
        "",
        f":shopping_trolley: *Orders created today:* {total_orders} orders",
        f":money_with_wings: *Total sales:* RM {total_sales:,.2f}",
        "",
    ]
    if total_orders == 0:
        lines.append(":zzz: No orders today. Rest up for tomorrow!")
    else:
        lines.append(":rocket: Keep up the great work! :rocket:")
    return "\n".join(lines)


def text_to_section_blocks(text: str) -> list[dict]:
    return [{"type": "section", "text": {"type": "mrkdwn", "text": text}}]


def build_morning_payload(channel: str) -> dict:
    result = fetch_orders_summary(days=7)
    error = result.get("error") if not result.get("ok", True) else None
    status_breakdown = result.get("status_breakdown", {})
    for status, _, _ in MORNING_STATUSES:
        print(f"  {status}: {status_breakdown.get(status, 0)} orders", file=sys.stderr)
    text = format_morning_message(status_breakdown, error)
    return {
        "ok": True,
        "platform": "lazada",
        "channel": channel,
        "text": text.split("\n", 1)[0],
        "blocks": text_to_section_blocks(text),
        "summary": {
            "mode": "morning",
            "status_breakdown": status_breakdown,
        },
    }


def build_evening_payload(channel: str, date: str | None) -> dict:
    result = fetch_orders_summary(days=0, date=date)
    error = result.get("error") if not result.get("ok", True) else None
    target_date = date or datetime.now(MALAYSIA_TZ).strftime("%Y-%m-%d")
    total_orders = int(result.get("total_orders", 0) or 0)
    total_sales = float(result.get("total_sales", 0.0) or 0.0)
    print(f"  Orders today: {total_orders}", file=sys.stderr)
    print(f"  Sales amount: RM {total_sales:,.2f}", file=sys.stderr)
    text = format_evening_message(total_orders, total_sales, target_date, error)
    return {
        "ok": True,
        "platform": "lazada",
        "channel": channel,
        "text": text.split("\n", 1)[0],
        "blocks": text_to_section_blocks(text),
        "summary": {
            "mode": "evening",
            "date": target_date,
            "total_orders": total_orders,
            "total_sales": total_sales,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Lazada daily summary - fetch data and print Slack payload JSON"
    )
    parser.add_argument("--mode", required=True, choices=["morning", "evening"])
    parser.add_argument("--channel", required=True, help="Slack channel ID (e.g. C0AUMS4UTJB)")
    parser.add_argument("--date", help="Optional date (YYYY-MM-DD), defaults to today")

    args = parser.parse_args()
    try:
        if args.mode == "morning":
            payload = build_morning_payload(args.channel)
        else:
            payload = build_evening_payload(args.channel, args.date)
    except Exception as exc:
        print(
            json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=True),
            file=sys.stdout,
        )
        return 1

    print(json.dumps(payload, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
