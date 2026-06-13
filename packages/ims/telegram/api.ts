import { basename } from "node:path";

function requireString(value: unknown, label: string): string {
  if (!value || typeof value !== "string") {
    throw new Error(`${label} is required`);
  }
  return value;
}

const TELEGRAM_API_BASE = "https://api.telegram.org";

const REACTION_ALIASES: Record<string, string> = {
  thumbup: "thumbsup",
  ok: "ok_hand",
};

const TELEGRAM_REACTIONS: Record<string, string> = {
  thumbsup: "\u{1F44D}",
  eyes: "\u{1F440}",
  ok_hand: "\u{1F44C}",
};

function normalizeTelegramEmoji(emoji: string): string {
  const trimmed = emoji.trim();
  if (!trimmed) throw new Error("emoji is required");
  const stripped = trimmed.replace(/^:+|:+$/g, "").replace(/:/g, "");
  const normalized = REACTION_ALIASES[stripped] ?? stripped;
  const resolved = TELEGRAM_REACTIONS[normalized] ?? normalized;
  if (!["\u{1F44D}", "\u{1F440}", "\u{1F44C}"].includes(resolved)) {
    throw new Error("emoji must be one of: thumbsup, eyes, ok_hand");
  }
  return resolved;
}

async function telegramApiCall<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as {
    ok: boolean;
    description?: string;
    result?: T;
    error_code?: number;
  };
  if (!data.ok) {
    throw new Error(
      `Telegram API error: ${data.description ?? "unknown"} (code=${data.error_code ?? "?"})`,
    );
  }
  return data.result as T;
}

async function telegramMultipartCall<T>(
  token: string,
  method: string,
  formData: FormData,
): Promise<T> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as {
    ok: boolean;
    description?: string;
    result?: T;
    error_code?: number;
  };
  if (!data.ok) {
    throw new Error(
      `Telegram API error: ${data.description ?? "unknown"} (code=${data.error_code ?? "?"})`,
    );
  }
  return data.result as T;
}

function slackMrkdwnToHtml(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/<(https?:\/\/[^\|>]+)\|([^>]+)>/g, '<a href="$1">$2</a>')
    .replace(/<(https?:\/\/[^>]+)>/g, '<a href="$1">$1</a>')
    .replace(/```([^`]+)```/g, "<pre>$1</pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*([^*]+)\*/g, "<b>$1</b>")
    .replace(/_([^_]+)_/g, "<i>$1</i>")
    .replace(/~([^~]+)~/g, "<s>$1</s>");
  return html;
}

export async function sendTelegramMessage(args: {
  botToken: string;
  chatId: string;
  text: string;
  parseMode?: "HTML" | "MarkdownV2" | "Markdown";
  replyToMessageId?: number;
  messageThreadId?: number;
}): Promise<{ messageId: number; chatId: string }> {
  const token = args.botToken.trim();
  if (!token) throw new Error("Telegram bot token missing");
  const chatId = requireString(args.chatId, "chatId");
  const text = requireString(args.text, "text");

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: args.parseMode === "HTML" ? slackMrkdwnToHtml(text) : text,
  };
  if (args.parseMode) body.parse_mode = args.parseMode;
  if (args.replyToMessageId !== undefined) body.reply_to_message_id = args.replyToMessageId;
  if (args.messageThreadId !== undefined) body.message_thread_id = args.messageThreadId;

  const result = await telegramApiCall<{ message_id: number; chat: { id: number | string } }>(
    token,
    "sendMessage",
    body,
  );
  return { messageId: result.message_id, chatId: String(result.chat.id) };
}

export async function uploadTelegramFile(args: {
  botToken: string;
  chatId: string;
  filePath: string;
  filename?: string;
  caption?: string;
  replyToMessageId?: number;
  messageThreadId?: number;
}): Promise<{
  status: "file_uploaded";
  messageId: number;
  chatId: string;
  filename: string;
}> {
  const token = args.botToken.trim();
  if (!token) throw new Error("Telegram bot token missing");
  const chatId = requireString(args.chatId, "chatId");
  const filePath = requireString(args.filePath, "filePath");
  const filename = args.filename?.trim() || basename(filePath);

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${filePath}`);
  }

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("document", file, filename);
  if (args.caption?.trim()) formData.append("caption", args.caption.trim());
  if (args.replyToMessageId !== undefined)
    formData.append("reply_to_message_id", String(args.replyToMessageId));
  if (args.messageThreadId !== undefined)
    formData.append("message_thread_id", String(args.messageThreadId));

  const result = await telegramMultipartCall<{
    message_id: number;
    chat: { id: number | string };
  }>(token, "sendDocument", formData);

  return {
    status: "file_uploaded",
    messageId: result.message_id,
    chatId: String(result.chat.id),
    filename,
  };
}

export async function getTelegramThreadMessages(args: {
  botToken: string;
  chatId: string;
  limit?: number;
}): Promise<{
  messages: Array<{
    id: number;
    text: string;
    from?: { username?: string; firstName?: string };
  }>;
}> {
  const token = args.botToken.trim();
  if (!token) throw new Error("Telegram bot token missing");
  const chatId = requireString(args.chatId, "chatId");
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

  const updates = await telegramApiCall<
    Array<{
      update_id: number;
      message?: {
        message_id: number;
        text?: string;
        chat: { id: number | string };
        from?: { username?: string; first_name?: string };
      };
    }>
  >(token, "getUpdates", { limit, allowed_updates: ["message"] });

  const chatMessages = updates
    .filter((u) => u.message && String(u.message.chat.id) === chatId)
    .slice(-limit)
    .map((u) => ({
      id: u.message!.message_id,
      text: u.message!.text ?? "",
      from: u.message!.from
        ? {
            username: u.message!.from.username,
            firstName: u.message!.from.first_name,
          }
        : undefined,
    }));

  return { messages: chatMessages };
}

export async function addTelegramReaction(args: {
  botToken: string;
  chatId: string;
  messageId: string | number;
  emoji: string;
}): Promise<{ status: "reaction_added" }> {
  const token = args.botToken.trim();
  if (!token) throw new Error("Telegram bot token missing");
  const chatId = requireString(args.chatId, "chatId");
  const emoji = normalizeTelegramEmoji(requireString(args.emoji, "emoji"));
  const messageIdNum =
    typeof args.messageId === "number" ? args.messageId : parseInt(args.messageId, 10);
  if (isNaN(messageIdNum)) throw new Error("messageId must be a valid number");

  await telegramApiCall<unknown>(token, "setMessageReaction", {
    chat_id: chatId,
    message_id: messageIdNum,
    reaction: [{ type: "emoji", emoji }],
  });

  return { status: "reaction_added" };
}
