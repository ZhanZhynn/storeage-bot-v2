import * as claude from "./claude";
import * as codex from "./codex";
import * as kimi from "./kimi";
import * as kiro from "./kiro";
import * as kilo from "./kilo";
import * as opencode from "./opencode";
import * as qwen from "./qwen";
import * as goose from "./goose";
import * as gemini from "./gemini";
import {
  AGENT_PROVIDERS,
  normalizeAgentProviderId,
  providerSupportsEventStream,
  type AgentProviderId,
} from "@/shared/agent-provider";
export type { AgentProviderId } from "@/shared/agent-provider";
import type {
  OpenCodeMessage,
  OpenCodeMessageContext,
  OpenCodeOptions,
  OpenCodeSessionInfo,
} from "./types";

export type AgentStaticConfig = {
  displayName: string;
};

export type AgentProvider = {
  id: AgentProviderId;
  supportsEventStream: boolean;
  startServer: () => Promise<void>;
  stopServer: () => void | Promise<void>;
  createSession: (workingPath: string, env?: Record<string, string>) => Promise<string>;
  getOrCreateSession: (
    channelId: string,
    threadId: string,
    workingPath: string,
    env?: Record<string, string>
  ) => Promise<OpenCodeSessionInfo>;
  sendMessage: (
    channelId: string,
    sessionId: string,
    message: string,
    workingPath: string,
    options?: OpenCodeOptions,
    context?: OpenCodeMessageContext
  ) => Promise<OpenCodeMessage[]>;
  abortSession: (sessionId: string, directory?: string) => Promise<void>;
  cancelActiveRequest: (channelId: string, sessionId: string, directory?: string) => Promise<boolean>;
  ensureSession: (sessionId: string) => Promise<void>;
  subscribeToSession: (sessionId: string, handler: (event: unknown) => void) => () => void;
  getStaticConfig: () => AgentStaticConfig;
};

type AgentProviderRuntime = Omit<AgentProvider, "id" | "supportsEventStream">;

const providerRuntimes: Record<AgentProviderId, AgentProviderRuntime> = {
  opencode: {
    startServer: opencode.startServer,
    stopServer: opencode.stopServer,
    createSession: opencode.createSession,
    getOrCreateSession: opencode.getOrCreateSession,
    sendMessage: opencode.sendMessage,
    abortSession: opencode.abortSession,
    cancelActiveRequest: opencode.cancelActiveRequest,
    ensureSession: opencode.ensureSession,
    subscribeToSession: opencode.subscribeToSession,
    getStaticConfig: opencode.getStaticConfig,
  },
  claudecode: {
    startServer: claude.startServer,
    stopServer: claude.stopServer,
    createSession: claude.createSession,
    getOrCreateSession: claude.getOrCreateSession,
    sendMessage: claude.sendMessage,
    abortSession: claude.abortSession,
    cancelActiveRequest: claude.cancelActiveRequest,
    ensureSession: claude.ensureSession,
    subscribeToSession: claude.subscribeToSession,
    getStaticConfig: claude.getStaticConfig,
  },
  codex: {
    startServer: codex.startServer,
    stopServer: codex.stopServer,
    createSession: codex.createSession,
    getOrCreateSession: codex.getOrCreateSession,
    sendMessage: codex.sendMessage,
    abortSession: codex.abortSession,
    cancelActiveRequest: codex.cancelActiveRequest,
    ensureSession: codex.ensureSession,
    subscribeToSession: codex.subscribeToSession,
    getStaticConfig: codex.getStaticConfig,
  },
  kimi: {
    startServer: kimi.startServer,
    stopServer: kimi.stopServer,
    createSession: kimi.createSession,
    getOrCreateSession: kimi.getOrCreateSession,
    sendMessage: kimi.sendMessage,
    abortSession: kimi.abortSession,
    cancelActiveRequest: kimi.cancelActiveRequest,
    ensureSession: kimi.ensureSession,
    subscribeToSession: kimi.subscribeToSession,
    getStaticConfig: kimi.getStaticConfig,
  },
  kiro: {
    startServer: kiro.startServer,
    stopServer: kiro.stopServer,
    createSession: kiro.createSession,
    getOrCreateSession: kiro.getOrCreateSession,
    sendMessage: kiro.sendMessage,
    abortSession: kiro.abortSession,
    cancelActiveRequest: kiro.cancelActiveRequest,
    ensureSession: kiro.ensureSession,
    subscribeToSession: kiro.subscribeToSession,
    getStaticConfig: kiro.getStaticConfig,
  },
  kilo: {
    startServer: kilo.startServer,
    stopServer: kilo.stopServer,
    createSession: kilo.createSession,
    getOrCreateSession: kilo.getOrCreateSession,
    sendMessage: kilo.sendMessage,
    abortSession: kilo.abortSession,
    cancelActiveRequest: kilo.cancelActiveRequest,
    ensureSession: kilo.ensureSession,
    subscribeToSession: kilo.subscribeToSession,
    getStaticConfig: kilo.getStaticConfig,
  },
  qwen: {
    startServer: qwen.startServer,
    stopServer: qwen.stopServer,
    createSession: qwen.createSession,
    getOrCreateSession: qwen.getOrCreateSession,
    sendMessage: qwen.sendMessage,
    abortSession: qwen.abortSession,
    cancelActiveRequest: qwen.cancelActiveRequest,
    ensureSession: qwen.ensureSession,
    subscribeToSession: qwen.subscribeToSession,
    getStaticConfig: qwen.getStaticConfig,
  },
  goose: {
    startServer: goose.startServer,
    stopServer: goose.stopServer,
    createSession: goose.createSession,
    getOrCreateSession: goose.getOrCreateSession,
    sendMessage: goose.sendMessage,
    abortSession: goose.abortSession,
    cancelActiveRequest: goose.cancelActiveRequest,
    ensureSession: goose.ensureSession,
    subscribeToSession: goose.subscribeToSession,
    getStaticConfig: goose.getStaticConfig,
  },
  gemini: {
    startServer: gemini.startServer,
    stopServer: gemini.stopServer,
    createSession: gemini.createSession,
    getOrCreateSession: gemini.getOrCreateSession,
    sendMessage: gemini.sendMessage,
    abortSession: gemini.abortSession,
    cancelActiveRequest: gemini.cancelActiveRequest,
    ensureSession: gemini.ensureSession,
    subscribeToSession: gemini.subscribeToSession,
    getStaticConfig: gemini.getStaticConfig,
  },
};

const providers: Record<AgentProviderId, AgentProvider> = Object.fromEntries(
  AGENT_PROVIDERS.map((providerId) => [
    providerId,
    {
      id: providerId,
      supportsEventStream: providerSupportsEventStream(providerId),
      ...providerRuntimes[providerId],
    },
  ])
) as Record<AgentProviderId, AgentProvider>;

export function getSelectedAgentProviderId(): AgentProviderId {
  return normalizeAgentProviderId(process.env.ODE_AGENT_PROVIDER);
}

export function getSelectedAgentProvider(): AgentProvider {
  return providers[getSelectedAgentProviderId()];
}

export function getAgentProvider(providerId: AgentProviderId): AgentProvider {
  return providers[providerId];
}
