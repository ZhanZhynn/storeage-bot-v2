import { getWebHost, getWebPort } from "@/config";

function getLocalSettingsUrl(): string {
  return `http://${getWebHost()}:${getWebPort()}/`;
}

export async function sendLarkSettingsCard(params: {
  channelId: string;
  threadId: string;
  sendInteractive: (card: Record<string, unknown>) => Promise<string | undefined>;
  sendText: (text: string) => Promise<string | undefined>;
  logEvent: (message: string, payload: Record<string, unknown>) => void;
}): Promise<string | undefined> {
  const { channelId, threadId, sendInteractive, sendText, logEvent } = params;
  const settingsUrl = getLocalSettingsUrl();
  logEvent("Lark settings UI launcher triggered", {
    channelId,
    threadId,
    settingsUrl,
  });

  const card = {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: "blue",
      title: {
        tag: "plain_text",
        content: "Ode Settings",
      },
    },
    elements: [
      {
        tag: "markdown",
        content: `Configure this chat in the local settings UI.\n\nChannel: \`${channelId}\``,
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "Open Local Setting",
            },
            type: "primary",
            url: settingsUrl,
          },
        ],
      },
    ],
  };

  try {
    const messageId = await sendInteractive(card as unknown as Record<string, unknown>);
    logEvent("Lark settings card sent", {
      channelId,
      threadId,
      messageId: messageId ?? "",
    });
    return messageId;
  } catch {
    logEvent("Lark settings card failed, sending fallback text", {
      channelId,
      threadId,
    });
    const fallbackText = [
      "Ode settings",
      `Open: ${settingsUrl}`,
      `Channel: ${channelId}`,
      "Use this channel in Local Setting to configure provider/model/directory.",
    ].join("\n");
    return sendText(fallbackText);
  }
}
