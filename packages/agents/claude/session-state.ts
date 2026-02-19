import type { SessionMessageState, SessionTool } from "@/utils/session-inspector";
import {
  applyAnthropicStyleStreamEvent,
  applyAssistantBlocks,
  applyUserToolResults,
  extractPrefixedRecord,
  extractSessionTitle,
  type StreamStateMaps,
  type StreamToolState,
} from "@/agents/session-state/shared";

export type ClaudeRawRecord = {
  type?: string;
  event?: {
    type?: string;
    index?: number;
    content_block?: Record<string, unknown>;
    delta?: Record<string, unknown>;
  };
  message?: {
    content?: Array<{
      type?: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
      tool_use_id?: string;
      content?: string;
      is_error?: boolean;
    }>;
  };
  result?: string;
  is_error?: boolean;
  error?: string;
  session_id?: string;
};

export type ClaudeInspectorToolState = StreamToolState;

export type ClaudeStreamStateMaps = StreamStateMaps<ClaudeInspectorToolState>;

export function extractClaudeRecord(
  type: string,
  eventData: Record<string, unknown>,
  eventProps: Record<string, unknown>
): ClaudeRawRecord | null {
  return extractPrefixedRecord<ClaudeRawRecord>(type, "claude.raw.", eventData, eventProps);
}

export function applyClaudeRecordToState(
  state: SessionMessageState,
  record: ClaudeRawRecord,
  streamState: ClaudeStreamStateMaps
): void {
  const { textByIndex, thinkingByIndex, toolByIndex, toolById } = streamState;
  const sessionTitle = extractSessionTitle(record);
  if (sessionTitle) {
    state.sessionTitle = sessionTitle;
  }

  if (record.type === "assistant") {
    applyAssistantBlocks(state, record.message?.content ?? [], { toolById }, "claude-tool");
    return;
  }

  if (record.type === "user") {
    applyUserToolResults(state, record.message?.content ?? [], { toolById });
    return;
  }

  if (record.type === "result") {
    state.phaseStatus = record.is_error ? "Claude reported an error" : "Finalizing response";
    return;
  }

  if (record.type !== "stream_event") {
    return;
  }
  applyAnthropicStyleStreamEvent(state, record, {
    textByIndex,
    thinkingByIndex,
    toolByIndex,
    toolById,
  }, "claude-tool");
}
