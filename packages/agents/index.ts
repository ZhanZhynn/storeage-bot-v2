import * as claude from "./claude";
import * as opencode from "./opencode";

export type {
  OpenCodeMessage,
  OpenCodeMessageContext,
  OpenCodeOptions,
  OpenCodeProgressHandler,
  OpenCodeSessionInfo,
} from "./types";

const agent = opencode;

export const selectedAgent = "opencode";
export const supportsEventStream = true;

export const startServer = agent.startServer;
export const stopServer = agent.stopServer;
export const createSession = agent.createSession;
export const getOrCreateSession = agent.getOrCreateSession;
export const sendMessage = agent.sendMessage;
export const abortSession = agent.abortSession;
export const cancelActiveRequest = agent.cancelActiveRequest;
export const ensureSession = agent.ensureSession;
export const subscribeToSession = agent.subscribeToSession;
