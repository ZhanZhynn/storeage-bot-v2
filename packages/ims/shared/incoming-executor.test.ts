import { describe, expect, it, mock } from "bun:test";
import { executeIncomingFlow } from "./incoming-executor";

describe("executeIncomingFlow", () => {
  it("ignores message without running stop/forward", async () => {
    const markThreadActive = mock(() => {});
    const handleStopCommand = mock(async () => false);
    const forwardToCore = mock(async () => {});
    const onIgnore = mock(() => {});

    await executeIncomingFlow({
      context: { channelId: "C1", threadId: "T1" },
      flowResult: { type: "ignore", reason: "empty_text" },
      markThreadActive,
      handleStopCommand,
      forwardToCore,
      onIgnore,
    });

    expect(onIgnore).toHaveBeenCalledTimes(1);
    expect(handleStopCommand).toHaveBeenCalledTimes(0);
    expect(markThreadActive).toHaveBeenCalledTimes(0);
    expect(forwardToCore).toHaveBeenCalledTimes(0);
  });

  it("runs stop flow and sends ack when stopped", async () => {
    const markThreadActive = mock(() => {});
    const handleStopCommand = mock(async () => true);
    const forwardToCore = mock(async () => {});
    const sendStopAck = mock(async () => {});

    await executeIncomingFlow({
      context: { channelId: "C1", threadId: "T1" },
      flowResult: { type: "stop", text: "stop" },
      markThreadActive,
      handleStopCommand,
      sendStopAck,
      forwardToCore,
    });

    expect(handleStopCommand).toHaveBeenCalledTimes(1);
    expect(sendStopAck).toHaveBeenCalledTimes(1);
    expect(markThreadActive).toHaveBeenCalledTimes(0);
    expect(forwardToCore).toHaveBeenCalledTimes(0);
  });

  it("marks active thread and forwards message", async () => {
    const markThreadActive = mock(() => {});
    const handleStopCommand = mock(async () => false);
    const forwardToCore = mock(async () => {});

    await executeIncomingFlow({
      context: { channelId: "C1", threadId: "T1" },
      flowResult: { type: "forward", text: "hello" },
      markThreadActive,
      handleStopCommand,
      forwardToCore,
    });

    expect(markThreadActive).toHaveBeenCalledTimes(1);
    expect(forwardToCore).toHaveBeenCalledWith("hello");
    expect(handleStopCommand).toHaveBeenCalledTimes(0);
  });
});
