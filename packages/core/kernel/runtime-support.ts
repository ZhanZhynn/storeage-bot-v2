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
  const statusRateLimited = im.wasRateLimited?.(channelId, statusTs) ?? false;
  const statusRateLimitError = im.getRateLimitError?.(channelId, statusTs);

  im.cancelPendingUpdates?.(channelId, statusTs);

  // Result message is always sent as a new message. When the previous logic
  // would have overwritten the status message with the final result (or a
  // pointer like "Final result posted below."), we instead delete the old
  // status message after the result is posted.
  //
  // The status message is left intact when:
  //  * format is "aggressive" (status is treated as a persistent record), or
  //  * we hit a prior 429 on the status TS (editing/deleting risks further errors).
  const shouldDeleteStatus =
    statusFormat !== "aggressive" && !statusRateLimited;

  if (statusRateLimited) {
    log.warn("Skipping final status edit/delete due to prior 429; posting final result as new message", {
      channelId,
      threadId,
      statusTs,
      ...(statusRateLimitError ? { error: statusRateLimitError } : {}),
    });
  }

  for (const chunk of finalChunks) {
    await im.sendMessage(channelId, threadId, chunk);
  }

  if (shouldDeleteStatus) {
    try {
      await im.deleteMessage(channelId, statusTs);
    } catch (error) {
      log.warn("Failed to delete status message after posting final result", {
        channelId,
        threadId,
        statusTs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  im.markMessageFinalized?.(channelId, statusTs);
}
