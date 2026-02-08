import { spawn, type ChildProcess } from "child_process";
import {
  getThreadSessionId,
  setThreadSessionId,
} from "@/config/local/settings";
import { log } from "@/utils";
import { buildPromptParts, buildPromptText, buildSystemPrompt } from "../shared";
import type {
  OpenCodeMessage,
  OpenCodeMessageContext,
  OpenCodeOptions,
  OpenCodeSessionInfo,
} from "../types";

export type SessionEnvironment = Record<string, string>;

const activeRequests = new Map<string, { controller: AbortController; process?: ChildProcess }>();
const sessionLocks = new Map<string, Promise<unknown>>();
const sessionEnvironments = new Map<string, SessionEnvironment>();
const sessionSubscribers = new Map<string, Set<(event: unknown) => void>>();
const newSessions = new Set<string>();

const TOOL_MARKER_PATTERN = /\(using tool:\s*([^\)]+)\)/i;
const READ_OPERATION_PATTERN = /Reading file:\s*(.+?),\s*from line\s*(\d+)\s*to\s*(\d+)/i;

function normalizeSessionEnvironment(env?: SessionEnvironment | null): string {
  if (!env) return "";
  return Object.keys(env)
    .sort()
    .map((key) => `${key}=${env[key]}`)
    .join("\n");
}

async function withSessionLock<T>(sessionKey: string, fn: () => Promise<T>): Promise<T> {
  const existing = sessionLocks.get(sessionKey);
  if (existing) {
    await existing.catch(() => {});
  }

  const promise = fn();
  sessionLocks.set(sessionKey, promise);

  try {
    return await promise;
  } finally {
    sessionLocks.delete(sessionKey);
  }
}

