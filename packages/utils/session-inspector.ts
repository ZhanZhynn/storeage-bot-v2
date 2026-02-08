import {
  applyClaudeRecordToState,
  extractClaudeRecord,
  type ClaudeInspectorToolState,
} from "@/agents/claude/session-state";
import { applyCodexRecordToState, extractCodexRecord } from "@/agents/codex/session-state";
import { applyKimiRecordToState, extractKimiRecord } from "@/agents/kimi/session-state";
import { applyQwenRecordToState, extractQwenRecord } from "@/agents/qwen/session-state";

export type SessionEvent = {
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
};

export type SessionTokenUsage = {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  cost?: number;
};

export type SessionTool = {
  id: string;
  name: string;
  status: string;
  title?: string;
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type SessionTodo = {
  content: string;
  status: string;
};

export type SessionMessageState = {
  sessionTitle?: string;
  phaseStatus?: string;
  thinkingText?: string;
  tokenUsage?: SessionTokenUsage;
  currentText: string;
  tools: SessionTool[];
  todos: SessionTodo[];
  startedAt: number;
};

export type SessionStateOptions = {
  workingDirectory?: string;
  endIndex?: number;
  baseState?: Partial<SessionMessageState>;
};

type SessionTitleCandidate = {
  value: string;
  score: number;
};

function unwrapEventData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const record = data as Record<string, unknown>;
  const payload = record.payload;
  if (payload && typeof payload === "object") {
    return payload as Record<string, unknown>;
  }
  return record;
}

function getEventProperties(data: Record<string, unknown>): Record<string, unknown> {
  const properties = data.properties;
  if (properties && typeof properties === "object") {
    return properties as Record<string, unknown>;
  }
  return data;
}

function formatSessionStatus(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (!value || typeof value !== "object") return undefined;

  const status = value as {
    type?: string;
    message?: string;
    next?: number;
  };

  switch (status.type) {
    case "busy":
      return "Working";
    case "idle":
      return "Waiting";
    case "retry": {
      const base = typeof status.message === "string" && status.message.trim()
        ? `Retrying: ${status.message.trim()}`
        : "Retrying";
      const seconds = typeof status.next === "number"
        ? Math.max(0, Math.ceil((status.next - Date.now()) / 1000))
        : undefined;
      return seconds !== undefined ? `${base} in ${seconds}s` : base;
    }
    default:
      return undefined;
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeTitleText(value: string): string | undefined {
  if (!value) return undefined;
  let text = value.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = normalizeWhitespace(text);
  if (!text) return undefined;

  text = text
    .replace(/^[>\-\*\d\.)\s]+/, "")
    .replace(/^(?:okay|ok|sure|great|nice|alright)[,!\s]+/i, "")
    .replace(/^(?:let me|i(?:'| a)?m going to|i(?:'| a)?ll|i will|now(?: i)?(?:'| a)?ll|first(?:,)?(?: i(?:'| a)?ll)?)[\s,:-]+/i, "")
    .trim();

  if (!text) return undefined;
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const firstSentence = firstLine.split(/(?<=[.!?])\s+/)[0]?.trim() ?? firstLine;
  let candidate = normalizeWhitespace(firstSentence);
  if (/^[a-z]/.test(candidate)) {
    candidate = `${candidate.charAt(0).toUpperCase()}${candidate.slice(1)}`;
  }
  if (!candidate || candidate.length < 8) return undefined;
  if (/^(working|thinking|drafting response|finalizing response|waiting|done|investigating)$/i.test(candidate)) {
    return undefined;
  }
  if (candidate.length <= 90) return candidate;
  return `${candidate.slice(0, 87).trimEnd()}...`;
}

