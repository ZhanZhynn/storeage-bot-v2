import type { MessageFrequency } from "@/config/message-frequency";
import type { AgentAdapter, StatusMessageRequest } from "@/core/types";
import { buildStatusMessageByProvider } from "@/utils/status";
import type { SessionMessageState } from "@/utils/session-inspector";

export function buildStatusMessageForAgent(params: {
  agent: AgentAdapter;
  request: StatusMessageRequest;
  workingPath: string;
  state?: SessionMessageState;
  frequency: MessageFrequency;
}): string {
  const { agent, request, workingPath, state, frequency } = params;
  const provider = agent.getProviderForSession(request.sessionId);
  return buildStatusMessageByProvider(provider, request, workingPath, state, frequency);
}
