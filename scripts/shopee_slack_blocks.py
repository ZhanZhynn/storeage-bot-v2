import json
from datetime import datetime, timedelta, timezone

MALAYSIA_TZ = timezone(timedelta(hours=8))

ACTION_SHIP_ALL = "shopee_ship_all_pending"
ACTION_SHIP_NEAR_SLA = "shopee_ship_near_sla"


def _build_action_value(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=True)


def build_shopee_order_blocks(
    *,
    mode: str,
    channel: str,
    total_pending: int,
    to_process: int,
    already_arranged: int,
    near_sla_count: int,
    error: str | None = None,
    hours_threshold: int = 24,
    max_pages: int = 5,
    yesterday_orders: int | None = None,
    yesterday_revenue: float | None = None,
) -> list[dict]:
    today = datetime.now(MALAYSIA_TZ).strftime("%b %d, %Y")
    header = (
        f"\U0001f305 *Shopee Morning Update* ({today})"
        if mode == "morning"
        else f"\U0001f306 *Shopee Evening Update* ({today})"
    )

    lines: list[str] = [header]
    if error:
        lines.extend(["", f"*\u26a0\ufe0f Error:* `{error}`"])
    else:
        lines.extend(
            [
                "",
                f"\U0001f4e6 *Pending packages:* {total_pending}",
                f"\u23f3 *To process:* {to_process}",
                f"\u2705 *Already arranged:* {already_arranged}",
                f"\u26a0\ufe0f *Near SLA ({hours_threshold}h):* {near_sla_count}",
            ]
        )
        if yesterday_orders is not None and yesterday_revenue is not None:
            lines.append(
                f"\U0001f4b0 *Yesterday:* {yesterday_orders} orders \u00b7 RM {yesterday_revenue:,.2f}"
            )

    text = "\n".join(lines)

    action_payload = {
        "channel": channel,
        "hours": hours_threshold,
        "max_pages": max_pages,
    }

    blocks: list[dict] = [
        {"type": "section", "text": {"type": "mrkdwn", "text": text}},
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "action_id": ACTION_SHIP_ALL,
                    "text": {"type": "plain_text", "text": "Ship All Pending"},
                    "style": "primary",
                    "value": _build_action_value({"action": "ship_all", **action_payload}),
                },
                {
                    "type": "button",
                    "action_id": ACTION_SHIP_NEAR_SLA,
                    "text": {"type": "plain_text", "text": "Ship Near-SLA (24h)"},
                    "style": "danger",
                    "value": _build_action_value({"action": "ship_near_sla", **action_payload}),
                },
            ],
        },
    ]

    return blocks
