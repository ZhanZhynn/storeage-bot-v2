import { WebClient } from "@slack/web-api";
import { existsSync } from "fs";
import {
  getChannelAgentProvider,
  getChannelModel,
  getOpenCodeModels,
  getKiloModels,
  isAgentEnabled,
  resolveChannelCwd,
} from "@/config";

type SettingsLauncherButton = {
  actionId: string;
  label: string;
};

function buildSettingsLauncherBlocks(
  channelId: string,
  description: string,
  buttons: SettingsLauncherButton[]
): any[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: description,
      },
    },
    {
      type: "actions",
      elements: buttons.map((button) => ({
        type: "button",
        action_id: button.actionId,
        text: { type: "plain_text", text: button.label },
        value: channelId,
      })),
    },
  ];
}

export async function postSlackGeneralSettingsLauncher(
  channelId: string,
  userId: string,
  client: WebClient
): Promise<void> {
  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: "Open settings",
    blocks: buildSettingsLauncherBlocks(
      channelId,
      "Choose which settings page to open.",
      [
        { actionId: "open_general_settings_modal", label: "general setting" },
        { actionId: "open_settings_modal", label: "channel setting" },
        { actionId: "open_github_token_modal", label: "github info" },
      ]
    ),
  });
}

export function describeSlackSettingsIssues(channelId: string): string[] {
  const issues: string[] = [];
  const provider = getChannelAgentProvider(channelId);
  const model = getChannelModel(channelId);
  const { workingDirectory } = resolveChannelCwd(channelId);
  const normalizeModel = (value: string) => value.trim().toLowerCase();

  if (!isAgentEnabled(provider)) {
    issues.push(`Agent not enabled: ${provider}`);
  }

  if (provider === "opencode") {
    const models = getOpenCodeModels();
    const modelSet = new Set(models.map(normalizeModel));
    if (!model) {
      issues.push("Model not configured.");
    } else if (!modelSet.has(normalizeModel(model))) {
      issues.push("Model not available in configured OpenCode models.");
    }
  } else if (provider === "kilo") {
    const models = getKiloModels();
    const modelSet = new Set(models.map(normalizeModel));
    if (!model) {
      issues.push("Model not configured.");
    } else if (!modelSet.has(normalizeModel(model))) {
      issues.push("Model not available in configured Kilo models.");
    }
  }

  if (!workingDirectory) {
    issues.push("Working directory not configured.");
  } else if (!existsSync(workingDirectory)) {
    issues.push(`Working directory not found: ${workingDirectory}`);
  }

  return issues;
}
