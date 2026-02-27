import type { ThreadKey } from "@/core/model/thread-key";

export interface RuntimeStore {
  isMessageProcessed(threadKey: ThreadKey, messageId: string): boolean;
  markMessageProcessed(threadKey: ThreadKey, messageId: string): void;
  getPendingQuestion(threadKey: ThreadKey): unknown;
}
