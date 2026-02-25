import { existsSync } from "fs";
import {
  getChannelAgentProvider,
  getChannelModel,
  getCodexModels,
  getEnabledAgentProviders,
  getKiloModels,
  getOpenCodeModels,
  isAgentEnabled,
  resolveChannelCwd,
} from "@/config";
import type { AgentProviderId } from "@/shared/agent-provider";
import type { ProviderModelLists } from "@/shared/channel-settings";

export type SettingsLauncherAction = "general" | "channel" | "github";

export const SETTINGS_LAUNCHER_ITEMS: Array<{ action: SettingsLauncherAction; label: string }> = [
  { action: "general", label: "General setting" },
  { action: "channel", label: "Channel setting" },
  { action: "github", label: "GitHub info" },
];

export function getProviderModelListsFromConfig(): ProviderModelLists {
  return {
    opencode: getOpenCodeModels(),
    codex: getCodexModels(),
    kilo: getKiloModels(),
  };
}

export function getEnabledProvidersWithFallback(): AgentProviderId[] {
  const enabled = getEnabledAgentProviders();
  return enabled.length > 0 ? enabled : [
    "opencode",
    "claudecode",
    "codex",
    "kimi",
    "kiro",
    "kilo",
    "qwen",
    "goose",
    "gemini",
  ];
}

export function describeChannelSettingsIssues(channelId: string): string[] {
  const issues: string[] = [];
  const provider = getChannelAgentProvider(channelId);
  const model = getChannelModel(channelId);
  const { workingDirectory } = resolveChannelCwd(channelId);
  const normalizeModel = (value: string) => value.trim().toLowerCase();

  if (!isAgentEnabled(provider)) {
    issues.push(`Agent not enabled: ${provider}`);
  }

  if (provider === "opencode" || provider === "codex" || provider === "kilo") {
    const lists = getProviderModelListsFromConfig();
    const models = provider === "opencode"
      ? lists.opencode
      : provider === "codex"
        ? lists.codex
        : lists.kilo;
    const modelSet = new Set(models.map(normalizeModel));
    if (!model) {
      issues.push("Model not configured.");
    } else if (!modelSet.has(normalizeModel(model))) {
      const providerLabel = provider === "opencode" ? "OpenCode" : provider === "codex" ? "Codex" : "Kilo";
      issues.push(`Model not available in configured ${providerLabel} models.`);
    }
  }

  if (!workingDirectory) {
    issues.push("Working directory not configured.");
  } else if (!existsSync(workingDirectory)) {
    issues.push(`Working directory not found: ${workingDirectory}`);
  }

  return issues;
}
