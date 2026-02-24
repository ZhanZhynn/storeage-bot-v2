import { describe, expect, it } from "bun:test";
import { buildIncomingContext } from "./incoming-normalizer";

describe("buildIncomingContext", () => {
  it("normalizes ids and defaults reply thread id", () => {
    const context = buildIncomingContext({
      platform: "slack",
      channelId: " C1 ",
      threadId: " T1 ",
      messageId: " M1 ",
      userId: " U1 ",
      isTopLevel: false,
      mentionedBot: true,
      activeThread: true,
      rawText: "raw",
      normalizedText: "clean",
    });

    expect(context.channelId).toBe("C1");
    expect(context.threadId).toBe("T1");
    expect(context.replyThreadId).toBe("T1");
    expect(context.messageId).toBe("M1");
    expect(context.userId).toBe("U1");
  });
});
