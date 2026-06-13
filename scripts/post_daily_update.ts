#!/usr/bin/env bun
/**
 * post_daily_update.ts — reads a JSON Slack payload from stdin and posts it
 * to the channel via @slack/web-api.
 *
 * Input (stdin): one JSON object produced by shopee_daily_summary.py or
 * lazada_daily_summary.py with shape:
 *   { ok, channel, text, blocks, [summary, platform] }
 *
 * Auth (in priority order):
 *   1. process.env.SLACK_BOT_TOKEN
 *   2. ~/.config/ode/settings.json -> workspaces[].slackBotToken
 *   3. ~/.config/ode/ode.json -> workspaces[].slackBotToken
 *
 * Usage:
 *   python3 scripts/shopee_daily_summary.py --mode morning --channel C0B2QN88GSH \\
 *     | bun run scripts/post_daily_update.ts
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { WebClient } from "@slack/web-api";

type DailyPayload = {
  ok: boolean;
  platform?: string;
  channel?: string;
  text?: string;
  blocks?: unknown[];
  error?: string;
};

const CONFIG_PATHS = [
  join(homedir(), ".config", "ode", "settings.json"),
  join(homedir(), ".config", "ode", "ode.json"),
];

async function readStdin(): Promise<string> {
  return new TextDecoder("utf-8").decode(await new Response(Bun.stdin).arrayBuffer());
}

async function resolveBotToken(): Promise<string | undefined> {
  const envToken = process.env.SLACK_BOT_TOKEN?.trim();
  if (envToken) return envToken;

  for (const path of CONFIG_PATHS) {
    if (!existsSync(path)) continue;
    try {
      const raw = await readFile(path, "utf8");
      const json = JSON.parse(raw) as {
        workspaces?: Array<{ slackBotToken?: string; type?: string; status?: string }>;
      };
      const candidates = (json.workspaces ?? []).filter(
        (w) =>
          w.slackBotToken &&
          w.slackBotToken.trim().length > 0 &&
          (w.type === undefined || w.type === "slack") &&
          (w.status === undefined || w.status === "active"),
      );
      const token = candidates[0]?.slackBotToken?.trim();
      if (token) return token;
    } catch (err) {
      console.warn(`[post_daily_update] failed to read ${path}: ${err}`);
    }
  }
  return undefined;
}

async function main(): Promise<number> {
  const raw = (await readStdin()).trim();
  if (!raw) {
    console.error("[post_daily_update] empty stdin payload");
    return 1;
  }

  let payload: DailyPayload;
  try {
    payload = JSON.parse(raw) as DailyPayload;
  } catch (err) {
    console.error(`[post_daily_update] invalid JSON: ${err}`);
    console.error(raw);
    return 1;
  }

  if (!payload.ok) {
    console.error(
      `[post_daily_update] payload.ok=false: ${payload.error ?? "unknown error"}`,
    );
    return 1;
  }
  if (!payload.channel) {
    console.error("[post_daily_update] payload missing channel");
    return 1;
  }
  if (!payload.text) {
    console.error("[post_daily_update] payload missing text");
    return 1;
  }

  const token = await resolveBotToken();
  if (!token) {
    console.error(
      "[post_daily_update] no Slack bot token found in env or ~/.config/ode/",
    );
    return 1;
  }

  const client = new WebClient(token);
  const result = await client.chat.postMessage({
    channel: payload.channel,
    text: payload.text,
    blocks: payload.blocks as never,
  });

  if (!result.ok) {
    console.error(
      `[post_daily_update] chat.postMessage failed: ${result.error ?? "unknown"}`,
    );
    return 1;
  }

  const tail = result.message?.text?.split("\n", 1)[0] ?? payload.text;
  console.log(
    `[post_daily_update] posted to ${payload.channel} (${payload.platform ?? "?"}) ts=${result.ts} | ${tail}`,
  );
  return 0;
}

process.exit(await main().catch((err) => {
  console.error(`[post_daily_update] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  return 1;
}));
