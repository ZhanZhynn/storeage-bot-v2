import type { ThreadKey } from "@/core/model/thread-key";

export interface StatusPublisher {
  publishStatus(threadKey: ThreadKey, text: string): Promise<void>;
  publishFinal(threadKey: ThreadKey, text: string): Promise<void>;
}
