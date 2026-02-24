export type IncomingCommand = "setting";

export function parseIncomingCommand(text: string): IncomingCommand | null {
  const normalized = text.trim().replace(/^／/, "/").toLowerCase();
  if (/^\/?settings?\b/.test(normalized)) return "setting";
  return null;
}
