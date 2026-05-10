# Lazada API Data Retrieval Playbook

keywords: lazada, iop, open platform, app_key, access_token, seller, orders, products, finance, return, refund, review

## Quick Cheat Sheet (Common Questions)

| Question | CLI Command (Use This for Fast Results) |
| :--- | :--- |
| "How many orders?" | `python3 -m platform_helpers.lazada.cli orders summary --days 1 --short` |
| "How much sales?" | Same command → check `total_sales` in output |
| "Any returns?" | `python3 -m platform_helpers.lazada.cli returns-refunds return-history-list` |
| "Product reviews?" | `python3 -m platform_helpers.lazada.cli reviews seller-history-list --item-id <ITEM_ID>` |
| "Payout status?" | `python3 -m platform_helpers.lazada.cli finance payout-status-get --created-after 2026-04-01 --created-before 2026-04-30` |

<!-- END_QUICK_ANSWER -->

---

# Full Documentation

## Goal
Provide a repeatable workflow for fetching Lazada seller data using the local Python SDK and Lazada Open Platform APIs.

## Use When
- User asks for Lazada store details, especially orders, products, finance, returns, or refunds.
- User needs API-driven data retrieval, not spreadsheet-only analysis.

## Shared Config
- Read Lazada config from auto-injected context first (`BOLTY_LAZADA_*` values).
- Do not ask user to paste app key/secret/token again if they are already configured.
- If any required credential is missing, ask only for the missing value.

## Workflow
1. Confirm request domain (orders/products/finance/return-refund/reviews) and required filters (time range, status, pagination).
2. Choose endpoint and required params based on Lazada docs and this skill folder.
3. Validate response fields:
   - Top-level `code`, `message`, `request_id`
   - Nested `data` payload completeness
4. Return concise business output with key metrics and any API limitations.

## Deterministic Command Preference
- For API execution, prefer deterministic helper commands over raw ad-hoc curl.
- Orders example:
  - `python3 -m platform_helpers.lazada.cli orders summary --days 7 --short`
- Date filter format for `created_*`, `update_*`, and `create_*`:
  - Use `YYYY-MM-DD` only.
  - Helper normalizes `YYYY-MM-DD` to endpoint-specific Lazada API formats.
  - `YYYY-MM-DD` is interpreted in Malaysia timezone (`+08:00`).
  - For date-only input: `*_after` uses `00:00:00`, `*_before` uses `23:59:59.999`.

## Execution Notes
- Run commands via: `python3 -m platform_helpers.lazada.safe_run -- <subcommand>`
- Or direct: `python3 -m platform_helpers.lazada.cli <subcommand>`
- After running a command, always report key fields first: `ok`, `status`, `endpoint`, `total_fetched`, `has_more`, and `request_ids`.

## Guardrails
- Never expose raw app secret in chat output.
- Prefer pagination-safe retrieval for large datasets.
- Explicitly state date/time assumptions and timezone.