import { describe, expect, it } from "bun:test";
import { buildSessionMessageState } from "../../utils/session-inspector";

function rawEvent(timestamp: number, record: Record<string, unknown>) {
  return {
    timestamp,
    type: `qwen.raw.${String(record.type ?? "unknown")}`,
    data: {
      properties: {
        record,
      },
    },
  };
}

describe("qwen stream status parsing", () => {
  it("tracks tool lifecycle and text deltas", () => {
    const now = Date.now();
    const state = buildSessionMessageState([
      rawEvent(now, {
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: {
            type: "tool_use",
            id: "tool-1",
            name: "Read",
            input: { filePath: "README.md" },
          },
        },
      }),
      rawEvent(now + 1, {
        type: "stream_event",
        event: {
          type: "content_block_stop",
          index: 0,
        },
      }),
      rawEvent(now + 2, {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 1,
          delta: { type: "text_delta", text: "done" },
        },
      }),
    ]);

    expect(state.tools[0]?.name).toBe("Read");
    expect(state.tools[0]?.status).toBe("completed");
    expect(state.currentText).toBe("done");
    expect(state.phaseStatus).toBe("Drafting response");
  });
});
