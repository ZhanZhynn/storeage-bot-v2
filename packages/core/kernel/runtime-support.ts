import { getUserGeneralSettings } from "@/config";
import { saveSession, type PersistedSession } from "@/config/local/sessions";
import { splitResultMessage } from "@/core/runtime/result-message";
import type { IMAdapter } from "@/core/types";
import { log } from "@/utils";
import { spawnSync } from "child_process";

function getCurrentBranchName(cwd: string): string | null {
  try {
    const result = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      env: { ...process.env },
      encoding: "utf-8",
    });
    if (result.status !== 0) {
      return null;
    }
    const name = String(result.stdout || "").trim();
    if (!name || name === "HEAD") {
      return null;
    }
    return name;
  } catch {
    return null;
  }
}

export async function maybeSyncBranchAndThread(params: {
  session: PersistedSession;
  cwd: string;
}): Promise<void> {
  const { session, cwd } = params;
  const branchName = getCurrentBranchName(cwd);
  if (!branchName) return;

  if (session.branchName !== branchName) {
    session.branchName = branchName;
    saveSession(session);
  }
}

export async function publishFinalText(params: {
  im: IMAdapter;
  channelId: string;
  threadId: string;
  statusTs: string;
  text: string;
}): Promise<void> {
  const { im, channelId, threadId, statusTs, text } = params;
  const statusFormat = getUserGeneralSettings().defaultStatusMessageFormat;
  const finalChunks = splitResultMessage(text);
  const singleChunk = finalChunks[0] ?? text;
  const statusRateLimited = im.wasRateLimited?.(channelId, statusTs) ?? false;
  const statusRateLimitError = im.getRateLimitError?.(channelId, statusTs);

  if (finalChunks.length > 1) {
    if (statusFormat !== "aggressive" && !statusRateLimited) {
      await im.updateMessage(channelId, statusTs, "Final result posted below in multiple messages.");
    } else if (statusRateLimited) {
      log.warn("Skipping final status update due to prior 429; posting final chunks as new messages", {
        channelId,
        threadId,
        statusTs,
        ...(statusRateLimitError ? { error: statusRateLimitError } : {}),
      });
    }

    for (const chunk of finalChunks) {
      await im.sendMessage(channelId, threadId, chunk);
    }
    return;
  }

  if (statusFormat === "aggressive") {
    await im.sendMessage(channelId, threadId, singleChunk);
    return;
  }

  if (statusRateLimited) {
    log.warn("Skipping final status edit due to prior 429; posting final result as new message", {
      channelId,
      threadId,
      statusTs,
      ...(statusRateLimitError ? { error: statusRateLimitError } : {}),
    });
    await im.sendMessage(channelId, threadId, singleChunk);
    return;
  }

  const maxEditableMessageChars = im.maxEditableMessageChars;
  if (typeof maxEditableMessageChars === "number" && singleChunk.length > maxEditableMessageChars) {
    await im.updateMessage(channelId, statusTs, "Final result posted below.");
    await im.sendMessage(channelId, threadId, singleChunk);
    return;
  }

  await im.updateMessage(channelId, statusTs, singleChunk);
}
