import { describe, expect, it } from "bun:test";
import { buildLarkSettingsDetailCard } from "./settings";

function getFormElements(card: Record<string, unknown>): Array<Record<string, unknown>> {
  const body = card.body as Record<string, unknown> | undefined;
  const elements = Array.isArray(body?.elements) ? body?.elements : [];
  const form = elements.find((item) => {
    return item && typeof item === "object" && (item as Record<string, unknown>).tag === "form";
  }) as Record<string, unknown> | undefined;
  return Array.isArray(form?.elements) ? form.elements as Array<Record<string, unknown>> : [];
}

describe("buildLarkSettingsDetailCard", () => {
  it("uses text inputs for free-form channel settings", () => {
    const card = buildLarkSettingsDetailCard({
      action: "open_settings_modal",
      channelId: "oc_test",
      threadId: "",
      userId: "ou_test",
    });

    const formElements = getFormElements(card);
    const inputNames = formElements
      .filter((item) => item.tag === "input")
      .map((item) => String(item.name ?? ""));

    expect(inputNames).toContain("model");
    expect(inputNames).toContain("workingDirectory");
    expect(inputNames).toContain("baseBranch");
    expect(inputNames).toContain("channelSystemMessage");

    const providerSelect = formElements.find((item) => item.tag === "select_static" && item.name === "provider");
    expect(providerSelect).toBeTruthy();
  });

  it("keeps general settings as select controls", () => {
    const card = buildLarkSettingsDetailCard({
      action: "open_general_settings_modal",
      channelId: "oc_test",
      threadId: "",
      userId: "ou_test",
    });

    const formElements = getFormElements(card);
    const inputElements = formElements.filter((item) => item.tag === "input");
    expect(inputElements.length).toBe(0);

    const selectNames = formElements
      .filter((item) => item.tag === "select_static")
      .map((item) => String(item.name ?? ""));

    expect(selectNames).toContain("statusFormat");
    expect(selectNames).toContain("statusFrequencyMs");
    expect(selectNames).toContain("gitStrategy");
    expect(selectNames).toContain("autoUpdate");
  });
});
