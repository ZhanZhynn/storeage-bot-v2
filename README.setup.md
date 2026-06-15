# First-Time Setup Guide

## Prerequisites

- **Bun** (runtime): `curl -fsSL https://bun.sh/install | bash`
- **Python 3.10+** (for marketplace CLI helpers)
- **An OpenCode API key** (or other coding CLI — see supported agents in `start.sh`)
- **Slack workspace** with a bot token (see Slack OAuth section below)

## Quick Start

```bash
git clone <repo-url> storeage-bot-v2
cd storeage-bot-v2

# Set required env var
export OPENCODE_API_KEY=sk_your_key

# Start the bot — auto-creates ~/.config/ode/settings.json, .venv, installs platform_helpers
./start.sh
```

On first run, `start.sh` will:
1. Check `OPENCODE_API_KEY` is set
2. Create `~/.config/ode/settings.json` with default agent configs
3. Create a Python `.venv` and install `platform_helpers` + dependencies
4. Launch the bot via `bun run packages/core/index.ts`

> **Important**: After `start.sh` creates `settings.json`, it **exits** so you can add your Slack workspace credentials. See below, then re-run `./start.sh`.

## Slack Workspace Setup

Edit `~/.config/ode/settings.json` and add your workspace credentials. The required fields vary by platform — consult the Ode docs for your chat app.

Example for Slack:
```json
{
  "workspaces": [
    {
      "name": "my-workspace",
      "platform": "slack",
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "signingSecret": "..."
    }
  ]
}
```

## Marketplace Authentication

The bot fetches daily summaries from **Shopee** and **Lazada**. Both require API credentials.

Credentials are stored in `~/.config/ode/ode.json` under `marketplace.shopee` / `marketplace.lazada`. Once set, the bot auto-refreshes tokens and persists them forever — no manual re-auth needed.

### Required Base Credentials (one-time setup)

**Shopee** — set these **via the UI** (`~/.config/ode/ode.json`) or as env vars:
```json
{
  "marketplace": {
    "shopee": {
      "partnerId": "your_partner_id",
      "partnerKey": "your_partner_key",
      "shopId": "265951653"
    }
  }
}
```
Env var equivalent:
```bash
export BOLTY_SHOPEE_PARTNER_ID=your_partner_id
export BOLTY_SHOPEE_PARTNER_KEY=your_partner_key
export BOLTY_SHOPEE_SHOP_ID=265951653
export BOLTY_SHOPEE_ENVIRONMENT=production
export BOLTY_SHOPEE_REGION=my
```

**Lazada**:
```json
{
  "marketplace": {
    "lazada": {
      "appKey": "your_app_key",
      "appSecret": "your_app_secret",
      "region": "MY"
    }
  }
}
```
Env var equivalent:
```bash
export BOLTY_LAZADA_APP_KEY=your_app_key
export BOLTY_LAZADA_APP_SECRET=your_app_secret
export BOLTY_LAZADA_REGION=MY
```

### Option A: OAuth Flow (get tokens from scratch)

#### Shopee

```bash
# 1. Generate the authorization URL — open this in a browser
python3 -m platform_helpers.shopee.cli auth url --redirect https://your-redirect-uri

# 2. After authorizing, the browser redirects with ?code=...
#    Exchange the code for access + refresh tokens
python3 -m platform_helpers.shopee.cli auth token-get --code <code> --shop-id 265951653
```

Tokens are automatically persisted to `~/.config/ode/ode.json`.

#### Lazada

```bash
# 1. Exchange an authorization code for tokens
python3 -m platform_helpers.lazada.cli auth authorize --code <code>
```

Tokens are automatically persisted. To manually trigger a refresh later:
```bash
python3 -m platform_helpers.lazada.cli auth refresh
```

### Option B: Use Existing Tokens

If you already have tokens, write them directly to `~/.config/ode/ode.json`:

```json
{
  "marketplace": {
    "shopee": {
      "accessToken": "your-access-token",
      "refreshToken": "your-refresh-token",
      "accessTokenExpiresAt": 1718000000
    },
    "lazada": {
      "accessToken": "your-access-token",
      "refreshToken": "your-refresh-token",
      "accessTokenExpiresAt": 1718000000,
      "refreshExpiresAt": 1723000000
    }
  }
}
```

Or via env vars:
```bash
# Export from existing ode.json
bun run scripts/export-marketplace-env.ts
```

## Token Auto-Renewal

Once credentials are in `~/.config/ode/ode.json`, the bot handles the rest:

- **Shopee**: access token ~4h, refresh token rotates every refresh (30-day validity, old refresh valid for 4h after rotation)
- **Lazada**: access token 10 days, refresh token fixed for 50 days (cannot be refreshed — must re-authorize after 50 days)
- Both platforms: tokens + expiry timestamps are persisted on every refresh cycle
- On cold start, the bot reads persisted timestamps and skips refresh if still valid

## Verify It Works

```bash
# Test Shopee — fetch 1 order
python3 -m platform_helpers.shopee.cli orders get --offset 0 --limit 1

# Test Lazada — fetch 1 order
python3 -m platform_helpers.lazada.cli orders get --offset 0 --limit 1

# Confirm tokens are persisted
cat ~/.config/ode/ode.json | python3 -m json.tool
```

## Running Daily Summaries

After everything is configured, seed the cron jobs:

```bash
bun run scripts/seed_daily_cron_jobs.ts
```

This registers morning/evening cron jobs for both Shopee and Lazada summaries. The bot picks them up automatically and starts posting to the configured channels.

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `403 Forbidden` on Shopee API | Stale token | Refresh or re-auth |
| `_should_refresh` runs every start | Expiry timestamp missing | Run token refresh once to persist timestamps |
| `OPENCODE_API_KEY not set` | Missing env var | `export OPENCODE_API_KEY=sk_...` |
| `.venv` not found | Python not installed | Install Python 3.10+ and re-run `./start.sh` |
