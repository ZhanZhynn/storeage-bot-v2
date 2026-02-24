import type { IncomingIgnoreReason, IncomingPipelineResult } from "@/ims/shared/incoming-pipeline";
import type { UnifiedMessageContext } from "@/ims/shared/message-context";

type IncomingExecutorParams = {
  context: Pick<UnifiedMessageContext, "channelId" | "threadId">;
  flowResult: IncomingPipelineResult;
  markThreadActive: (channelId: string, threadId: string) => void;
  handleStopCommand: (channelId: string, threadId: string) => Promise<boolean>;
  sendStopAck?: () => Promise<void>;
  forwardToCore: (text: string) => Promise<void>;
  onIgnore?: (reason: IncomingIgnoreReason) => Promise<void> | void;
};

export async function executeIncomingFlow(params: IncomingExecutorParams): Promise<void> {
  const {
    context,
    flowResult,
    markThreadActive,
    handleStopCommand,
    sendStopAck,
    forwardToCore,
    onIgnore,
  } = params;

  if (flowResult.type === "ignore") {
    await onIgnore?.(flowResult.reason);
    return;
  }

  if (flowResult.type === "stop") {
    const stopped = await handleStopCommand(context.channelId, context.threadId);
    if (stopped) {
      await sendStopAck?.();
    }
    return;
  }

  markThreadActive(context.channelId, context.threadId);
  await forwardToCore(flowResult.text);
}
