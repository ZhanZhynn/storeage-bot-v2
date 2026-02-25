import { WebClient } from "@slack/web-api";
import {
  describeChannelSettingsIssues,
  SETTINGS_LAUNCHER_ITEMS,
} from "@/ims/shared/settings-domain";

type SettingsLauncherButton = {
  actionId: string;
  label: string;
};

function toSlackSettingsActionId(action: "general" | "channel" | "github"): string {
  if (action === "general") return "open_general_settings_modal";
  if (action === "channel") return "open_settings_modal";
  return "open_github_token_modal";
}

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
      SETTINGS_LAUNCHER_ITEMS.map((item) => ({
        actionId: toSlackSettingsActionId(item.action),
        label: item.label.toLowerCase(),
      }))
    ),
  });
}

export function describeSlackSettingsIssues(channelId: string): string[] {
  return describeChannelSettingsIssues(channelId);
}
