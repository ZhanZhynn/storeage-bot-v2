import { CoalescedUpdateQueue } from "@/shared/queue/coalesced-update-queue";
import { log } from "@/utils";

type SlackUpdateKey = {
  channelId: string;
  messageTs: string;
};

type SlackUpdatePayload = {
  text: string;
  processorId?: string;
};

function buildKey(channelId: string, messageTs: string): string {
  return `${channelId}:${messageTs}`;
}

export class SlackMessageUpdateManager {
  private readonly finalizedMessages = new Set<string>();
  private readonly queue: CoalescedUpdateQueue<void, SlackUpdatePayload>;

  constructor(
    worker: (params: {
      channelId: string;
      messageTs: string;
      text: string;
      processorId?: string;
    }) => Promise<void>
  ) {
    this.queue = new CoalescedUpdateQueue<void, SlackUpdatePayload>(0, async ({ channelId, messageId }, payload) => {
      const updateKey = buildKey(channelId, messageId);
      if (this.finalizedMessages.has(updateKey)) {
        log.debug("Skipping globally queued Slack update after finalization", {
          channelId,
          messageTs: messageId,
        });
        return;
      }

      await worker({
        channelId,
        messageTs: messageId,
        text: payload.text,
        processorId: payload.processorId,
      });
    });
  }

  async updateMessage(params: {
    channelId: string;
    messageTs: string;
    text: string;
    processorId?: string;
  }): Promise<void> {
    const { channelId, messageTs, text, processorId } = params;
    if (this.finalizedMessages.has(buildKey(channelId, messageTs))) {
      log.debug("Skipping Slack update after global finalization", {
        channelId,
        messageTs,
      });
      return;
    }

    await this.queue.enqueue({ channelId, messageId: messageTs }, { text, processorId });
  }

  cancelPendingUpdates(channelId: string, messageTs: string): void {
    this.queue.cancel({ channelId, messageId: messageTs });
  }

  markMessageFinalized(channelId: string, messageTs: string): void {
    this.finalizedMessages.add(buildKey(channelId, messageTs));
    this.queue.cancel({ channelId, messageId: messageTs });
  }

  clear(): void {
    this.finalizedMessages.clear();
    this.queue.clear();
  }
}
