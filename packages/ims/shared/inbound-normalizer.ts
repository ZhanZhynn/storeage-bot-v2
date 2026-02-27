export function normalizeInboundText(text: string): string {
  return text.replace(/^\s+|\s+$/g, "");
}