function maybeBuildToolCandidate(toolName: unknown, input: unknown, title: unknown): SessionTitleCandidate | undefined {
  const normalizedName = typeof toolName === "string" ? toolName.trim() : "";
  const safeInput = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const safeTitle = typeof title === "string" ? sanitizeTitleText(title) : undefined;

  const name = normalizedName.toLowerCase();
  const command = typeof safeInput.command === "string" ? normalizeWhitespace(safeInput.command) : "";
  const filePath = typeof safeInput.filePath === "string"
    ? safeInput.filePath
    : typeof safeInput.file_path === "string"
      ? safeInput.file_path
      : typeof safeInput.absolute_path === "string"
        ? safeInput.absolute_path
        : typeof safeInput.path === "string"
          ? safeInput.path
          : "";
  const pattern = typeof safeInput.pattern === "string" ? normalizeWhitespace(safeInput.pattern) : "";

  if (name === "bash" || name === "shell" || name === "run_shell_command" || name === "command_execution") {
    if (command) {
      const shortened = command.length > 70 ? `${command.slice(0, 67).trimEnd()}...` : command;
      return { value: `Run command: ${shortened}`, score: 3 };
    }
  }

  if (name.includes("read")) {
    if (filePath) return { value: `Inspect file: ${filePath}`, score: 3 };
  }

  if (name.includes("grep") || name.includes("search")) {
    if (pattern) return { value: `Search for: ${pattern}`, score: 3 };
  }

  if (name.includes("glob") || name.includes("list_directory")) {
    if (filePath) return { value: `Explore path: ${filePath}`, score: 2 };
  }

  if (safeTitle) {
    return { value: safeTitle, score: 2 };
  }

  if (normalizedName) {
    return { value: `Run tool: ${normalizedName}`, score: 1 };
  }

  return undefined;
}

function extractTitleCandidateFromEvent(
  type: string,
  eventData: Record<string, unknown>,
  eventProps: Record<string, unknown>
): SessionTitleCandidate | undefined {
  if (type.startsWith("codex.raw.")) {
    const record = (eventProps.event ?? eventData.event) as Record<string, unknown> | undefined;
    const item = record?.item as Record<string, unknown> | undefined;
    if (item?.type === "command_execution") {
      return maybeBuildToolCandidate("command_execution", item, undefined);
    }
    if (typeof item?.text === "string") {
      const text = sanitizeTitleText(item.text);
      if (text) return { value: text, score: 2 };
    }
  }

  if (type.startsWith("kimi.raw.")) {
    const record = (eventProps.record ?? eventData.record) as Record<string, unknown> | undefined;
    const toolCalls = Array.isArray(record?.tool_calls) ? record?.tool_calls : [];
    const firstCall = toolCalls[0] as Record<string, unknown> | undefined;
    const fn = firstCall?.function as Record<string, unknown> | undefined;
    const fnName = fn?.name;
    const fnArgsRaw = fn?.arguments;
    const parsedArgs = typeof fnArgsRaw === "object" && fnArgsRaw
      ? fnArgsRaw as Record<string, unknown>
      : typeof fnArgsRaw === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(fnArgsRaw) as unknown;
              return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : { raw: fnArgsRaw };
            } catch {
              return { raw: fnArgsRaw };
            }
          })()
        : undefined;
    const toolCandidate = maybeBuildToolCandidate(fnName, parsedArgs, undefined);
    if (toolCandidate) return toolCandidate;

    const content = record?.content;
    if (typeof content === "string") {
      const text = sanitizeTitleText(content);
      if (text) return { value: text, score: 2 };
    }
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const candidate = (part as Record<string, unknown>).text
          ?? (part as Record<string, unknown>).think;
        if (typeof candidate !== "string") continue;
        const text = sanitizeTitleText(candidate);
        if (text) return { value: text, score: 2 };
      }
    }
  }

  if (type.startsWith("claude.raw.") || type.startsWith("qwen.raw.")) {
    const record = (eventProps.record ?? eventData.record) as Record<string, unknown> | undefined;
    const event = record?.event as Record<string, unknown> | undefined;
    const contentBlock = event?.content_block as Record<string, unknown> | undefined;
    if (contentBlock?.type === "tool_use") {
      return maybeBuildToolCandidate(contentBlock.name, contentBlock.input, undefined);
    }

    const message = record?.message as Record<string, unknown> | undefined;
    const content = Array.isArray(message?.content) ? message?.content : [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const blockRecord = block as Record<string, unknown>;
      if (blockRecord.type === "tool_use") {
        const toolCandidate = maybeBuildToolCandidate(blockRecord.name, blockRecord.input, undefined);
        if (toolCandidate) return toolCandidate;
      }
      if (typeof blockRecord.text === "string") {
        const text = sanitizeTitleText(blockRecord.text);
        if (text) return { value: text, score: 2 };
      }
    }
  }

  if (type === "message.part.updated") {
    const part = (eventProps as { part?: Record<string, unknown> }).part;
    if (!part || typeof part !== "object") return undefined;

    if (part.type === "tool") {
      const state = part.state && typeof part.state === "object"
        ? part.state as Record<string, unknown>
        : undefined;
      return maybeBuildToolCandidate(part.tool, state?.input, state?.title);
    }

    if (part.type === "text" && typeof part.text === "string") {
      const text = sanitizeTitleText(part.text);
      if (text) return { value: text, score: 2 };
    }
  }

  if (type === "todo.updated") {
    const todos = (eventProps as { todos?: unknown }).todos;
    if (!Array.isArray(todos)) return undefined;
    for (const todo of todos) {
      if (!todo || typeof todo !== "object") continue;
      const content = (todo as Record<string, unknown>).content;
      if (typeof content !== "string") continue;
      const text = sanitizeTitleText(content);
      if (text) return { value: text, score: 2 };
    }
  }

  return undefined;
}

