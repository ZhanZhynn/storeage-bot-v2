#!/usr/bin/env bun
/**
 * seed_daily_cron_jobs.ts — seed the four daily-summary cron jobs into
 * ~/.config/ode/inbox.db. Idempotent: deletes any prior `Shopee morning`,
 * `Shopee evening`, `Lazada morning`, `Lazada evening` rows before inserting.
 *
 * Why direct SQL: the daemon's createCronJob() resolves the channel via
 * `loadOdeConfig().workspaces[].channelDetails` and fails with "Channel not
 * found in configured workspaces" when workspaces[] is empty. Inserting
 * directly with NULL workspace fields is sufficient because the scheduler
 * uses job.channelId for delivery and falls back to the first registered
 * Slack bot token (per packages/ims/slack/client.ts:489).
 *
 * Use this once. After that, `ode cron list` / `ode cron run <id>` will work.
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DB_PATH = join(homedir(), ".config", "ode", "inbox.db");
const SEED_TITLES = [
  "Shopee morning",
  "Shopee evening",
  "Shopee low stock",
  "Lazada morning",
  "Lazada evening",
  "Lazada low stock",
];

const MY_TZ_OFFSET_HOURS = 8; // Malaysia Time
function nowMs(): number {
  return Date.now();
}
function toIsoForCron(d: Date, hour: number, minute: number): string {
  // We use 5-field cron expressions: minute hour day month weekday.
  // Cron daemon's TZ will determine when it actually fires; we set it to MYT
  // by relying on the host's TZ env (assumed set to Asia/Kuala_Lumpur).
  return `${minute} ${hour} * * *`;
}

type Job = {
  title: string;
  channelId: string;
  scheduleHour: number;
  scheduleMinute: number;
  cronExpression?: string; // optional override (e.g. "0 10,14,18,22 * * *")
  platform: "slack" | "discord" | "lark";
  messageText: string;
};

const JOBS: Job[] = [
  {
    title: "Shopee morning",
    channelId: "C0B2QN88GSH",
    scheduleHour: 8,
    scheduleMinute: 30,
    platform: "slack",
    messageText:
      "Run the daily Shopee morning summary and post it to channel C0B2QN88GSH.\n" +
      "Use this exact pipeline from the repo root:\n" +
      "  python3 scripts/shopee_daily_summary.py --mode morning --channel C0B2QN88GSH | bun run scripts/post_daily_update.ts\n" +
      "Return the resulting ts from post_daily_update.ts.",
  },
  {
    title: "Shopee evening",
    channelId: "C0B2QN88GSH",
    scheduleHour: 17,
    scheduleMinute: 0,
    platform: "slack",
    messageText:
      "Run the daily Shopee evening summary and post it to channel C0B2QN88GSH.\n" +
      "Use this exact pipeline from the repo root:\n" +
      "  python3 scripts/shopee_daily_summary.py --mode evening --channel C0B2QN88GSH | bun run scripts/post_daily_update.ts\n" +
      "Return the resulting ts from post_daily_update.ts.",
  },
  {
    title: "Lazada morning",
    channelId: "C0AUMS4UTJB",
    scheduleHour: 8,
    scheduleMinute: 30,
    platform: "slack",
    messageText:
      "Run the daily Lazada morning summary and post it to channel C0AUMS4UTJB.\n" +
      "Use this exact pipeline from the repo root:\n" +
      "  python3 scripts/lazada_daily_summary.py --mode morning --channel C0AUMS4UTJB | bun run scripts/post_daily_update.ts\n" +
      "Return the resulting ts from post_daily_update.ts.",
  },
  {
    title: "Lazada evening",
    channelId: "C0AUMS4UTJB",
    scheduleHour: 17,
    scheduleMinute: 0,
    platform: "slack",
    messageText:
      "Run the daily Lazada evening summary and post it to channel C0AUMS4UTJB.\n" +
      "Use this exact pipeline from the repo root:\n" +
      "  python3 scripts/lazada_daily_summary.py --mode evening --channel C0AUMS4UTJB | bun run scripts/post_daily_update.ts\n" +
      "Return the resulting ts from post_daily_update.ts.",
  },
  {
    title: "Shopee low stock",
    channelId: "C0B2QN88GSH",
    scheduleHour: 10,
    scheduleMinute: 0,
    cronExpression: "0 10,14,18,22 * * *",
    platform: "slack",
    messageText:
      "Run the Shopee low stock + high sales alert and post to both Slack and Telegram.\n" +
      "Pipeline from repo root (run both, one per channel):\n" +
      "  python3 scripts/shopee_low_stock_alert.py --channel C0B2QN88GSH | bun run scripts/post_daily_update.ts\n" +
      "  python3 scripts/shopee_low_stock_alert.py --channel -1004450247696 | bun run scripts/post_daily_update.ts\n" +
      "Return the result.",
  },
  {
    title: "Lazada low stock",
    channelId: "C0AUMS4UTJB",
    scheduleHour: 10,
    scheduleMinute: 0,
    cronExpression: "0 10,14,18,22 * * *",
    platform: "slack",
    messageText:
      "Run the Lazada low stock + high sales alert and post to both Slack and Telegram.\n" +
      "Pipeline from repo root (run both, one per channel):\n" +
      "  python3 scripts/lazada_low_stock_alert.py --channel C0AUMS4UTJB | bun run scripts/post_daily_update.ts\n" +
      "  python3 scripts/lazada_low_stock_alert.py --channel -1004450247696 | bun run scripts/post_daily_update.ts\n" +
      "Return the result.",
  },
];

function ensureDb(): Database {
  if (!existsSync(DB_PATH)) {
    throw new Error(`inbox.db not found at ${DB_PATH}. Run ode once to initialize.`);
  }
  return new Database(DB_PATH);
}

function deleteExistingByTitle(db: Database, title: string): number {
  const result = db.query("DELETE FROM cron_jobs WHERE title = ?").run(title);
  return result.changes ?? 0;
}

function insertJob(db: Database, job: Job): string {
  const id = crypto.randomUUID();
  const now = nowMs();
  const cronExpression = job.cronExpression ?? toIsoForCron(new Date(), job.scheduleHour, job.scheduleMinute);
  db.query(`
    INSERT INTO cron_jobs (
      id, title, cron_expression, platform,
      workspace_id, workspace_name,
      channel_id, channel_name,
      message_text, enabled, last_run_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, ?, 1, 'idle', ?, ?)
  `).run(id, job.title, cronExpression, job.platform, job.channelId, job.messageText, now, now);
  return id;
}

function main(): number {
  const db = ensureDb();
  let totalInserted = 0;
  let totalDeleted = 0;
  for (const job of JOBS) {
    const removed = deleteExistingByTitle(db, job.title);
    totalDeleted += removed;
    const id = insertJob(db, job);
    totalInserted += 1;
    const cronExpr = job.cronExpression ?? toIsoForCron(new Date(), job.scheduleHour, job.scheduleMinute);
    console.log(
      `+ ${job.title.padEnd(18)} ${job.platform} ${job.channelId} ` +
        `cron="${cronExpr}" ` +
        `id=${id} (replaced ${removed})`,
    );
  }
  console.log(`\nDone. Inserted ${totalInserted}, deleted ${totalDeleted}.`);
  console.log(`Verify with: bun run packages/core/cli.ts cron list`);
  return 0;
}

process.exit(main());
