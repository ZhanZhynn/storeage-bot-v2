import type { App } from "@slack/bolt";
import { WebClient, type Block, type KnownBlock } from "@slack/web-api";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

export const SHOPEE_SHIP_ALL_PENDING_ACTION = "shopee_ship_all_pending";
export const SHOPEE_SHIP_ALL_CONFIRM_ACTION = "shopee_ship_all_confirm";
export const SHOPEE_SHIP_NEAR_SLA_ACTION = "shopee_ship_near_sla";
export const SHOPEE_SHIP_NEAR_SLA_CONFIRM_ACTION = "shopee_ship_near_sla_confirm";
export const SHOPEE_SHIP_CANCEL_ACTION = "shopee_ship_cancel";

type SlackActionBody = {
  actions?: Array<{ action_id?: string; value?: string }>;
  channel?: { id?: string };
  user?: { id?: string };
  message?: { ts?: string };
};

type ActionPayload = {
  action: "ship_all" | "ship_near_sla";
  channel: string;
  hours: number;
  max_pages: number;
};

type ConfirmPayload = ActionPayload & { source_ts?: string };

const PYTHON_BIN = resolve(process.cwd(), ".venv", "bin", "python");
const REPO_ROOT = process.cwd();
const SAFE_RUN_TIMEOUT_MS = 600_000;

function getActionValue(body: SlackActionBody): string | undefined {
  return body.actions?.[0]?.value;
}

function getActionChannelId(body: SlackActionBody): string | undefined {
  return body.channel?.id;
}

function getActionUserId(body: SlackActionBody): string | undefined {
  return body.user?.id;
}

function parseJson(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildEphemeralBlocks(
  text: string,
  confirmActionId: string,
  payload: ConfirmPayload,
  cancelValue = "ok",
): (Block | KnownBlock)[] {
  return [
    { type: "section", text: { type: "mrkdwn", text } },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: confirmActionId,
          text: { type: "plain_text", text: "Yes, run it" },
          style: "danger",
          value: JSON.stringify(payload),
          confirm: {
            title: { type: "plain_text", text: "Confirm action" },
            text: { type: "mrkdwn", text: "This will arrange shipments via the Shopee API." },
            confirm: { type: "plain_text", text: "Run" },
            deny: { type: "plain_text", text: "Cancel" },
          },
        },
        {
          type: "button",
          action_id: SHOPEE_SHIP_CANCEL_ACTION,
          text: { type: "plain_text", text: "Cancel" },
          value: cancelValue,
        },
      ],
    },
  ];
}

function runSafeRun(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolveP) => {
    const child = spawn(PYTHON_BIN, ["-m", "platform_helpers.shopee.safe_run", "--", ...args], {
      cwd: REPO_ROOT,
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolveP({ ok: false, stdout, stderr: `${stderr}\n[killed after ${SAFE_RUN_TIMEOUT_MS}ms]`, code: null });
    }, SAFE_RUN_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolveP({ ok: false, stdout, stderr: `${stderr}\nspawn error: ${err.message}`, code: null });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveP({ ok: code === 0, stdout, stderr, code });
    });
  });
}

async function runShipAll(client: WebClient, channelId: string, userId: string, payload: ActionPayload): Promise<void> {
  const result = await runSafeRun([
    "orders",
    "ship-all",
    "--max-pages",
    String(payload.max_pages),
  ]);
  const summary = formatResult(result, "ship-all");
  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: `:ferry: ship-all result: ${summary.headline}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: summary.body } },
    ],
  });
}

async function runSlaCheck(client: WebClient, channelId: string, userId: string, payload: ActionPayload): Promise<void> {
  const result = await runSafeRun([
    "orders",
    "sla-check",
    "--hours",
    String(payload.hours),
    "--max-pages",
    String(payload.max_pages),
  ]);
  const summary = formatResult(result, "sla-check");
  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: `:alarm_clock: sla-check result: ${summary.headline}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: summary.body } },
    ],
  });
}

