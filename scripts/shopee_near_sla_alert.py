#!/usr/bin/env python3
"""Shopee near-SLA alert - standalone data fetcher.

Fetches packages approaching their ship-by deadline, builds a simple
Telegram-compatible alert, and prints a JSON envelope to stdout.

Usage:
    python3 scripts/shopee_near_sla_alert.py --channel -1004450247696
    python3 scripts/shopee_near_sla_alert.py --channel -1004450247696 --hours 6

Stdout contract:
    {"ok": true, "channel": "...", "text": "...", "blocks": [...]} on success
    {"ok": false, "error": "..."} on failure (exit code 1)
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

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


def build_payload(
    *,
    channel: str,
    hours_threshold: int,
    max_pages: int,
) -> dict:
    sla_data = _run_safe_run(
        "shopee",
        ["orders", "sla-check", "--hours", str(hours_threshold), "--max-pages", str(max_pages)],
    )

    if not sla_data.get("ok"):
        return {"ok": False, "error": sla_data.get("error", "sla-check failed")}

    near_sla_count = int(sla_data.get("near_sla_count", 0))
    now = datetime.now(MALAYSIA_TZ)

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f":warning: *Shopee Near-SLA Alert* ({now.strftime('%a %b %-d, %Y')})\n\n"
                    f"Orders approaching SLA deadline (within *{hours_threshold}h*): *{near_sla_count}*\n\n"
                    f"No auto-arrange was performed — review and ship manually."
                ),
            },
        },
    ]

    text = f"Shopee Near-SLA Alert ({now.strftime('%Y-%m-%d %H:%M')})"
    return {
        "ok": True,
        "platform": "shopee",
        "channel": channel,
        "text": text,
        "blocks": blocks,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Shopee near-SLA alert - fetch near-deadline orders and print JSON payload"
    )
    parser.add_argument("--channel", required=True, help="Channel ID (Telegram numeric ID)")
    parser.add_argument("--hours", type=int, default=12, help="Near-SLA threshold in hours")
    parser.add_argument("--max-pages", type=int, default=5)

    args = parser.parse_args()

    try:
        payload = build_payload(
            channel=args.channel,
            hours_threshold=args.hours,
            max_pages=args.max_pages,
        )
    except Exception as exc:
        payload = {"ok": False, "error": str(exc)}

    if not payload.get("ok"):
        print(json.dumps(payload, ensure_ascii=True))
        return 1

    print(json.dumps(payload, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
