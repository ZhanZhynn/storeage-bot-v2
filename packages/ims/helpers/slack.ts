import { createHash } from "node:crypto";

export function buildSlackBotId(credential: string): string {
  const normalized = credential.trim();
  if (!normalized) return "default";
  return createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}
