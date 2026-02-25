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

function hasFooterActions(card: Record<string, unknown>): boolean {
  const body = card.body as Record<string, unknown> | undefined;
  const elements = Array.isArray(body?.elements) ? body?.elements : [];
  return elements.some((item) => {
    if (!item || typeof item !== "object" || (item as Record<string, unknown>).tag !== "column_set") {
      return false;
    }
    const columns = (item as Record<string, unknown>).columns;
    return Array.isArray(columns) && columns.length > 0;
  });
}

describe("buildLarkSettingsDetailCard", () => {
  it("uses select for model and removes channel footer actions", () => {
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

    expect(inputNames).not.toContain("model");
    expect(inputNames).toContain("workingDirectory");
    expect(inputNames).toContain("baseBranch");
    expect(inputNames).toContain("channelSystemMessage");

    const providerSelect = formElements.find((item) => item.tag === "select_static" && item.name === "provider");
    const modelSelect = formElements.find((item) => item.tag === "select_static" && item.name === "model");
    expect(providerSelect).toBeTruthy();
    expect(modelSelect).toBeTruthy();

    expect(hasFooterActions(card)).toBe(false);
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

  it("uses text inputs for GitHub info and removes footer actions", () => {
    const card = buildLarkSettingsDetailCard({
      action: "open_github_token_modal",
      channelId: "oc_test",
      threadId: "",
      userId: "ou_test",
    });

    const formElements = getFormElements(card);
    const inputNames = formElements
      .filter((item) => item.tag === "input")
      .map((item) => String(item.name ?? ""));

    expect(inputNames).toContain("githubToken");
    expect(inputNames).toContain("githubName");
    expect(inputNames).toContain("githubEmail");

    const selectNames = formElements
      .filter((item) => item.tag === "select_static")
      .map((item) => String(item.name ?? ""));
    expect(selectNames).not.toContain("githubToken");
    expect(selectNames).not.toContain("githubName");
    expect(selectNames).not.toContain("githubEmail");

    expect(hasFooterActions(card)).toBe(false);
  });
});
