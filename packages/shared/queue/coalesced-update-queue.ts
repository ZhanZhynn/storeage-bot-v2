import Bottleneck from "bottleneck";

type QueueKey = {
  channelId: string;
  messageId: string;
};

type PendingItem<TResult, TPayload> = {
  key: QueueKey;
  payload: TPayload;
  resolve: (value: TResult) => void;
};

export class CoalescedUpdateQueue<TResult, TPayload = string> {
  private readonly limiter: Bottleneck;
  private readonly pendingByKey = new Map<string, PendingItem<TResult, TPayload>>();

  constructor(
    minTimeMs: number,
    private readonly worker: (key: QueueKey, payload: TPayload) => Promise<TResult>
  ) {
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: Math.max(minTimeMs, 0),
    });
  }

  enqueue(key: QueueKey, payload: TPayload): Promise<TResult> {
    const dedupKey = this.buildKey(key);
    this.resolvePending(dedupKey);

    return new Promise<TResult>((resolve) => {
      this.pendingByKey.set(dedupKey, {
        key,
        payload,
        resolve,
      });
      void this.limiter.schedule(async () => {
        const pending = this.pendingByKey.get(dedupKey);
        if (!pending) return;
        this.pendingByKey.delete(dedupKey);
        const result = await this.worker(pending.key, pending.payload);
        pending.resolve(result);
      });
    });
  }

  cancel(key: QueueKey): void {
    this.resolvePending(this.buildKey(key));
  }

  clear(): void {
    for (const pending of this.pendingByKey.values()) {
      pending.resolve(undefined as TResult);
    }
    this.pendingByKey.clear();
    void this.limiter.stop({ dropWaitingJobs: true });
  }

  private buildKey(key: QueueKey): string {
    return `${key.channelId}:${key.messageId}`;
  }

  private resolvePending(dedupKey: string): void {
    const existing = this.pendingByKey.get(dedupKey);
    if (!existing) return;
    existing.resolve(undefined as TResult);
    this.pendingByKey.delete(dedupKey);
  }
}
