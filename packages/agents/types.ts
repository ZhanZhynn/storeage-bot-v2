export interface OpenCodeMessage {
  text: string;
  messageType: "assistant" | "result" | "system" | "user" | "notify";
}

export interface OpenCodeOptions {
  agent?: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  reasoningEffort?: "low" | "medium" | "high" | "xhigh";
}

export interface PlatformContext {
  platform?: "slack" | "discord" | "lark" | "telegram";
  channelId: string;
  threadId: string;
  userId: string;
  threadHistory?: string;
  hasGitHubToken?: boolean;
  channelSystemMessage?: string;
}

// Backward-compatible alias: OpenCode transport still expects `slack` key.
export type SlackContext = PlatformContext;

export interface MarketplacePlatform {
  name: string;
  hint: string;
  credentialsConfigured: boolean;
}

export interface MarketplaceContext {
  platforms: MarketplacePlatform[];
}

export interface OpenCodeMessageContext {
  threadHistory?: string;
  slack?: PlatformContext;
  marketplace?: MarketplaceContext;
}

export interface OpenCodeSessionInfo {
  sessionId: string;
  created: boolean;
}

export type PromptPart = { type: "text"; text: string };
