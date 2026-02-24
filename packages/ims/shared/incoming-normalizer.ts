import type { IMPlatform, UnifiedMessageContext } from "@/ims/shared/message-context";

type BuildIncomingContextParams = {
  platform: IMPlatform;
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
};

export function buildIncomingContext(params: BuildIncomingContextParams): UnifiedMessageContext {
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
