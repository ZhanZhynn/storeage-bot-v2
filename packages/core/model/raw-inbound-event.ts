import type { BotPlatform } from "@/core/model/bot-key";

export type RawInboundEvent = Readonly<{
  platform: BotPlatform;
  botId: string;
  channelId: string;
  rawChannelId?: string;
  threadId: string;
  replyThreadId: string;
  messageId: string;
  userId: string;
  isTopLevel: boolean;
  mentionedBot: boolean;
  activeThread: boolean;
  rawText: string;
  normalizedText: string;
  receivedAtMs: number;
}>;
