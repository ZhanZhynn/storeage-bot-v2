export type IncomingCommand = "setting";

export function parseIncomingCommand(text: string): IncomingCommand | null {
  const normalized = text
    .trim()
    .replace(/^／/, "/")
    .replace(/^(?:<@[^>]+>|@[^\s:：,，]+)[:：,，]?\s+/g, "")
    .toLowerCase();
  if (/^\/?settings?\b/.test(normalized)) return "setting";
  return null;
}
