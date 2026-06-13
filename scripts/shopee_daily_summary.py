#!/usr/bin/env python3
"""Shopee order summary - data fetcher.

Fetches pending package count and near-SLA count, builds Slack blocks,
and prints a JSON envelope to stdout. The TS poster (`post_daily_update.ts`)
is responsible for delivering the payload to Slack.

Usage:
    python3 scripts/shopee_daily_summary.py --mode morning --channel C0B2QN88GSH
    python3 scripts/shopee_daily_summary.py --mode evening --channel C0B2QN88GSH \\
        --max-pages 2 --hours 24

Stdout contract:
    {"ok": true, "channel": "C...", "text": "...", "blocks": [...]} on success
    {"ok": false, "error": "..."} on failure (exit code 1)
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shopee_slack_blocks import build_shopee_order_blocks  # noqa: E402

MALAYSIA_TZ = timezone(timedelta(hours=8))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON_BIN = os.path.join(REPO_ROOT, ".venv", "bin", "python")


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


def fetch_pending_packages(max_pages: int) -> dict:
    return _run_safe_run(
        "shopee",
        [
            "orders",
            "pkg-search",
            "--page-size",
            "50",
            "--filter",
            json.dumps({"package_status": 2}),
            "--max-pages",
            str(max_pages),
        ],
    )


def fetch_sla_check(hours_threshold: int, max_pages: int) -> dict:
    return _run_safe_run(
        "shopee",
        [
            "orders",
            "sla-check",
            "--hours",
            str(hours_threshold),
            "--max-pages",
            str(max_pages),
        ],
    )


def summarize_pending(data: dict) -> tuple[int, int, int, str | None]:
    if not data.get("ok"):
        return 0, 0, 0, data.get("error")
    packages = data.get("packages") or []
    total_pending = len(packages)
    already_arranged = sum(1 for pkg in packages if pkg.get("is_shipment_arranged"))
    to_process = total_pending - already_arranged
    return total_pending, to_process, already_arranged, None


def summarize_near_sla(data: dict) -> tuple[int, str | None]:
    if not data.get("ok"):
        return 0, data.get("error")
    return int(data.get("near_sla_count") or 0), None


def build_payload(
    *,
    channel: str,
    mode: str,
    max_pages: int,
    hours_threshold: int,
) -> dict:
    pending_data = fetch_pending_packages(max_pages=max_pages)
    total_pending, to_process, already_arranged, error = summarize_pending(pending_data)

    near_sla_count = 0
    if not error:
        sla_data = fetch_sla_check(hours_threshold=hours_threshold, max_pages=max_pages)
        near_sla_count, sla_error = summarize_near_sla(sla_data)
        if sla_error:
            error = sla_error

    blocks = build_shopee_order_blocks(
        mode=mode,
        channel=channel,
        total_pending=total_pending,
        to_process=to_process,
        already_arranged=already_arranged,
        near_sla_count=near_sla_count,
        error=error,
        hours_threshold=hours_threshold,
        max_pages=max_pages,
    )
    today = datetime.now(MALAYSIA_TZ).strftime("%Y-%m-%d")
    text = f"Shopee {mode} update ({today})"
    return {
        "ok": True,
        "platform": "shopee",
        "channel": channel,
        "text": text,
        "blocks": blocks,
        "summary": {
            "mode": mode,
            "total_pending": total_pending,
            "to_process": to_process,
            "already_arranged": already_arranged,
            "near_sla_count": near_sla_count,
            "hours_threshold": hours_threshold,
            "max_pages": max_pages,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Shopee daily summary - fetch data and print Slack payload JSON"
    )
    parser.add_argument("--mode", required=True, choices=["morning", "evening"])
    parser.add_argument("--channel", required=True, help="Slack channel ID (e.g. C0B2QN88GSH)")
    parser.add_argument("--max-pages", type=int, default=2)
    parser.add_argument("--hours", type=int, default=24, help="Near-SLA threshold in hours")

    args = parser.parse_args()

    try:
        payload = build_payload(
            channel=args.channel,
            mode=args.mode,
            max_pages=args.max_pages,
            hours_threshold=args.hours,
        )
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
