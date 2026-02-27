import { failActiveRequest, loadSession } from "@/config/local/sessions";
import type { AgentAdapter, IMAdapter } from "@/core/types";
import { log } from "@/utils";

type StopCommandDeps = {
  agent: AgentAdapter;
  im: IMAdapter;
};

export async function handleStopCommand(params: {
  deps: StopCommandDeps;
  channelId: string;
  threadId: string;
}): Promise<boolean> {
  const { deps, channelId, threadId } = params;
  const session = loadSession(channelId, threadId);
  if (!session) {
    log.info("Stop command received without session", { channelId, threadId });
    return true;
  }

  const request = session.activeRequest;
  log.info("Stop command received", {
    sessionId: request?.sessionId ?? session.sessionId,
    hadActiveRequest: Boolean(request),
    activeState: request?.state ?? null,
  });

  try {
    const cwd = session.workingDirectory;
    await deps.agent.abortSession(session.sessionId, cwd);
  } catch {
    // Ignore abort errors
  }

  if (!request || request.state !== "processing") {
    return true;
  }

  request.state = "failed";
  request.error = "Stopped by user";

  await deps.im.deleteMessage(request.channelId, request.statusMessageTs);

  failActiveRequest(channelId, threadId, "Stopped by user");
  return true;
}
