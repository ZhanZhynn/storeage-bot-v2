import { readFile, writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

export type DashboardConfig = {
  user: {
    name: string;
    email: string;
    initials?: string;
    avatar?: string;
    githubToken: string;
    defaultMessageFrequency: "aggressive" | "medium" | "minimum";
  };
  devServers: {
    id: string;
    name: string;
    url: string;
    models: string[];
  }[];
  workspaces: {
    id: string;
    name: string;
    domain: string;
    status: "active" | "paused";
    channels: number;
    members: number;
    lastSync: string;
    slackAppToken?: string;
    slackBotToken?: string;
    channelDetails: {
      id: string;
      name: string;
      model: string;
      workingDirectory: string;
      devServerId?: string | null;
    }[];
  }[];
};

export const defaultDashboardConfig: DashboardConfig = {
  user: {
    name: "",
    email: "",
    githubToken: "",
    defaultMessageFrequency: "medium",
  },
  devServers: [],
  workspaces: [],
};

const configDir = join(homedir(), ".config", "ode");
const configPath = join(configDir, "ode.json");

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const asFrequency = (value: unknown): DashboardConfig["user"]["defaultMessageFrequency"] => {
  if (value === "aggressive" || value === "minimum") return value;
  return "medium";
};

const asStatus = (value: unknown): DashboardConfig["workspaces"][number]["status"] =>
  value === "paused" ? "paused" : "active";

export const sanitizeDashboardConfig = (config: unknown): DashboardConfig => {
  if (!config || typeof config !== "object") {
    return defaultDashboardConfig;
  }

  const record = config as Record<string, unknown>;
  const user = record.user && typeof record.user === "object" ? (record.user as Record<string, unknown>) : {};

  const devServers = Array.isArray(record.devServers)
    ? (record.devServers
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const server = item as Record<string, unknown>;
          return {
            id: asString(server.id),
            name: asString(server.name),
            url: asString(server.url),
            models: asStringArray(server.models),
          };
        })
        .filter(Boolean) as DashboardConfig["devServers"])
    : [];

  const workspaces = Array.isArray(record.workspaces)
    ? (record.workspaces
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const workspace = item as Record<string, unknown>;
          const channelDetails = Array.isArray(workspace.channelDetails)
            ? (workspace.channelDetails
                .map((channel) => {
                  if (!channel || typeof channel !== "object") return null;
                  const detail = channel as Record<string, unknown>;
                  const devServerId =
                    typeof detail.devServerId === "string"
                      ? detail.devServerId
                      : detail.devServerId === null
                        ? null
                        : undefined;
                  return {
                    id: asString(detail.id),
                    name: asString(detail.name),
                    model: asString(detail.model),
                    workingDirectory: asString(detail.workingDirectory),
                    devServerId,
                  };
                })
                .filter(Boolean) as DashboardConfig["workspaces"][number]["channelDetails"])
            : [];

          const slackAppToken = asString(workspace.slackAppToken, "");
          const slackBotToken = asString(workspace.slackBotToken, "");

          return {
            id: asString(workspace.id),
            name: asString(workspace.name),
            domain: asString(workspace.domain),
            status: asStatus(workspace.status),
            channels: asNumber(workspace.channels),
            members: asNumber(workspace.members),
            lastSync: asString(workspace.lastSync),
            slackAppToken: slackAppToken || undefined,
            slackBotToken: slackBotToken || undefined,
            channelDetails,
          };
        })
        .filter(Boolean) as DashboardConfig["workspaces"])
    : [];

  return {
    user: {
      name: asString(user.name),
      email: asString(user.email),
      initials: asString(user.initials, "") || undefined,
      avatar: asString(user.avatar, "") || undefined,
      githubToken: asString(user.githubToken),
      defaultMessageFrequency: asFrequency(user.defaultMessageFrequency),
    },
    devServers,
    workspaces,
  };
};

export const readLocalSettings = async (): Promise<DashboardConfig> => {
  try {
    const raw = await readFile(configPath, "utf-8");
    return sanitizeDashboardConfig(JSON.parse(raw));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return defaultDashboardConfig;
    }
    return defaultDashboardConfig;
  }
};

export const writeLocalSettings = async (config: DashboardConfig): Promise<void> => {
  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2));
};

type SlackChannel = {
  id: string;
  name: string;
};

const slackRequest = async <T>(token: string, path: string, params?: URLSearchParams) => {
  const url = new URL(`https://slack.com/api/${path}`);
  if (params) {
    url.search = params.toString();
  }
  const response = await fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/x-www-form-urlencoded",
    },
  });
  const data = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!data.ok) {
    const message = data.error ?? "Slack API error";
    throw new Error(message);
  }
  return data;
};

const fetchSlackChannels = async (token: string) => {
  const channels: SlackChannel[] = [];
  let cursor = "";
  do {
    const params = new URLSearchParams({
      limit: "200",
      types: "public_channel,private_channel",
      exclude_archived: "true",
    });
    if (cursor) params.set("cursor", cursor);
    const data = await slackRequest<{
      channels: SlackChannel[];
      response_metadata?: { next_cursor?: string };
    }>(token, "conversations.list", params);
    channels.push(...(data.channels ?? []));
    cursor = data.response_metadata?.next_cursor ?? "";
  } while (cursor);
  return channels;
};

export const syncSlackWorkspace = async (workspaceId: string): Promise<DashboardConfig["workspaces"][number]> => {
  const config = await readLocalSettings();
  const workspaceIndex = config.workspaces.findIndex((item) => item.id === workspaceId);
  if (workspaceIndex === -1) {
    throw new Error("Workspace not found");
  }

  const workspace = config.workspaces[workspaceIndex]!;
  const botToken = workspace.slackBotToken?.trim() ?? "";
  if (!botToken) {
    throw new Error("Missing Slack bot token");
  }

  const teamInfo = await slackRequest<{ team: { name?: string; domain?: string } }>(
    botToken,
    "team.info"
  );
  const slackChannels = await fetchSlackChannels(botToken);
  const fallbackDevServerId = config.devServers[0]?.id ?? null;
  const fallbackModel = config.devServers[0]?.models?.[0] ?? "";

  const channelDetails = slackChannels.map((channel) => {
    const existing = workspace.channelDetails.find((item) => item.id === channel.id);
    return {
      id: channel.id,
      name: channel.name ? `#${channel.name}` : "",
      model: existing?.model ?? fallbackModel,
      workingDirectory: existing?.workingDirectory ?? "",
      devServerId: existing?.devServerId ?? fallbackDevServerId,
    };
  });

  const updatedWorkspace: DashboardConfig["workspaces"][number] = {
    ...workspace,
    name: teamInfo.team?.name ?? workspace.name,
    domain: teamInfo.team?.domain ? `${teamInfo.team.domain}.slack.com` : workspace.domain,
    channels: channelDetails.length,
    lastSync: new Date().toISOString(),
    channelDetails,
  };

  const nextConfig: DashboardConfig = {
    ...config,
    workspaces: config.workspaces.map((item, index) =>
      index === workspaceIndex ? updatedWorkspace : item
    ),
  };

  await writeLocalSettings(nextConfig);
  return updatedWorkspace;
};
