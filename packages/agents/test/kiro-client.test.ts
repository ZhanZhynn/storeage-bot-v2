import { describe, expect, it } from "bun:test";
import { extractKiroFinalResponse, sanitizeKiroOutput } from "../kiro/client";

describe("kiro client output parsing", () => {
  it("strips ANSI sequences from kiro output", () => {
    const output = "\u001b[38;5;141m> Hello\u001b[0m\n\u001b[38;5;10m ✓ \u001b[0mDone";
    const text = sanitizeKiroOutput(output);

    expect(text).toContain("> Hello");
    expect(text).toContain("✓ Done");
    expect(text).not.toContain("\u001b[");
  });

  it("extracts final assistant section from kiro transcript", () => {
    const output = [
      "> I will scan the repository first.",
      "Searching for: TODO (using tool: grep)",
      "✓ Successfully found 3 matches",
      "> Most important issue is inconsistent error handling.",
      "## Plan",
      "1. Add shared error wrapper",
    ].join("\n");

    const text = extractKiroFinalResponse(output);
    expect(text).toContain("Most important issue is inconsistent error handling.");
    expect(text).toContain("## Plan");
    expect(text).not.toContain("using tool:");
    expect(text).not.toContain("Successfully found");
  });
});
