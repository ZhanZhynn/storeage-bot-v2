import { loadOdeConfig } from "./local/ode";

export type MessageFrequency = "minimum" | "medium" | "aggressive";

export const TOOL_DISPLAY_CONFIG: Record<
  MessageFrequency,
  { itemLimit: number; detailLimit: number | null }
> = {
  minimum: { itemLimit: 4, detailLimit: 30 },
  medium: { itemLimit: 6, detailLimit: 100 },
  aggressive: { itemLimit: 8, detailLimit: null },
};

export function resolveMessageFrequency(): MessageFrequency {
  try {
    const frequency = loadOdeConfig().user.defaultMessageFrequency;
    if (frequency === "minimum" || frequency === "medium" || frequency === "aggressive") {
      return frequency;
    }
  } catch {
    // ignore, fall back to medium
  }
  return "medium";
}
