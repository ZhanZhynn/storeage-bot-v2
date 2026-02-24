import { describe, expect, it } from "bun:test";
import { parseIncomingCommand } from "./command-router";

describe("parseIncomingCommand", () => {
  it("matches setting command variants", () => {
    expect(parseIncomingCommand("/setting")).toBe("setting");
    expect(parseIncomingCommand("settings")).toBe("setting");
    expect(parseIncomingCommand("／settings now")).toBe("setting");
    expect(parseIncomingCommand("@ode /setting")).toBe("setting");
    expect(parseIncomingCommand("<@ou_xxx> settings")).toBe("setting");
  });

  it("returns null for non-command messages", () => {
    expect(parseIncomingCommand("hello")).toBeNull();
    expect(parseIncomingCommand("set thing")).toBeNull();
  });
});
