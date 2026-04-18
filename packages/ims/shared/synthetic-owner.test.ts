import { describe, expect, it } from "bun:test";
import { isSyntheticOwner } from "./synthetic-owner";

describe("isSyntheticOwner", () => {
  it("returns true for task: prefix", () => {
    expect(isSyntheticOwner("task:abc123")).toBe(true);
  });

  it("returns true for cron-job: prefix (current cron id scheme)", () => {
    expect(isSyntheticOwner("cron-job:daily-report")).toBe(true);
  });

  it("returns true for legacy cron: prefix", () => {
    expect(isSyntheticOwner("cron:daily")).toBe(true);
  });

  it("returns false for real user ids", () => {
    expect(isSyntheticOwner("U0AUCN52VJ4")).toBe(false);
    expect(isSyntheticOwner("123456789")).toBe(false);
  });

  it("returns false for null/undefined/empty", () => {
    expect(isSyntheticOwner(null)).toBe(false);
    expect(isSyntheticOwner(undefined)).toBe(false);
    expect(isSyntheticOwner("")).toBe(false);
  });

  it("only matches as prefix, not substring", () => {
    expect(isSyntheticOwner("prefix-task:abc")).toBe(false);
    expect(isSyntheticOwner("user-cron-job:x")).toBe(false);
  });
});
