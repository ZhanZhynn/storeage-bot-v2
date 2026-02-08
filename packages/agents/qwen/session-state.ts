import {
  applyClaudeRecordToState,
  type ClaudeRawRecord,
  type ClaudeStreamStateMaps,
} from "@/agents/claude/session-state";
import type { SessionMessageState } from "@/utils/session-inspector";

export type QwenRawRecord = ClaudeRawRecord;

export function extractQwenRecord(
  type: string,
  eventData: Record<string, unknown>,
  eventProps: Record<string, unknown>
): QwenRawRecord | null {
  if (!type.startsWith("qwen.raw.")) return null;
  const candidate = eventProps.record ?? eventData.record;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as QwenRawRecord;
}

export function applyQwenRecordToState(
  state: SessionMessageState,
  record: QwenRawRecord,
  streamState: ClaudeStreamStateMaps
): void {
  applyClaudeRecordToState(state, record, streamState);
}
