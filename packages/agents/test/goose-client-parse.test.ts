import { describe, expect, it } from "bun:test";
import { parseGooseResponse } from "../goose/client";

describe("goose response parsing", () => {
  it("preserves whitespace across assistant chunks", () => {
    const output = [
      JSON.stringify({ type: "assistant", text: "Hi!" }),
      JSON.stringify({ type: "assistant", text: " How" }),
      JSON.stringify({ type: "assistant", text: " can" }),
      JSON.stringify({ type: "assistant", text: " I" }),
      JSON.stringify({ type: "assistant", text: " help" }),
      JSON.stringify({ type: "assistant", text: " you" }),
      JSON.stringify({ type: "assistant", text: " today?" }),
    ].join("\n");

    const parsed = parseGooseResponse(output);
    expect(parsed.text).toBe("Hi! How can I help you today?");
  });
});
