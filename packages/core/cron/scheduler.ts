import { createAgentAdapter } from "@/agents/adapter";
import type { OpenCodeMessageContext } from "@/agents";
import {
  getChannelBaseBranch,
  getChannelModel,
  getChannelSystemMessage,
  getUserGeneralSettings,
  resolveChannelCwd,
} from "@/config";
import {
  type CronJobRecord,
  listEnabledCronJobs,
  markCronJobCompleted,
  markCronJobFailed,
  markCronJobTriggered,
} from "@/config/local/cron-jobs";
import {
  completeInboxRecord,
  failInboxRecord,
  recordInboxRequest,
} from "@/config/local/inbox";
import {
  loadSession,
  saveSession,
  type PersistedSession,
} from "@/config/local/sessions";
import { matchesCronExpression } from "@/core/cron/expression";
import { buildMessageOptions } from "@/core/runtime/message-options";
import { buildFinalResponseText, categorizeRuntimeError } from "@/core/runtime/helpers";
import { buildSessionEnvironment, prepareSessionWorkspace } from "@/core/session";
import { sendChannelMessage as sendDiscordChannelMessage } from "@/ims/discord/client";
import { sendChannelMessage as sendLarkChannelMessage } from "@/ims/lark/client";
import { sendChannelMessage as sendSlackChannelMessage } from "@/ims/slack/client";
import { log } from "@/utils";

const CRON_POLL_INTERVAL_MS = 15_000;

let cronSchedulerTimer: ReturnType<typeof setInterval> | null = null;
const runningJobIds = new Set<string>();

function getCronThreadId(jobId: string): string {
  return `cron-job:${jobId}`;
}

function getCronUserId(jobId: string): string {
  return `cron-job:${jobId}`;
}

function buildInboxRecordId(jobId: string, minuteStartMs: number): string {
  return `cron:${jobId}:${minuteStartMs}`;
}

function resolveInboxModelForCron(job: CronJobRecord, options: ReturnType<typeof buildMessageOptions>): string | null {
  const explicitModel = options?.model;
  if (explicitModel?.providerID && explicitModel.modelID) {
    return `${explicitModel.providerID}/${explicitModel.modelID}`;
  }
  const fallbackModel = getChannelModel(job.channelId)?.trim();
  return fallbackModel && fallbackModel.length > 0 ? fallbackModel : null;
}

async function sendResultToChannel(job: CronJobRecord, text: string): Promise<void> {
  if (job.platform === "slack") {
    await sendSlackChannelMessage(job.channelId, text);
    return;
  }
  if (job.platform === "discord") {
    await sendDiscordChannelMessage(job.channelId, text);
    return;
  }
  await sendLarkChannelMessage(job.channelId, text);
}

function buildCronAgentContext(job: CronJobRecord): OpenCodeMessageContext {
  const userId = getCronUserId(job.id);
  const threadId = getCronThreadId(job.id);
  return {
    slack: {
      platform: job.platform,
      channelId: job.channelId,
      threadId,
      userId,
      hasGitHubToken: false,
      channelSystemMessage: getChannelSystemMessage(job.channelId) ?? undefined,
    },
  };
}

