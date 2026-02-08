import type { SessionMessageState, SessionTodo } from "@/utils/session-inspector";

export type KiroTaskRecord = {
  id: string;
  status: string;
  title?: string;
};

function normalizeTaskStatus(status: string): SessionTodo["status"] {
  if (status === "completed") return "completed";
  if (status === "error") return "cancelled";
  return "in_progress";
}

export function extractKiroRecord(
  type: string,
  eventData: Record<string, unknown>,
  eventProps: Record<string, unknown>
): KiroTaskRecord | null {
  if (type !== "message.part.updated") return null;
  const part = (eventProps.part ?? eventData.part) as Record<string, unknown> | undefined;
  if (!part || part.type !== "tool") return null;
  const toolName = typeof part.tool === "string" ? part.tool.trim().toLowerCase() : "";
  if (toolName !== "task") return null;
  const toolState = (part.state ?? {}) as Record<string, unknown>;
  const id = typeof part.id === "string" && part.id.trim() ? part.id.trim() : "kiro-task";
  const status = typeof toolState.status === "string" ? toolState.status.trim().toLowerCase() : "";
  const title = typeof toolState.title === "string" ? toolState.title.trim() : undefined;
  return {
    id,
    status,
    title,
  };
}

export function applyKiroRecordToState(
  state: SessionMessageState,
  record: KiroTaskRecord,
  todoById: Map<string, SessionTodo>
): void {
  todoById.set(record.id, {
    content: record.title || "Task",
    status: normalizeTaskStatus(record.status),
  });
  state.todos = Array.from(todoById.values());
}
