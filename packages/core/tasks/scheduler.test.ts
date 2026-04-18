import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import { invalidateOdeConfigCache, ODE_CONFIG_FILE } from "@/config/local/ode-store";
import type { TaskRecord } from "@/config/local/tasks";
import { resolveTaskAgentProvider } from "./scheduler";

// Scheduler-level tests for pure helpers. We swap the user's real
// ~/.config/ode/ode.json for a deterministic fixture and restore it on
// teardown so these tests never touch production config.

let originalConfigExisted: boolean;
let originalConfigContent: string | null;

function writeTestConfig(agentProviderForC1: string | undefined): void {
  const config = {
    user: {},
    workspaces: [
      {
        id: "ws-test",
        name: "Test Workspace",
        type: "slack",
        channelDetails: [
          {
            id: "C_CODEX_CHANNEL",
            name: "codex-room",
            ...(agentProviderForC1 !== undefined ? { agentProvider: agentProviderForC1 } : {}),
          },
          // Channel with no agentProvider set — getChannelAgentProvider falls
          // back to "opencode" as the global default.
          { id: "C_DEFAULT_CHANNEL", name: "default-room" },
        ],
      },
    ],
  };
  fs.mkdirSync(path.dirname(ODE_CONFIG_FILE), { recursive: true });
  fs.writeFileSync(ODE_CONFIG_FILE, JSON.stringify(config));
  invalidateOdeConfigCache();
}

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "t1",
    title: "test",
    scheduledAt: Date.now(),
    platform: "slack",
    workspaceId: "ws-test",
    workspaceName: "Test Workspace",
    channelId: "C_CODEX_CHANNEL",
    channelName: "codex-room",
    threadId: null,
    messageText: "hi",
    agent: null,
    status: "pending",
    lastError: null,
    triggeredAt: null,
    completedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  originalConfigExisted = fs.existsSync(ODE_CONFIG_FILE);
  originalConfigContent = originalConfigExisted ? fs.readFileSync(ODE_CONFIG_FILE, "utf-8") : null;
});

afterEach(() => {
  try {
    if (originalConfigExisted && originalConfigContent !== null) {
      fs.writeFileSync(ODE_CONFIG_FILE, originalConfigContent);
    } else {
      fs.rmSync(ODE_CONFIG_FILE, { force: true });
    }
  } catch {
    // Best effort.
  }
  invalidateOdeConfigCache();
});

describe("resolveTaskAgentProvider", () => {
  test("prefers task.agent when it is a known provider id", () => {
    writeTestConfig("codex");
    const task = makeTask({ agent: "claudecode" });
    expect(resolveTaskAgentProvider(task)).toBe("claudecode");
  });

  test("falls back to channel agent when task.agent is null", () => {
    writeTestConfig("codex");
    const task = makeTask({ channelId: "C_CODEX_CHANNEL", agent: null });
    expect(resolveTaskAgentProvider(task)).toBe("codex");
  });

  test("falls back to channel agent when task.agent is an unknown string", () => {
    // Defense-in-depth: createTask rejects bad values at write time, but a
    // legacy or manually-edited row should not break the scheduler tick.
    writeTestConfig("codex");
    const task = makeTask({ channelId: "C_CODEX_CHANNEL", agent: "no-such-agent" });
    expect(resolveTaskAgentProvider(task)).toBe("codex");
  });

  test("falls back to 'opencode' when neither task nor channel specify one", () => {
    // C_DEFAULT_CHANNEL has no agentProvider field, so
    // getChannelAgentProvider returns the global default.
    writeTestConfig(undefined);
    const task = makeTask({ channelId: "C_DEFAULT_CHANNEL", agent: null });
    expect(resolveTaskAgentProvider(task)).toBe("opencode");
  });
});
