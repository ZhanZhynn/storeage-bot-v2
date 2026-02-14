export type LarkActionName =
  | "get_channels"
  | "post_message"
  | "update_message"
  | "get_thread_messages"
  | "ask_user"
  | "get_user_info"
  | "add_reaction"
  | "upload_file";

export type LarkActionRequest = {
  action: LarkActionName;
  appId?: string;
  appSecret?: string;
  channelId?: string;
  threadId?: string;
  messageId?: string;
  text?: string;
  question?: string;
  options?: unknown[];
  userId?: string;
  limit?: number;
  emoji?: string;
  filePath?: string;
  filename?: string;
  initialComment?: string;
};

export type LarkApiResponse = {
  ok: boolean;
  result?: unknown;
  error?: string;
};

type LarkResponse<T> = {
  code?: number;
  msg?: string;
  data?: T;
};

function requireString(value: unknown, label: string): string {
  if (!value || typeof value !== "string") {
    throw new Error(`${label} is required`);
  }
  return value;
}

function normalizeOptionLabel(option: unknown): string {
  if (typeof option === "string") return option;
  if (option && typeof option === "object") {
    const record = option as Record<string, unknown>;
    if (typeof record.label === "string") return record.label;
    if (typeof record.text === "string") return record.text;
    if (typeof record.value === "string") return record.value;
  }
  return String(option ?? "");
}

const REACTION_ALIASES: Record<string, string> = {
  thumbup: "thumbsup",
  ok: "ok_hand",
};

const LARK_REACTIONS: Record<string, string> = {
  thumbsup: "THUMBSUP",
  eyes: "EYES",
  ok_hand: "OK_HAND",
};

function normalizeLarkReactionEmoji(emoji: string): string {
  const trimmed = emoji.trim();
  if (!trimmed) throw new Error("emoji is required");
  const stripped = trimmed.replace(/^:+|:+$/g, "").replace(/:/g, "");
  const normalized = REACTION_ALIASES[stripped] ?? stripped;
  const resolved = LARK_REACTIONS[normalized] ?? normalized;
  if (!["THUMBSUP", "EYES", "OK_HAND"].includes(resolved)) {
    throw new Error("emoji must be one of: thumbsup, eyes, ok_hand");
  }
  return resolved;
}

function getLarkCredentials(payload: LarkActionRequest): { appId: string; appSecret: string } {
  const appId = payload.appId?.trim() || process.env.LARK_APP_ID?.trim() || "";
  const appSecret = payload.appSecret?.trim() || process.env.LARK_APP_SECRET?.trim() || "";
  if (!appId || !appSecret) {
    throw new Error("Lark app credentials missing (set appId/appSecret or LARK_APP_ID/LARK_APP_SECRET)");
  }
  return { appId, appSecret };
}

