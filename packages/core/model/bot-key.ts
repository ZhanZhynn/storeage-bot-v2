export type BotPlatform = "slack" | "discord" | "lark";

export type BotKey = Readonly<{
  platform: BotPlatform;
  botId: string;
}>;

export function toBotKeyId(botKey: BotKey): string {
  return `${botKey.platform}:${botKey.botId}`;
}