function formatResult(
  result: { ok: boolean; stdout: string; stderr: string; code: number | null },
  label: string,
): { headline: string; body: string } {
  if (!result.ok) {
    return {
      headline: `${label} failed`,
      body: `:x: *${label} failed*\n\`\`\`${(result.stderr || result.stdout || "no output").slice(0, 1500)}\`\`\``,
    };
  }
  const trimmed = result.stdout.trim();
  if (!trimmed) {
    return { headline: `${label} returned no output`, body: `:warning: ${label} returned empty stdout` };
  }
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(trimmed.split("\n").pop() ?? trimmed) as Record<string, unknown>;
  } catch {
    return {
      headline: `${label} returned unparseable output`,
      body: `:warning: ${label} stdout (first 1500 chars):\n\`\`\`${trimmed.slice(0, 1500)}\`\`\``,
    };
  }
  if (parsed.ok === false) {
    return {
      headline: `${label} reported failure`,
      body: `:x: *${label}* error: \`${String(parsed.error ?? "unknown")}\``,
    };
  }
  const keys = Object.keys(parsed).filter((k) => k !== "ok").slice(0, 12);
  const lines = keys.map((k) => `• *${k}:* ${JSON.stringify(parsed[k]).slice(0, 200)}`);
  return {
    headline: `${label} ok`,
    body: `:white_check_mark: *${label}* completed\n${lines.join("\n")}`,
  };
}

export function registerShopeeShipActions(app: App): void {
  app.action(SHOPEE_SHIP_ALL_PENDING_ACTION, async ({ ack, body, client }) => {
    await ack();
    const actionBody = body as SlackActionBody;
    const channelId = getActionChannelId(actionBody);
    const userId = getActionUserId(actionBody);
    if (!channelId || !userId) return;
    const payload = parseJson(getActionValue(actionBody)) as unknown as ActionPayload | null;
    if (!payload) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: "Could not parse ship-all payload.",
      });
      return;
    }
    const confirmPayload: ConfirmPayload = {
      ...payload,
      action: "ship_all",
      source_ts: actionBody.message?.ts,
    };
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: ":ferry: Confirm ship-all pending",
      blocks: buildEphemeralBlocks(
        `:ferry: *Confirm ship-all pending?*\nThis will arrange shipment for all ${payload.max_pages}-page worth of pending packages.`,
        SHOPEE_SHIP_ALL_CONFIRM_ACTION,
        confirmPayload,
      ),
    });
  });

  app.action(SHOPEE_SHIP_NEAR_SLA_ACTION, async ({ ack, body, client }) => {
    await ack();
    const actionBody = body as SlackActionBody;
    const channelId = getActionChannelId(actionBody);
    const userId = getActionUserId(actionBody);
    if (!channelId || !userId) return;
    const payload = parseJson(getActionValue(actionBody)) as unknown as ActionPayload | null;
    if (!payload) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: "Could not parse ship-near-sla payload.",
      });
      return;
    }
    const confirmPayload: ConfirmPayload = {
      ...payload,
      action: "ship_near_sla",
      source_ts: actionBody.message?.ts,
    };
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: ":alarm_clock: Confirm ship near-SLA",
      blocks: buildEphemeralBlocks(
        `:alarm_clock: *Confirm ship near-SLA?*\nThis will arrange shipment for all orders within the ${payload.hours}h SLA window (max ${payload.max_pages} pages).`,
        SHOPEE_SHIP_NEAR_SLA_CONFIRM_ACTION,
        confirmPayload,
      ),
    });
  });

  app.action(SHOPEE_SHIP_ALL_CONFIRM_ACTION, async ({ ack, body, client }) => {
    await ack();
    const actionBody = body as SlackActionBody;
    const channelId = getActionChannelId(actionBody);
    const userId = getActionUserId(actionBody);
    if (!channelId || !userId) return;
    const payload = parseJson(getActionValue(actionBody)) as unknown as ConfirmPayload | null;
    if (!payload) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: "Could not parse ship-all confirm payload.",
      });
      return;
    }
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: ":hourglass_flowing_sand: ship-all queued, running now...",
    });
    await runShipAll(client, channelId, userId, payload);
  });

  app.action(SHOPEE_SHIP_NEAR_SLA_CONFIRM_ACTION, async ({ ack, body, client }) => {
    await ack();
    const actionBody = body as SlackActionBody;
    const channelId = getActionChannelId(actionBody);
    const userId = getActionUserId(actionBody);
    if (!channelId || !userId) return;
    const payload = parseJson(getActionValue(actionBody)) as unknown as ConfirmPayload | null;
    if (!payload) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: "Could not parse ship-near-sla confirm payload.",
      });
      return;
    }
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: ":hourglass_flowing_sand: ship-near-sla queued, running now...",
    });
    await runSlaCheck(client, channelId, userId, payload);
  });

  app.action(SHOPEE_SHIP_CANCEL_ACTION, async ({ ack }) => {
    await ack();
  });
}
