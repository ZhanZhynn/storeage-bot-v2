import type { BotKey } from "@/core/model/bot-key";
import { toBotKeyId } from "@/core/model/bot-key";

export type ThreadKey = Readonly<{
  botKey: BotKey;
  channelId: string;
  threadId: string;
}>;

export function toThreadKeyId(threadKey: ThreadKey): string {
  return `${toBotKeyId(threadKey.botKey)}:${threadKey.channelId}:${threadKey.threadId}`;
}
