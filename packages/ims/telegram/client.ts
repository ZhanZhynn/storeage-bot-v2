import { getWorkspaces } from "@/config";
import { sendTelegramMessage } from "./api";
import { createHash } from "node:crypto";

export function buildTelegramBotId(credential: string): string {
  const normalized = credential.trim();
  if (!normalized) return "default";
  return createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

export function getTelegramBotToken(channelId: string): string | undefined {
  const trimmed = channelId.trim();
  if (!trimmed) return undefined;
  for (const workspace of getWorkspaces()) {
    if (workspace.type !== "telegram") continue;
    const token = workspace.telegramBotToken?.trim();
    if (!token) continue;
    if (workspace.channelDetails?.some((ch) => ch.id === trimmed)) {
      return token;
    }
  }
  return undefined;
}

export function getTelegramBotTokens(): Array<{ workspaceId: string; token: string }> {
  const result: Array<{ workspaceId: string; token: string }> = [];
  for (const workspace of getWorkspaces()) {
    if (workspace.type !== "telegram") continue;
    const token = workspace.telegramBotToken?.trim();
    if (!token) continue;
    result.push({ workspaceId: workspace.id, token });
  }
  return result;
}

export async function sendChannelMessage(
  channelId: string,
  text: string,
): Promise<string | undefined> {
  const token = getTelegramBotToken(channelId);
  if (!token) {
    throw new Error(`No Telegram bot token configured for channel ${channelId}`);
  }
  const result = await sendTelegramMessage({
    botToken: token,
    chatId: channelId,
    text,
  });
  return result?.messageId?.toString();
}

export async function recoverPendingRequests(): Promise<void> {
}
