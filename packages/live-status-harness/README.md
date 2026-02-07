# Live Status Harness

Standalone harness for collecting real agent stream events and replaying them into live status messages.

## Why

This module isolates stream capture and status rendering from the normal Ode runtime so agent live-status changes are testable, deterministic, and safe to iterate.

## Fixed Prompt

The baseline prompt is stored in `packages/live-status-harness/fixed-prompt.md`.

## Capture stream data into Redis

```bash
bun run packages/live-status-harness/scripts/capture-stream.ts --provider opencode
```

Optional flags:

- `--provider opencode|claudecode|codex|kimi`
- `--cwd <path>`
- `--channel <id>`
- `--thread <id>`
- `--user <id>`
- `--run-id <id>`
- `--prompt-file <path>`
- `--model <provider/model>` (or `<model>`, defaults provider to `openai`)
- `--redis-prefix <prefix>`

## Render captured data into live status output

```bash
bun run packages/live-status-harness/scripts/render-status.ts --run-id <runId>
```

If `--run-id` is omitted, the latest run in Redis is used.

## Generate a full provider report markdown

```bash
bun run packages/live-status-harness/scripts/generate-report.ts
```

This runs capture + render for each provider (`opencode`, `claudecode`, `codex`, `kimi`), then writes a combined report with each provider's final live status message and final result message.

For `opencode`, the report run forces model `openai/gpt-5.3-codex` so it does not depend on channel-level model config.

Optional flags:

- `--providers opencode,claudecode,codex,kimi`
- `--output <path>` (default: `packages/live-status-harness/reports/agent-live-status.md`)
- `--cwd <path>`
- `--prompt-file <path>`
- `--redis-prefix <prefix>`
- `--fail-fast` to stop on first provider failure

## Redis keys

- `<prefix>:runs:index` sorted set of run ids
- `<prefix>:runs:<runId>:meta` run metadata JSON
- `<prefix>:runs:<runId>:events` ordered raw stream events
- `<prefix>:runs:<runId>:rendered` rendered live statuses JSON