export function buildSessionMessageState(
  events: SessionEvent[],
  options: SessionStateOptions = {}
): SessionMessageState {
  const { endIndex, baseState } = options;
  const startTime = events[0]?.timestamp ?? Date.now();
  const state: SessionMessageState = {
    sessionTitle: baseState?.sessionTitle,
    phaseStatus: baseState?.phaseStatus,
    thinkingText: baseState?.thinkingText,
    tokenUsage: baseState?.tokenUsage,
    currentText: baseState?.currentText ?? "",
    tools: baseState?.tools ? [...baseState.tools] : [],
    todos: baseState?.todos ? [...baseState.todos] : [],
    startedAt: baseState?.startedAt ?? startTime,
  };

  const relevantEvents =
    typeof endIndex === "number" ? events.slice(0, endIndex + 1) : events;

  const claudeTextByIndex = new Map<number, string>();
  const claudeThinkingByIndex = new Map<number, string>();
  const claudeToolByIndex = new Map<number, ClaudeInspectorToolState>();
  const claudeToolById = new Map<string, ClaudeInspectorToolState>();
  const codexToolById = new Map<string, SessionTool>();
  const kimiToolById = new Map<string, SessionTool>();
  let inferredTitle: SessionTitleCandidate | undefined;

  const applyCandidate = (candidate: SessionTitleCandidate | undefined) => {
    if (!candidate || state.sessionTitle) return;
    if (!inferredTitle || candidate.score > inferredTitle.score) {
      inferredTitle = candidate;
    }
  };

  for (const existingTool of state.tools) {
    claudeToolById.set(existingTool.id, { ...existingTool });
    codexToolById.set(existingTool.id, { ...existingTool });
    kimiToolById.set(existingTool.id, { ...existingTool });
  }

  for (const event of relevantEvents) {
    const eventData = unwrapEventData(event.data);
    const eventProps = getEventProperties(eventData);
    const type = event.type;

    applyCandidate(extractTitleCandidateFromEvent(type, eventData, eventProps));

    const claudeRecord = extractClaudeRecord(type, eventData, eventProps);
    if (claudeRecord) {
      applyClaudeRecordToState(state, claudeRecord, {
        textByIndex: claudeTextByIndex,
        thinkingByIndex: claudeThinkingByIndex,
        toolByIndex: claudeToolByIndex,
        toolById: claudeToolById,
      });
      continue;
    }

    const codexRecord = extractCodexRecord(type, eventData, eventProps);
    if (codexRecord) {
      applyCodexRecordToState(state, codexRecord, codexToolById);
      continue;
    }

    const kimiRecord = extractKimiRecord(type, eventData, eventProps);
    if (kimiRecord) {
      applyKimiRecordToState(state, kimiRecord, kimiToolById);
      continue;
    }

    const qwenRecord = extractQwenRecord(type, eventData, eventProps);
    if (qwenRecord) {
      applyQwenRecordToState(state, qwenRecord, {
        textByIndex: claudeTextByIndex,
        thinkingByIndex: claudeThinkingByIndex,
        toolByIndex: claudeToolByIndex,
        toolById: claudeToolById,
      });
      continue;
    }

    if (type === "session.updated") {
      const info = eventProps.info as { title?: unknown } | undefined;
      const title = info?.title;
      if (typeof title === "string") {
        const trimmedTitle = title.trim();
        if (trimmedTitle && !trimmedTitle.startsWith("New session")) {
          state.sessionTitle = trimmedTitle;
          inferredTitle = undefined;
        }
      }
    }

    if (type === "message.updated") {
      const info = eventProps.info as
        | {
            tokens?: {
              input?: unknown;
              output?: unknown;
              reasoning?: unknown;
              cache?: { read?: unknown; write?: unknown };
            };
            cost?: unknown;
          }
        | undefined;
      const tokens = info?.tokens;
      if (tokens && typeof tokens === "object") {
        const input = Number(tokens.input ?? 0) || 0;
        const output = Number(tokens.output ?? 0) || 0;
        const reasoning = Number(tokens.reasoning ?? 0) || 0;
        const cacheRead = Number(tokens.cache?.read ?? 0) || 0;
        const cacheWrite = Number(tokens.cache?.write ?? 0) || 0;
        const total = input + output + reasoning;
        const cost = typeof info?.cost === "number" ? info.cost : undefined;
        state.tokenUsage = {
          input,
          output,
          reasoning,
          cacheRead,
          cacheWrite,
          total,
          cost,
        };
      }
    }

    if (type === "session.status") {
      const statusValue = (eventProps as { status?: unknown }).status;
      const formattedStatus = formatSessionStatus(statusValue);
      if (formattedStatus) {
        state.phaseStatus = formattedStatus;
      }
    }

    if (type === "message.part.updated") {
      const part = (eventProps as { part?: Record<string, unknown> }).part;
      if (!part) continue;

      if (part.type === "tool") {
        const toolState = (part.state || {}) as Record<string, unknown>;
        const existingIdx = state.tools.findIndex((t) => t.id === part.id);
        const toolInfo: SessionTool = {
          id: typeof part.id === "string" ? part.id : "unknown-tool",
          name: typeof part.tool === "string" ? part.tool : "Unknown tool",
          status: typeof toolState.status === "string" ? toolState.status : "pending",
          title: typeof toolState.title === "string" ? toolState.title : undefined,
          input: toolState.input && typeof toolState.input === "object"
            ? toolState.input as Record<string, unknown>
            : undefined,
          output: typeof toolState.output === "string" ? toolState.output : undefined,
          error: typeof toolState.error === "string" ? toolState.error : undefined,
          metadata: toolState.metadata as Record<string, unknown> | undefined,
        };

        if (existingIdx >= 0) {
          state.tools[existingIdx] = toolInfo;
        } else {
          state.tools.push(toolInfo);
        }
      } else if (part.type === "text" && typeof part.text === "string") {
        state.currentText = part.text;
      } else if (part.type === "thinking" && typeof part.text === "string") {
        state.thinkingText = part.text;
      }
    } else if (type === "todo.updated") {
      const todos = ((eventProps as { todos?: unknown }).todos as any[]) || [];
      state.todos = todos.map((t: any) => ({
        content: t.content || t.text || "",
        status: t.status || "pending",
      }));
    }
  }

  const hasNonOpenCodeProviderSignals = relevantEvents.some((event) =>
    event.type.startsWith("claude.raw.")
    || event.type.startsWith("codex.raw.")
    || event.type.startsWith("kimi.raw.")
    || event.type.startsWith("qwen.raw.")
    || event.type === "session.status"
  );

  if (!state.sessionTitle && hasNonOpenCodeProviderSignals && inferredTitle?.value) {
    state.sessionTitle = inferredTitle.value;
  }

  return state;
}
