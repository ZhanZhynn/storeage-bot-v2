import {
  applyStreamRecordToState,
  extractStreamRecord,
  type StreamRawRecord,
  type StreamStateMaps,
} from "@/agents/shared/stream-session-state";
import type { SessionMessageState } from "@/utils/session-inspector";

export type QwenRawRecord = StreamRawRecord;

export function extractQwenRecord(
  type: string,
  eventData: Record<string, unknown>,
  eventProps: Record<string, unknown>
): QwenRawRecord | null {
  return extractStreamRecord(type, eventData, eventProps, "qwen.raw.");
}

export function applyQwenRecordToState(
  state: SessionMessageState,
  record: QwenRawRecord,
  streamState: StreamStateMaps
): void {
  applyStreamRecordToState(state, record, streamState, {
    toolIdPrefix: "qwen-tool",
    agentLabel: "Qwen",
  });
}
