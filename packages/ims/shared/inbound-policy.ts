import type { InboundDecision } from "@/core/model/inbound-decision";

export function defaultInboundPolicy(params: {
  isTopLevel: boolean;
  mentionedBot: boolean;
  activeThread: boolean;
  normalizedText: string;
  detectStop?: boolean;
}): InboundDecision {
  const shouldProcess = params.isTopLevel
    ? params.mentionedBot
    : (params.mentionedBot || params.activeThread);

  if (!shouldProcess) {
    return { kind: "ignore", reason: "not_mentioned_and_inactive" };
  }

  const text = params.normalizedText.trim();
  if (!text) {
    return { kind: "ignore", reason: "empty_text" };
  }

  if (params.detectStop !== false && text.toLowerCase() === "stop") {
    return { kind: "stop" };
  }

  return { kind: "message", text };
}
