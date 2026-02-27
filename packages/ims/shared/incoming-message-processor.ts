export type IMPlatform = "slack" | "discord" | "lark";

export type UnifiedMessageContext = {
  platform: IMPlatform;
  channelId: string;
  threadId: string;
  replyThreadId: string;
  messageId: string;
  userId: string;
  isTopLevel: boolean;
  mentionedBot: boolean;
  activeThread: boolean;
  rawText: string;
  normalizedText: string;
};

export type IncomingIgnoreReason = "not_mentioned_and_inactive" | "empty_text";

export type IncomingFlowResult =
  | { type: "ignore"; reason: IncomingIgnoreReason }
  | { type: "stop"; text: string }
  | { type: "forward"; text: string };

export type IncomingEvaluateOptions = {
  detectStop?: boolean;
};

export type IncomingCommand = "setting";

export function evaluateIncomingFlow(
  context: Pick<UnifiedMessageContext, "isTopLevel" | "mentionedBot" | "activeThread" | "normalizedText">,
  options?: IncomingEvaluateOptions
): IncomingFlowResult {
  const shouldProcess = context.isTopLevel
    ? context.mentionedBot
    : (context.mentionedBot || context.activeThread);

  if (!shouldProcess) {
    return { type: "ignore", reason: "not_mentioned_and_inactive" };
  }

  const text = context.normalizedText.trim();
  if (!text) {
    return { type: "ignore", reason: "empty_text" };
  }

  if (options?.detectStop !== false && isStopCommand(text)) {
    return { type: "stop", text };
  }

  return { type: "forward", text };
}

export function formatIncomingDropMessage(reason: IncomingIgnoreReason): string {
  switch (reason) {
    case "not_mentioned_and_inactive":
      return "[DROP] Not mentioned and thread inactive";
    case "empty_text":
      return "[DROP] Empty text after normalization";
  }
}

export function parseIncomingCommand(text: string): IncomingCommand | null {
  const normalized = text
    .trim()
    .replace(/^／/, "/")
    .replace(/^(?:<@[^>]+>|@[^\s:：,，]+)[:：,，]?\s+/g, "")
    .toLowerCase();
  if (/^\/?settings?\b/.test(normalized)) return "setting";
  return null;
}

export function buildIncomingContext(params: {
  platform: UnifiedMessageContext["platform"];
  channelId: string;
  threadId: string;
  replyThreadId?: string;
  messageId: string;
  userId: string;
  isTopLevel: boolean;
  mentionedBot: boolean;
  activeThread: boolean;
  rawText: string;
  normalizedText: string;
}): UnifiedMessageContext {
  return {
    platform: params.platform,
    channelId: params.channelId.trim(),
    threadId: params.threadId.trim(),
    replyThreadId: (params.replyThreadId ?? params.threadId).trim(),
    messageId: params.messageId.trim(),
    userId: params.userId.trim(),
    isTopLevel: params.isTopLevel,
    mentionedBot: params.mentionedBot,
    activeThread: params.activeThread,
    rawText: params.rawText,
    normalizedText: params.normalizedText,
  };
}

export function isStopCommand(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length === 4 && trimmed.toLowerCase() === "stop";
}
