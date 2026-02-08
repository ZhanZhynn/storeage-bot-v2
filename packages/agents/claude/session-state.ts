import {
  applyStreamRecordToState,
  extractStreamRecord,
  type InspectorToolState,
  type StreamRawRecord,
  type StreamStateMaps,
} from "@/agents/shared/stream-session-state";
import type { SessionMessageState } from "@/utils/session-inspector";

export type ClaudeRawRecord = StreamRawRecord;
export type ClaudeInspectorToolState = InspectorToolState;
export type ClaudeStreamStateMaps = StreamStateMaps;

export function extractClaudeRecord(
  type: string,
  eventData: Record<string, unknown>,
  eventProps: Record<string, unknown>
): ClaudeRawRecord | null {
  return extractStreamRecord(type, eventData, eventProps, "claude.raw.");
}

export function applyClaudeRecordToState(
  state: SessionMessageState,
  record: ClaudeRawRecord,
  streamState: ClaudeStreamStateMaps
): void {
  applyStreamRecordToState(state, record, streamState, {
    toolIdPrefix: "claude-tool",
    agentLabel: "Claude",
  });
}