function formatShellCommand(args: string[]): string {
  return args
    .map((arg) => {
      if (arg.length === 0) return "''";
      if (/[^\w@%+=:,./-]/.test(arg)) {
        const escaped = arg.replace(/'/g, `"'"'"`);
        return `'${escaped}'`;
      }
      return arg;
    })
    .join(" ");
}

function resolveKiroBinary(): string {
  if (typeof Bun !== "undefined") {
    if (Bun.which("kiro-cli")) return "kiro-cli";
    if (Bun.which("kiro")) return "kiro";
  }
  return "kiro-cli";
}

export function buildKiroCommandArgs(params: {
  isNewSession: boolean;
  prompt: string;
  agent?: string;
}): string[] {
  const args = [
    "chat",
    "--no-interactive",
    "--trust-all-tools",
  ];
  if (!params.isNewSession) {
    args.push("--resume");
  }
  if (params.agent?.trim()) {
    args.push("--agent", params.agent.trim());
  }
  args.push(params.prompt);
  return args;
}

export function buildKiroCommand(binary: string, args: string[]): string {
  return formatShellCommand([binary, ...args]);
}

function publishSessionEvent(sessionId: string, event: unknown): void {
  const handlers = sessionSubscribers.get(sessionId);
  if (!handlers || handlers.size === 0) return;
  for (const handler of handlers) {
    try {
      handler(event);
    } catch (err) {
      log.warn("Kiro session subscriber failed", {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function publishKiroTextUpdate(sessionId: string, text: string): void {
  publishSessionEvent(sessionId, {
    type: "message.part.updated",
    properties: {
      part: {
        id: "kiro-text",
        type: "text",
        text,
      },
    },
  });
}

function publishKiroToolUpdate(params: {
  sessionId: string;
  id: string;
  tool: string;
  status: "pending" | "running" | "completed" | "error";
  title?: string;
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
}): void {
  publishSessionEvent(params.sessionId, {
    type: "message.part.updated",
    properties: {
      part: {
        id: params.id,
        type: "tool",
        tool: params.tool,
        state: {
          status: params.status,
          ...(params.title ? { title: params.title } : {}),
          ...(params.input ? { input: params.input } : {}),
          ...(params.output ? { output: params.output } : {}),
          ...(params.error ? { error: params.error } : {}),
        },
      },
    },
  });
}

export function sanitizeKiroOutput(text: string): string {
  return text
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "")
    .replace(/\u001B[@-_]/g, "")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001A\u001C-\u001F\u007F]/g, "")
    .replace(/[ \t]+$/gm, "");
}

function normalizeToolName(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return "Unknown tool";
  if (raw === "fs_read" || raw === "read" || raw === "readfile") return "Read";
  if (raw === "grep" || raw === "search" || raw === "ripgrep") return "Grep";
  if (raw === "glob") return "Glob";
  if (raw === "shell" || raw === "bash" || raw === "command") return "Bash";
  if (raw === "code") return "Task";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function isOperationalLine(line: string): boolean {
  if (!line) return true;
  if (TOOL_MARKER_PATTERN.test(line)) return true;
  if (READ_OPERATION_PATTERN.test(line)) return true;
  if (/^(↱|✓|\.|- Completed in|- Summary:|Summary:|Batch\s+.+operation)/i.test(line)) return true;
  if (/^(Searching for:|Operation \d+:|Completed in \d|\[.*\]\s*\d+ bytes)/i.test(line)) return true;
  return false;
}

export function extractKiroFinalResponse(rawOutput: string): string {
  const cleaned = sanitizeKiroOutput(rawOutput);
  const lines = cleaned.split("\n").map((line) => line.trimEnd());
  const promptIndex = lines.findLastIndex((line) => line.trimStart().startsWith(">"));
  const start = promptIndex >= 0 ? promptIndex : 0;
  const candidate = lines.slice(start)
    .filter((line) => !isOperationalLine(line.trim()))
    .join("\n")
    .trim();

  if (!candidate) {
    return cleaned.trim();
  }

  return candidate.replace(/^>\s?/, "").trim();
}

type KiroToolRuntimeState = {
  id: string;
  name: string;
  title?: string;
  input?: Record<string, unknown>;
};

function createKiroStreamParser(sessionId: string) {
  let toolCounter = 0;
  let pending = "";
  let runningTool: KiroToolRuntimeState | null = null;
  let latestAssistantLine = "";

  const completeRunningTool = () => {
    if (!runningTool) return;
    publishKiroToolUpdate({
      sessionId,
      id: runningTool.id,
      tool: runningTool.name,
      status: "completed",
      title: runningTool.title,
      input: runningTool.input,
    });
    runningTool = null;
  };

  const startTool = (name: string, title: string, input?: Record<string, unknown>) => {
    completeRunningTool();
    const id = `kiro-tool-${++toolCounter}`;
    const toolState: KiroToolRuntimeState = {
      id,
      name,
      title,
      ...(input ? { input } : {}),
    };
    runningTool = toolState;
    publishKiroToolUpdate({
      sessionId,
      id,
      tool: name,
      status: "running",
      title,
      input,
    });
  };

  const pushLine = (rawLine: string) => {
    const line = sanitizeKiroOutput(rawLine).trim();
    if (!line) return;

    const readMatch = line.match(READ_OPERATION_PATTERN);
    if (readMatch) {
      const filePath = readMatch[1]?.trim() ?? "";
      const fromLine = Number(readMatch[2] ?? 1);
      const toLine = Number(readMatch[3] ?? fromLine);
      const id = `kiro-tool-${++toolCounter}`;
      publishKiroToolUpdate({
        sessionId,
        id,
        tool: "Read",
        status: "completed",
        title: `Read ${filePath}`,
        input: {
          filePath,
          offset: Math.max(0, fromLine - 1),
          limit: Math.max(1, toLine - fromLine + 1),
        },
      });
      return;
    }

    const toolMatch = line.match(TOOL_MARKER_PATTERN);
    if (toolMatch) {
      const rawTool = toolMatch[1] ?? "";
      const name = normalizeToolName(rawTool);
      const detail = line.replace(TOOL_MARKER_PATTERN, "").trim();
      const input = name === "Grep" && detail.startsWith("Searching for:")
        ? { pattern: detail.slice("Searching for:".length).trim() }
        : undefined;
      startTool(name, detail || `${name} operation`, input);
      return;
    }

    if (/completed in\s+\d/i.test(line) || /^summary:/i.test(line) || /^-\s+summary:/i.test(line)) {
      completeRunningTool();
      return;
    }

    if (line.startsWith(">")) {
      latestAssistantLine = line.replace(/^>\s?/, "").trim();
      if (latestAssistantLine) {
        publishKiroTextUpdate(sessionId, latestAssistantLine);
      }
    }
  };

  return {
    pushChunk(chunk: string) {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        pushLine(line);
      }
    },
    finalize(rawOutput: string): string {
      if (pending.trim()) {
        pushLine(pending);
      }
      completeRunningTool();
      return extractKiroFinalResponse(rawOutput);
    },
    getLatestAssistantLine(): string {
      return latestAssistantLine;
    },
  };
}

async function runKiroCommand(
  binary: string,
  args: string[],
  cwd: string,
  env: SessionEnvironment,
  entry: { controller: AbortController; process?: ChildProcess },
  onChunk?: (chunk: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: { ...process.env, ...env },
      signal: entry.controller.signal,
    });

    entry.process = child;
    child.stdin?.end();

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout?.on("data", (chunk) => {
      const bufferChunk = Buffer.from(chunk);
      stdoutChunks.push(bufferChunk);
      onChunk?.(bufferChunk.toString("utf-8"));
    });

    child.stderr?.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Kiro CLI timed out"));
    }, 10 * 60 * 1000);

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      const stdout = Buffer.concat(stdoutChunks).toString("utf-8").trim();
      const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();

      log.info("Kiro CLI completed", {
        code,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      });

      if (code !== 0) {
        reject(new Error(stderr || `Kiro CLI exited with code ${code}`));
        return;
      }

      resolve(stdout);
    });
  });
}

function parseKiroResponse(output: string): string {
  const text = extractKiroFinalResponse(output);
  if (!text) {
    throw new Error("Kiro returned empty response");
  }
  return text;
}

export async function createSession(workingPath: string, env?: SessionEnvironment): Promise<string> {
  const sessionId = crypto.randomUUID();
  sessionEnvironments.set(sessionId, env ?? {});
  newSessions.add(sessionId);
  log.info("Created Kiro session", { sessionId, workingPath });
  return sessionId;
}

export async function getOrCreateSession(
  channelId: string,
  threadId: string,
  workingPath: string,
  env: SessionEnvironment = {}
): Promise<OpenCodeSessionInfo> {
  const existingSession = getThreadSessionId(channelId, threadId);
  if (existingSession) {
    const existingEnv = normalizeSessionEnvironment(sessionEnvironments.get(existingSession));
    const desiredEnv = normalizeSessionEnvironment(env);
    if (existingEnv !== desiredEnv) {
      log.info("Kiro session environment changed; creating new session", {
        channelId,
        threadId,
        workingPath,
      });
      const sessionId = await createSession(workingPath, env);
      setThreadSessionId(channelId, threadId, sessionId);
      return { sessionId, created: true };
    }

    if (!sessionEnvironments.has(existingSession)) {
      sessionEnvironments.set(existingSession, env);
    }

    return { sessionId: existingSession, created: false };
  }

  log.info("Creating new Kiro session for thread", { channelId, threadId, workingPath });
  const sessionId = await createSession(workingPath, env);
  setThreadSessionId(channelId, threadId, sessionId);
  return { sessionId, created: true };
}

export async function sendMessage(
  channelId: string,
  sessionId: string,
  message: string,
  workingPath: string,
  options?: OpenCodeOptions,
  context?: OpenCodeMessageContext
): Promise<OpenCodeMessage[]> {
  const sessionKey = `${channelId}:${sessionId}`;
  const existingEntry = activeRequests.get(sessionKey);
  if (existingEntry) {
    existingEntry.controller.abort();
    existingEntry.process?.kill("SIGTERM");
  }

  const entry = { controller: new AbortController() };
  activeRequests.set(sessionKey, entry);

  try {
    return await withSessionLock(sessionKey, async () => {
      const parts = buildPromptParts(channelId, message, options, context);
      const prompt = buildPromptText(parts);
      const systemPrompt = buildSystemPrompt(context?.slack);
      const kiroPrompt = `<system-prompt>\n${systemPrompt}\n</system-prompt>\n\n${prompt}`;

      const envOverrides = sessionEnvironments.get(sessionId) ?? {};
      const binary = resolveKiroBinary();
      const args = buildKiroCommandArgs({
        isNewSession: newSessions.has(sessionId),
        prompt: kiroPrompt,
        agent: options?.agent,
      });
      const command = buildKiroCommand(binary, args);

      publishSessionEvent(sessionId, {
        type: "session.status",
        properties: {
          status: {
            type: "busy",
          },
        },
      });

      log.info("Running Kiro CLI", {
        cwd: workingPath,
        command,
      });

      const parser = createKiroStreamParser(sessionId);
      const output = await runKiroCommand(binary, args, workingPath, envOverrides, entry, (chunk) => {
        parser.pushChunk(chunk);
      });

      const text = parser.finalize(output) || parseKiroResponse(output);
      publishKiroTextUpdate(sessionId, text);
      publishSessionEvent(sessionId, {
        type: "session.status",
        properties: {
          status: {
            type: "idle",
          },
        },
      });
      newSessions.delete(sessionId);
      return [{ text, messageType: "assistant" }];
    });
  } finally {
    activeRequests.delete(sessionKey);
  }
}

export async function ensureSession(sessionId: string): Promise<void> {
  if (!sessionEnvironments.has(sessionId)) {
    sessionEnvironments.set(sessionId, {});
  }
}

export function subscribeToSession(sessionId: string, handler: (event: unknown) => void): () => void {
  const handlers = sessionSubscribers.get(sessionId) ?? new Set<(event: unknown) => void>();
  handlers.add(handler);
  sessionSubscribers.set(sessionId, handlers);

  return () => {
    const activeHandlers = sessionSubscribers.get(sessionId);
    if (!activeHandlers) return;
    activeHandlers.delete(handler);
    if (activeHandlers.size === 0) {
      sessionSubscribers.delete(sessionId);
    }
  };
}

export async function abortSession(sessionId: string, _directory?: string): Promise<void> {
  for (const [sessionKey, entry] of activeRequests) {
    if (sessionKey.endsWith(`:${sessionId}`)) {
      entry.controller.abort();
      entry.process?.kill("SIGTERM");
      activeRequests.delete(sessionKey);
    }
  }
}

export async function cancelActiveRequest(
  channelId: string,
  sessionId: string,
  _directory?: string
): Promise<boolean> {
  const sessionKey = `${channelId}:${sessionId}`;
  const entry = activeRequests.get(sessionKey);
  if (!entry) return false;

  entry.controller.abort();
  entry.process?.kill("SIGTERM");
  activeRequests.delete(sessionKey);
  return true;
}

export function stopServer(): void {
  for (const entry of activeRequests.values()) {
    entry.controller.abort();
    entry.process?.kill("SIGTERM");
  }
  activeRequests.clear();
  sessionSubscribers.clear();
}

export async function startServer(): Promise<void> {
  return;
}
