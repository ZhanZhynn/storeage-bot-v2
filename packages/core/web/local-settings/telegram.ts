import {
  readDashboardConfig,
  updateDashboardConfig,
} from "@/config";
import {
  createWorkspaceCredentialId,
  normalizeChannelAgentProvider,
  resolveFallbackModel,
  type WorkspaceConfig,
} from "./shared";

type TelegramBotInfo = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
};

const telegramRequest = async <T>(token: string, method: string): Promise<T> => {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const response = await fetch(url);
  const data = (await response.json()) as T & { ok?: boolean; description?: string };
  if (!data.ok) {
    throw new Error(data.description ?? "Telegram API error");
  }
  return data;
};

const fetchBotInfo = async (token: string): Promise<TelegramBotInfo> => {
  const data = await telegramRequest<{ result: TelegramBotInfo }>(token, "getMe");
  return data.result;
};

const buildDiscoveredChannelDetails = (
  fallbackModel: string
): WorkspaceConfig["channelDetails"] => [];

export const discoverTelegramWorkspace = async (
  telegramBotToken: string
): Promise<WorkspaceConfig> => {
  const botToken = telegramBotToken.trim();
  if (!botToken) throw new Error("Missing Telegram bot token");

  const config = readDashboardConfig();
  const botInfo = await fetchBotInfo(botToken);
  const fallbackModel = config.agents.opencode.models[0] ?? "";
  const workspaceId = createWorkspaceCredentialId("telegram", botToken);
  const workspaceName = botInfo.first_name?.trim() || `Workspace ${config.workspaces.length + 1}`;
  const channelDetails = buildDiscoveredChannelDetails(fallbackModel);

  return {
    id: workspaceId,
    type: "telegram",
    name: workspaceName,
    domain: botInfo.username ? `t.me/${botInfo.username}` : "",
    status: "active",
    channels: channelDetails.length,
    members: 0,
    lastSync: new Date().toISOString(),
    telegramBotToken: botToken,
    channelDetails,
  };
};

export const syncTelegramWorkspace = async (workspaceId: string): Promise<WorkspaceConfig> => {
  const config = readDashboardConfig();
  const workspaceIndex = config.workspaces.findIndex((item) => item.id === workspaceId);
  if (workspaceIndex === -1) throw new Error("Workspace not found");

  const workspace = config.workspaces[workspaceIndex]!;
  if (workspace.type !== "telegram") throw new Error("Workspace is not Telegram type");

  const botToken = workspace.telegramBotToken?.trim() ?? "";
  if (!botToken) throw new Error("Missing Telegram bot token");

  const botInfo = await fetchBotInfo(botToken);
  const fallbackModel = config.agents.opencode.models[0] ?? "";

  const updatedWorkspace: WorkspaceConfig = {
    ...workspace,
    type: "telegram",
    name: botInfo.first_name ?? workspace.name,
    domain: botInfo.username ? `t.me/${botInfo.username}` : workspace.domain,
    channels: workspace.channelDetails.length,
    lastSync: new Date().toISOString(),
  };

  updateDashboardConfig((current) => ({
    ...current,
    workspaces: current.workspaces.map((item, index) =>
      index === workspaceIndex ? updatedWorkspace : item
    ),
  }));

  return updatedWorkspace;
};
