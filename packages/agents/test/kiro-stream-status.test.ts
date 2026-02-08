import { describe, expect, it } from "bun:test";
import { buildSessionMessageState } from "../../utils/session-inspector";
import { buildLiveStatusMessage } from "../../utils/status";

describe("kiro stream status parsing", () => {
  it("renders status from normalized session events", () => {
    const now = Date.now();
    const state = buildSessionMessageState([
      {
        timestamp: now,
        type: "session.status",
        data: {
          properties: {
            status: {
              type: "busy",
            },
          },
        },
      },
      {
        timestamp: now + 1,
        type: "message.part.updated",
        data: {
          properties: {
            part: {
              id: "kiro-text",
              type: "text",
              text: "Investigating the codebase now.",
            },
          },
        },
      },
    ]);

    expect(state.phaseStatus).toBe("Working");
    expect(state.currentText).toBe("Investigating the codebase now.");

    const text = buildLiveStatusMessage(
      {
        channelId: "C1",
        threadId: "T1",
        statusMessageTs: "S1",
        startedAt: now,
        currentText: "",
      },
      "/tmp/repo",
      state,
      "medium"
    );

    expect(text).toContain("Working");
  });
});
