#!/bin/bash
# Ode startup script
# bun run build:web
# Usage: ./start.sh

set -e

cd "$(dirname "$0")"

# Core env vars (required)
if [ -z "$OPENCODE_API_KEY" ]; then
  echo "ERROR: OPENCODE_API_KEY environment variable is not set."
  echo "Set it with: export OPENCODE_API_KEY=sk_your_key"
  exit 1
fi

# Marketplace credentials (optional - for Shopee/Lazada CLI helpers)
# export BOLTY_SHOPEE_PARTNER_ID=your_partner_id
# export BOLTY_SHOPEE_PARTNER_KEY=your_partner_key
# export BOLTY_SHOPEE_SHOP_ID=your_shop_id
# export BOLTY_SHOPEE_ACCESS_TOKEN=your_access_token
# export BOLTY_LAZADA_APP_KEY=your_app_key
# export BOLTY_LAZADA_APP_SECRET=your_app_secret
# export BOLTY_LAZADA_ACCESS_TOKEN=your_access_token
# export BOLTY_LAZADA_REGION=MY

# Ensure config directory exists
mkdir -p ~/.config/ode

# Check if settings.json exists, if not create from example
if [ ! -f ~/.config/ode/settings.json ]; then
  echo "Creating default settings.json..."
  cat > ~/.config/ode/settings.json << 'EOF'
{
  "workspaces": [],
  "agents": {
    "opencode": { "enabled": true, "models": [] },
    "claudecode": { "enabled": true },
    "codex": { "enabled": true, "models": [] },
    "kimi": { "enabled": true },
    "kiro": { "enabled": true },
    "kilo": { "enabled": true, "models": [] },
    "qwen": { "enabled": true },
    "goose": { "enabled": true },
    "gemini": { "enabled": true }
  },
  "user": {
    "name": "",
    "email": "",
    "initials": "",
    "avatar": "",
    "gitStrategy": "worktree",
    "defaultStatusMessageFormat": "medium",
    "IM_MESSAGE_UPDATE_INTERVAL_MS": 5000
  },
  "githubInfos": {},
  "completeOnboarding": false,
  "updates": {
    "autoUpgrade": true,
    "checkIntervalMs": 3600000
  }
}
EOF
  echo "Created ~/.config/ode/settings.json"
  echo "IMPORTANT: Add your Slack workspace credentials to settings.json"
  echo "Then restart: ./start.sh"
  exit 0
fi

# Install platform_helpers into .venv if not already installed
if [ ! -d ".venv" ]; then
  echo "Creating .venv for platform_helpers..."
  python3 -m venv .venv
fi

if [ -d "./platform_helpers" ]; then
  echo "Installing platform_helpers and dependencies into .venv..."
  .venv/bin/pip install --quiet requests pydantic
  .venv/bin/pip install --quiet ./platform_helpers 2>/dev/null || true
fi

# Set PYTHONPATH so python3 can find platform_helpers AND its dependencies (requests, pydantic)
# This is inherited by all child processes including OpenCode's agent subprocess
export PYTHONPATH="$PWD/platform_helpers:$PWD/.venv/lib/python3.12/site-packages:$PYTHONPATH"

echo "Starting Ode..."
exec bun run packages/core/index.ts
