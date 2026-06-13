#!/usr/bin/env bun
/**
 * post_daily_update.ts — reads a JSON payload from stdin and posts it
 * to the chat channel. Auto-detects the platform (Slack or Telegram) from
 * the workspace config.
 *
 * Input (stdin): one JSON object produced by shopee_daily_summary.py or
 * lazada_daily_summary.py with shape:
 *   { ok, channel, text, blocks, [summary, platform] }
 *
 * Auth:
 *   - Slack: process.env.SLACK_BOT_TOKEN or ~/.config/ode/settings.json
 *   - Telegram: process.env.TELEGRAM_BOT_TOKEN or ~/.config/ode/settings.json
 *
 * Usage:
 *   python3 scripts/shopee_daily_summary.py --mode morning --channel C0B2QN88GSH \
 *     | bun run scripts/post_daily_update.ts
 */

import { readFileSync } from "node:fs";
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

type ChannelConfig = {
  id: string;
  name: string;
};

type WorkspaceConfig = {
  id: string;
  type?: string;
  name?: string;
  status?: string;
  slackBotToken?: string;
  telegramBotToken?: string;
  channelDetails?: ChannelConfig[];
};

type OdeConfig = {
  workspaces?: WorkspaceConfig[];
};

const CONFIG_PATHS = [
  join(homedir(), ".config", "ode", "settings.json"),
  join(homedir(), ".config", "ode", "ode.json"),
];

async function readStdin(): Promise<string> {
  return new TextDecoder("utf-8").decode(await new Response(Bun.stdin).arrayBuffer());
}

function loadOdeConfig(): OdeConfig {
  for (const path of CONFIG_PATHS) {
    if (!existsSync(path)) continue;
    try {
      const raw = readFileSync(path, "utf8");
      return JSON.parse(raw) as OdeConfig;
    } catch {
      // continue
    }
  }
  return { workspaces: [] };
}

const SLACK_EMOJI_MAP: Record<string, string> = {
  "city_sunset": "\u{1F306}", // 🌆
  "sunrise": "\u{1F305}", // 🌅
  "hourglass_flowing_sand": "\u23F3", // ⏳
  "money_with_wings": "\u{1F4B0}", // 💰
  "wave": "\u{1F44B}", // 👋
  "package": "\u{1F4E6}", // 📦
  "truck": "\u{1F69A}", // 🚚
  "rocket": "\u{1F680}", // 🚀
  "shopping_trolley": "\u{1F6D2}", // 🛒
  "warning": "\u26A0\uFE0F", // ⚠️
  "white_check_mark": "\u2705", // ✅
  "muscle": "\u{1F4AA}", // 💪
  "link": "\u{1F517}", // 🔗
  "zzz": "\u{1F4A4}", // 💤
  "chart_with_upwards_trend": "\u{1F4C8}", // 📈
  "chart_with_downwards_trend": "\u{1F4C9}", // 📉
  "arrow_up": "\u2B06\uFE0F", // ⬆️
  "arrow_down": "\u2B07\uFE0F", // ⬇️
  "dollar": "\u{1F4B5}", // 💵
  "exclamation": "\u2757", // ❗
  "heavy_check_mark": "\u2705", // ✅
  "x": "\u274C", // ❌
  "bulb": "\u{1F4A1}", // 💡
  "star": "\u2B50", // ⭐
};

function simulateEmoji(text: string): string {
  return text.replace(/:([a-z_]+):/g, (_, name) => {
    return SLACK_EMOJI_MAP[name] ?? `:${name}:`;
  });
}

function slackMrkdwnToHtml(text: string): string {
  text = simulateEmoji(text);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/<(https?:\/\/[^\|>]+)\|([^>]+)>/g, '<a href="$1">$2</a>')
    .replace(/<(https?:\/\/[^>]+)>/g, '<a href="$1">$1</a>')
    .replace(/```([^`]+)```/g, "<pre>$1</pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*([^*]+)\*/g, "<b>$1</b>")
    .replace(/_([^_]+)_/g, "<i>$1</i>")
    .replace(/~([^~]+)~/g, "<s>$1</s>");
}

function renderBlocksToTelegramHtml(blocks: unknown[], fallbackText: string): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return slackMrkdwnToHtml(fallbackText);

  const parts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;

    if (b.type === "divider") {
      parts.push("\n—————————\n");
      continue;
    }

    if (b.type === "section") {
      const textObj = b.text as Record<string, unknown> | undefined;
      if (textObj?.text && typeof textObj.text === "string") {
        parts.push(slackMrkdwnToHtml(textObj.text));
      }

      const fields = b.fields as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(fields)) {
        for (const field of fields) {
          if (field?.text && typeof field.text === "string") {
            parts.push(slackMrkdwnToHtml(field.text));
          }
        }
      }
      continue;
    }

    if (b.type === "actions") continue;
  }

  return parts.length > 0 ? parts.join("\n\n") : slackMrkdwnToHtml(fallbackText);
}

function resolvePlatform(channelId: string): {
  type: "slack" | "telegram";
  token: string | undefined;
} {
  const envTgToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const envSlackToken = process.env.SLACK_BOT_TOKEN?.trim();

  if (envTgToken) {
    return { type: "telegram", token: envTgToken };
  }

  const config = loadOdeConfig();
  for (const ws of config.workspaces ?? []) {
    if (!ws.channelDetails?.some((ch) => ch.id === channelId)) continue;
    if (ws.type === "telegram") {
      const token = ws.telegramBotToken?.trim();
      if (token) return { type: "telegram", token };
    }
    if (ws.type === "slack" || !ws.type) {
      const token = ws.slackBotToken?.trim();
      if (token) return { type: "slack", token };
    }
  }

  if (envSlackToken) {
    return { type: "slack", token: envSlackToken };
  }

  for (const path of CONFIG_PATHS) {
    if (!existsSync(path)) continue;
    try {
      const raw = readFileSync(path, "utf8");
      const json = JSON.parse(raw) as OdeConfig;
      const candidates = (json.workspaces ?? []).filter(
        (w) =>
          w.slackBotToken?.trim() &&
          (w.type === undefined || w.type === "slack") &&
          w.status !== "paused",
      );
      const token = candidates[0]?.slackBotToken?.trim();
      if (token) return { type: "slack", token };
    } catch {
      // continue
    }
  }

  return { type: "slack", token: undefined };
}

async function postToTelegram(
  channelId: string,
  text: string,
  botToken: string,
  blocks?: unknown[],
): Promise<string | undefined> {
  const html = renderBlocksToTelegramHtml(blocks ?? [], text);
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: channelId,
      text: html,
      parse_mode: "HTML",
    }),
  });

  const data = (await resp.json()) as {
    ok: boolean;
    description?: string;
    result?: { message_id?: number };
  };

  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description ?? "unknown"}`);
  }

  return data.result?.message_id?.toString();
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

  const { type: platform, token } = resolvePlatform(payload.channel);

  if (platform === "telegram") {
    if (!token) {
      console.error(
        "[post_daily_update] no Telegram bot token found in env or ~/.config/ode/",
      );
      return 1;
    }
    try {
      const messageId = await postToTelegram(payload.channel, payload.text, token, payload.blocks);
      const tail = payload.text.split("\n", 1)[0] ?? payload.text;
      console.log(
        `[post_daily_update] posted to Telegram ${payload.channel} (${payload.platform ?? "?"}) message_id=${messageId} | ${tail}`,
      );
      return 0;
    } catch (err) {
      console.error(
        `[post_daily_update] Telegram sendMessage failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 1;
    }
  }

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
