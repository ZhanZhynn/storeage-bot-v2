# scripts/

Cron-driven Slack daily summaries for Shopee and Lazada, plus the TS poster
that delivers payloads to Slack via `@slack/web-api`.

## Pipeline

```
[ode cron fires]
   |
   v
[Agent runs the cron --message]
   |
   v
python3 scripts/<platform>_daily_summary.py --mode <morning|evening> --channel C...
   |   (fetches via platform_helpers.<platform>.safe_run, builds Slack blocks)
   v
JSON envelope on stdout
   |
   v
bun run scripts/post_daily_update.ts
   |
   v
@slack/web-api -> chat.postMessage -> Slack channel
```

## Files

| File | Role |
|------|------|
| `shopee_daily_summary.py` | Data fetcher for Shopee. Emits JSON envelope (channel, text, blocks, summary) to stdout. No Slack I/O. |
| `lazada_daily_summary.py` | Data fetcher for Lazada. Same contract. |
| `shopee_slack_blocks.py` | Pure formatter. Builds the Slack `blocks` payload (header + action buttons). |
| `post_daily_update.ts` | Bun/TS poster. Reads JSON from stdin and posts to Slack. |
| `shopee-actions.ts` *(in `packages/ims/slack/`)* | Slack interactivity handlers for the ship-all / ship-near-SLA buttons (with confirmation step). |

## CLI contract

Both python scripts accept `--mode {morning,evening}` and `--channel <C_ID>`.
Shopee adds `--max-pages` and `--hours`. Lazada adds `--date`.

Stdout on success:
```json
{
  "ok": true,
  "platform": "shopee",
  "channel": "C0B2QN88GSH",
  "text": "Shopee morning update (2026-06-07)",
  "blocks": [ ... ],
  "summary": { ... }
}
```

Stdout on failure (exit 1):
```json
{ "ok": false, "error": "..." }
```

When the underlying platform call fails, the scripts still produce `ok: true`
with the error embedded in the `text`/`blocks` payload so the user sees a
"summary error" message in Slack instead of silent failure.

## Auth for `post_daily_update.ts`

Resolves the Slack bot token in this order:

1. `process.env.SLACK_BOT_TOKEN`
2. `~/.config/ode/settings.json` -> `workspaces[].slackBotToken`
3. `~/.config/ode/ode.json` -> `workspaces[].slackBotToken`

## Manual usage

```bash
# Shopee morning to channel C0B2QN88GSH
python3 scripts/shopee_daily_summary.py --mode morning --channel C0B2QN88GSH \
  | bun run scripts/post_daily_update.ts

# Lazada evening with a custom date
python3 scripts/lazada_daily_summary.py --mode evening --channel C0AUMS4UTJB --date 2026-06-06 \
  | bun run scripts/post_daily_update.ts
```

## Scheduled via `ode cron`

See `ode cron list` for the four jobs that drive this pipeline:
- `Shopee morning`  -> 08:30 MYT -> `C0B2QN88GSH`
- `Shopee evening`  -> 17:00 MYT -> `C0B2QN88GSH`
- `Lazada morning`  -> 08:30 MYT -> `C0AUMS4UTJB`
- `Lazada evening`  -> 17:00 MYT -> `C0AUMS4UTJB`

Cron runs Ode in a fresh worktree per execution (per `AGENTS.md`), so the
repo's `.venv/bin/python` and `platform_helpers` modules are always available.

## Timezone

All times are Malaysia Time (UTC+8). The python scripts use a `MALAYSIA_TZ`
constant; the cron expressions are in MYT.
