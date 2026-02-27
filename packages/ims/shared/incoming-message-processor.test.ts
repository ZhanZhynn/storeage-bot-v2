import { describe, expect, it } from "bun:test";
import {
  buildIncomingContext,
  evaluateIncomingFlow,
  formatIncomingDropMessage,
  parseIncomingCommand,
} from "./incoming-message-processor";

describe("incoming message flow helpers", () => {
  it("evaluates behavior matrix for top-level and thread messages", () => {
    const cases: Array<{
      name: string;
      input: {
        isTopLevel: boolean;
        mentionedBot: boolean;
        activeThread: boolean;
        normalizedText: string;
      };
      detectStop?: boolean;
      expected: ReturnType<typeof evaluateIncomingFlow>;
    }> = [
      {
        name: "top-level without mention is ignored",
        input: { isTopLevel: true, mentionedBot: false, activeThread: false, normalizedText: "hello" },
        expected: { type: "ignore", reason: "not_mentioned_and_inactive" },
      },
      {
        name: "top-level mention forwards",
        input: { isTopLevel: true, mentionedBot: true, activeThread: false, normalizedText: "hello" },
        expected: { type: "forward", text: "hello" },
      },
      {
        name: "thread active without mention forwards",
        input: { isTopLevel: false, mentionedBot: false, activeThread: true, normalizedText: "hello" },
        expected: { type: "forward", text: "hello" },
      },
      {
        name: "blank normalized text is ignored",
        input: { isTopLevel: false, mentionedBot: true, activeThread: true, normalizedText: "   " },
        expected: { type: "ignore", reason: "empty_text" },
      },
      {
        name: "stop command detected by default",
        input: { isTopLevel: false, mentionedBot: true, activeThread: true, normalizedText: "stop" },
        expected: { type: "stop", text: "stop" },
      },
      {
        name: "stop command can be disabled",
        input: { isTopLevel: false, mentionedBot: true, activeThread: true, normalizedText: "stop" },
        detectStop: false,
        expected: { type: "forward", text: "stop" },
      },
    ];

    for (const testCase of cases) {
      const actual = evaluateIncomingFlow(testCase.input, { detectStop: testCase.detectStop });
      expect(actual).toEqual(testCase.expected);
    }
  });

  it("parses command variants and normalizes context", () => {
    expect(parseIncomingCommand("<@U123> settings")).toBe("setting");
    expect(parseIncomingCommand("@ode: setting")).toBe("setting");
    expect(parseIncomingCommand("／settings")).toBe("setting");
    expect(parseIncomingCommand("help")).toBeNull();

    const context = buildIncomingContext({
      platform: "slack",
      channelId: " C1 ",
      threadId: " T1 ",
      messageId: " m1 ",
      userId: " U1 ",
      isTopLevel: true,
      mentionedBot: true,
      activeThread: false,
      rawText: "raw",
      normalizedText: "clean",
    });
    expect(context.channelId).toBe("C1");
    expect(context.threadId).toBe("T1");
    expect(context.replyThreadId).toBe("T1");
    expect(formatIncomingDropMessage("not_mentioned_and_inactive")).toContain("Not mentioned");
  });
});