async function prepareCronSession(job: CronJobRecord): Promise<{
  session: PersistedSession;
  sessionId: string;
  cwd: string;
  created: boolean;
}> {
  const threadId = getCronThreadId(job.id);
  const userId = getCronUserId(job.id);
  const agent = createAgentAdapter();

  let cwd = resolveChannelCwd(job.channelId).cwd;
  let session = loadSession(job.channelId, threadId);
  if (session?.workingDirectory) {
    cwd = session.workingDirectory;
  }

  const { env: sessionEnv, gitIdentity } = buildSessionEnvironment({
    threadOwnerUserId: userId,
  });

  const { sessionId } = await agent.getOrCreateSession(job.channelId, threadId, cwd, sessionEnv);
  const created = !session;

  if (created && getUserGeneralSettings().gitStrategy === "worktree") {
    const baseBranch = getChannelBaseBranch(job.channelId);
    const prepared = await prepareSessionWorkspace({
      channelId: job.channelId,
      threadId,
      cwd,
      worktreeId: `ode_cron_${job.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
      baseBranch,
      sessionEnv,
      gitIdentity,
    });
    cwd = prepared.cwd;
  }

  if (!session) {
    session = {
      sessionId,
      providerId: agent.getProviderForSession(sessionId),
      platform: job.platform,
      channelId: job.channelId,
      threadId,
      workingDirectory: cwd,
      threadOwnerUserId: userId,
      participantBotIds: ["cron-job"],
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      lastActivityBotId: "cron-job",
    };
  } else {
    session.sessionId = sessionId;
    session.providerId = agent.getProviderForSession(sessionId);
    session.platform = job.platform;
    session.workingDirectory = cwd;
    session.lastActivityBotId = "cron-job";
  }

  saveSession(session);
  return { session, sessionId, cwd, created };
}

async function runCronJob(job: CronJobRecord, minuteStartMs: number): Promise<void> {
  const agent = createAgentAdapter();
  const inboxRecordId = buildInboxRecordId(job.id, minuteStartMs);

  try {
    const { session, sessionId, cwd } = await prepareCronSession(job);
    const providerId = agent.getProviderForSession(sessionId);
    const options = buildMessageOptions({
      text: job.messageText,
      channelId: job.channelId,
      providerId,
    });

    recordInboxRequest({
      id: inboxRecordId,
      platform: job.platform,
      sourceKind: "cron_job",
      cronJobId: job.id,
      cronJobTitle: job.title,
      channelId: job.channelId,
      threadId: getCronThreadId(job.id),
      replyThreadId: getCronThreadId(job.id),
      sessionId,
      userId: getCronUserId(job.id),
      messageId: String(minuteStartMs),
      providerId,
      model: resolveInboxModelForCron(job, options),
      workingDirectory: cwd,
      promptText: job.messageText,
      context: {
        sourceKind: "cron_job",
        cronJobId: job.id,
        cronJobTitle: job.title,
        scheduledMinuteStartMs: minuteStartMs,
        isFirstMessageInThread: false,
      },
    });

    const responses = await agent.sendMessage(
      job.channelId,
      sessionId,
      job.messageText,
      cwd,
      options,
      buildCronAgentContext(job)
    );
    const finalText = buildFinalResponseText(responses) ?? "_Done_";

    await sendResultToChannel(job, finalText);
    completeInboxRecord({
      id: inboxRecordId,
      resultText: finalText,
      sessionId,
      providerId,
      model: resolveInboxModelForCron(job, options),
      workingDirectory: cwd,
    });
    markCronJobCompleted(job.id);
  } catch (error) {
    const { message } = categorizeRuntimeError(error);
    failInboxRecord({
      id: inboxRecordId,
      errorText: message,
    });
    markCronJobFailed(job.id, message);
    log.warn("Cron job execution failed", {
      cronJobId: job.id,
      title: job.title,
      channelId: job.channelId,
      error: String(error),
    });
  }
}

async function tickCronJobs(): Promise<void> {
  const now = new Date();
  const minuteStartMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    0,
    0
  ).getTime();

  const jobs = listEnabledCronJobs();
  for (const job of jobs) {
    if (runningJobIds.has(job.id)) continue;
    try {
      if (!matchesCronExpression(job.cronExpression, now)) continue;
    } catch (error) {
      markCronJobFailed(job.id, error instanceof Error ? error.message : String(error));
      log.warn("Skipping cron job with invalid cron expression", {
        cronJobId: job.id,
        cronExpression: job.cronExpression,
        error: String(error),
      });
      continue;
    }

    const claimed = markCronJobTriggered(job.id, minuteStartMs);
    if (!claimed) continue;

    runningJobIds.add(job.id);
    void runCronJob(job, minuteStartMs).finally(() => {
      runningJobIds.delete(job.id);
    });
  }
}

export function startCronJobScheduler(): void {
  if (cronSchedulerTimer) return;
  void tickCronJobs();
  cronSchedulerTimer = setInterval(() => {
    void tickCronJobs();
  }, CRON_POLL_INTERVAL_MS);
  log.debug("Cron job scheduler started", { intervalMs: CRON_POLL_INTERVAL_MS });
}

export function stopCronJobScheduler(): void {
  if (!cronSchedulerTimer) return;
  clearInterval(cronSchedulerTimer);
  cronSchedulerTimer = null;
  runningJobIds.clear();
  log.debug("Cron job scheduler stopped");
}
