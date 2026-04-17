import { describe, expect, it } from "bun:test";
import { matchesCronExpression, validateCronExpression } from "@/core/cron/expression";

describe("cron expression utilities", () => {
  it("validates a standard five-field cron expression", () => {
    expect(() => validateCronExpression("0 9 * * 1-5")).not.toThrow();
  });

  it("rejects invalid field counts", () => {
    expect(() => validateCronExpression("0 9 * *")).toThrow("exactly 5 fields");
  });

  it("matches stepped and ranged expressions", () => {
    const matchingDate = new Date(2026, 3, 20, 9, 0, 0, 0);
    const nonMatchingDate = new Date(2026, 3, 20, 9, 5, 0, 0);

    expect(matchesCronExpression("0-30/15 9 * * 1-5", matchingDate)).toBe(true);
    expect(matchesCronExpression("0-30/15 9 * * 1-5", nonMatchingDate)).toBe(false);
  });

  it("treats 7 as sunday in day-of-week expressions", () => {
    const sunday = new Date(2026, 3, 19, 10, 0, 0, 0);
    expect(matchesCronExpression("0 10 * * 7", sunday)).toBe(true);
  });
});