async function larkRequest<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  token: string,
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`https://open.feishu.cn${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Lark API ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as LarkResponse<T>;
  if ((payload.code ?? -1) !== 0) {
    throw new Error(payload.msg || "Lark API error");
  }
  return (payload.data ?? ({} as T)) as T;
}

async function getTenantAccessToken(appId: string, appSecret: string): Promise<string> {
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  if (!response.ok) {
    throw new Error(`Lark token API ${response.status} ${response.statusText}`);
  }
  const payload = await response.json() as {
    code?: number;
    msg?: string;
    tenant_access_token?: string;
  };
  if ((payload.code ?? -1) !== 0 || !payload.tenant_access_token) {
    throw new Error(payload.msg || "Failed to get Lark tenant access token");
  }
  return payload.tenant_access_token;
}

async function postTextMessage(params: {
  token: string;
  channelId: string;
  text: string;
  threadId?: string;
}): Promise<{ messageId: string; channelId: string }> {
  const data = await larkRequest<{ message_id?: string }>(
    "POST",
    "/open-apis/im/v1/messages?receive_id_type=chat_id",
    params.token,
    {
      receive_id: params.channelId,
      msg_type: "text",
      content: JSON.stringify({ text: params.text }),
      ...(params.threadId ? { root_id: params.threadId } : {}),
    }
  );
  return {
    messageId: data.message_id ?? "",
    channelId: params.channelId,
  };
}

async function handleLarkAction(payload: LarkActionRequest): Promise<unknown> {
  const { appId, appSecret } = getLarkCredentials(payload);
  const token = await getTenantAccessToken(appId, appSecret);

  switch (payload.action) {
    case "get_channels": {
      const data = await larkRequest<{
        items?: Array<{
          chat_id?: string;
          name?: string;
          description?: string;
        }>;
      }>(
        "GET",
        "/open-apis/im/v1/chats?page_size=100",
        token
      );
      return { channels: data.items ?? [] };
    }

    case "post_message": {
      const channelId = requireString(payload.channelId, "channelId");
      const text = requireString(payload.text, "text");
      return postTextMessage({
        token,
        channelId,
        text,
        threadId: payload.threadId,
      });
    }

    case "update_message": {
      const messageId = requireString(payload.messageId, "messageId");
      const text = requireString(payload.text, "text");
      await larkRequest<Record<string, unknown>>(
        "PATCH",
        `/open-apis/im/v1/messages/${encodeURIComponent(messageId)}`,
        token,
        {
          msg_type: "text",
          content: JSON.stringify({ text }),
        }
      );
      return {
        status: "message_updated",
        messageId,
      };
    }

    case "ask_user": {
      const channelId = requireString(payload.channelId, "channelId");
      const question = requireString(payload.question, "question");
      const options = Array.isArray(payload.options)
        ? payload.options.map(normalizeOptionLabel).filter((opt) => opt.trim().length > 0)
        : [];
      if (options.length < 2 || options.length > 5) {
        throw new Error("options must have 2-5 items");
      }
      const lines = options.map((option, index) => `${index + 1}. ${option}`).join("\n");
      const text = `${question}\n\n${lines}\n\nReply with option text or number.`;
      return postTextMessage({
        token,
        channelId,
        text,
        threadId: payload.threadId,
      });
    }

    case "get_thread_messages": {
      const threadId = requireString(payload.threadId, "threadId");
      const data = await larkRequest<{ items?: unknown[] }>(
        "GET",
        `/open-apis/im/v1/messages/${encodeURIComponent(threadId)}/replies?page_size=${Math.min(Math.max(payload.limit ?? 20, 1), 50)}`,
        token
      );
      return { messages: data.items ?? [] };
    }

    case "get_user_info": {
      const userId = requireString(payload.userId, "userId").trim();
      if (userId === "@me" || userId.toLowerCase() === "me") {
        const me = await larkRequest<Record<string, unknown>>(
          "GET",
          "/open-apis/contact/v3/users/me?user_id_type=open_id",
          token
        );
        return me;
      }
      const normalized = userId.replace(/^<@/, "").replace(/>$/, "").trim();
      const user = await larkRequest<Record<string, unknown>>(
        "GET",
        `/open-apis/contact/v3/users/${encodeURIComponent(normalized)}?user_id_type=open_id`,
        token
      );
      return user;
    }

    case "add_reaction": {
      const messageId = requireString(payload.messageId, "messageId");
      const emoji = normalizeLarkReactionEmoji(requireString(payload.emoji, "emoji"));
      await larkRequest<Record<string, unknown>>(
        "POST",
        `/open-apis/im/v1/messages/${encodeURIComponent(messageId)}/reactions`,
        token,
        {
          reaction_type: {
            emoji_type: emoji,
          },
        }
      );
      return {
        status: "reaction_added",
        messageId,
      };
    }

    case "upload_file": {
      const channelId = requireString(payload.channelId, "channelId");
      const filePath = requireString(payload.filePath, "filePath");
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        throw new Error(`File not found: ${filePath}`);
      }

      const filename = payload.filename?.trim() || file.name || "upload.bin";
      const formData = new FormData();
      formData.append("file_name", filename);
      formData.append("file_type", "stream");
      formData.append("file", file, filename);

      const uploadResponse = await fetch("https://open.feishu.cn/open-apis/im/v1/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Lark file upload API ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      const uploadPayload = await uploadResponse.json() as {
        code?: number;
        msg?: string;
        data?: {
          file_key?: string;
        };
      };
      if ((uploadPayload.code ?? -1) !== 0 || !uploadPayload.data?.file_key) {
        throw new Error(uploadPayload.msg || "Failed to upload file to Lark");
      }

      const threadId = payload.threadId?.trim();
      if (payload.initialComment?.trim()) {
        await postTextMessage({
          token,
          channelId,
          text: payload.initialComment.trim(),
          threadId,
        });
      }

      const message = await larkRequest<{ message_id?: string }>(
        "POST",
        "/open-apis/im/v1/messages?receive_id_type=chat_id",
        token,
        {
          receive_id: channelId,
          msg_type: "file",
          content: JSON.stringify({ file_key: uploadPayload.data.file_key }),
          ...(threadId ? { root_id: threadId } : {}),
        }
      );

      return {
        status: "file_uploaded",
        messageId: message.message_id ?? "",
        channelId,
        fileKey: uploadPayload.data.file_key,
      };
    }

    default:
      throw new Error(`Unknown Lark action: ${payload.action}`);
  }
}

export async function handleLarkActionPayload(payload: unknown): Promise<LarkApiResponse> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid payload" };
  }

  try {
    const result = await handleLarkAction(payload as LarkActionRequest);
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
