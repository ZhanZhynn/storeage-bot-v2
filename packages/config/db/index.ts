import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isLocalMode } from "../runtime";
import { log } from "@/utils";

type ProfileRecord = {
  id: string;
  opencode_server_url: string | null;
  slack_user_id: string | null;
};

type SlackBotTokenRecord = {
  bot_token: string | null;
  workspace_name: string | null;
};

type SlackAppTokenRecord = {
  slack_app_token: string | null;
};

export type WorkspaceToken = {
  botToken: string;
  workspaceName: string | null;
};

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase config missing in ~/.config/ode/ode.json");
  }
  client = createClient(url, key);
  return client;
}

export async function getAllBotTokens(): Promise<WorkspaceToken[]> {
  if (isLocalMode()) return [];
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_slack_info")
    .select("bot_token, workspace_name")
    .not("bot_token", "is", null);

  if (error) {
    throw new Error(`Supabase bot token lookup failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    log.debug("No bot tokens found in database");
    return [];
  }

  const tokenMap = new Map<string, string | null>();
  for (const record of data as SlackBotTokenRecord[]) {
    if (record.bot_token && !tokenMap.has(record.bot_token)) {
      tokenMap.set(record.bot_token, record.workspace_name);
    }
  }

  return Array.from(tokenMap.entries()).map(([botToken, workspaceName]) => ({
    botToken,
    workspaceName,
  }));
}

export async function getProfileBySlackUserId(slackUserId: string): Promise<ProfileRecord | null> {
  if (isLocalMode()) return null;
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_slack_info")
    .select("id, opencode_server_url, slack_user_id")
    .eq("slack_user_id", slackUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase profile lookup failed: ${error.message}`);
  }

  return data ?? null;
}

export async function getSlackAppTokenFromServer(): Promise<string> {
  if (isLocalMode()) {
    throw new Error("Slack app token is not available in local mode");
  }
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("slack_app_token")
    .not("slack_app_token", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase slack app token lookup failed: ${error.message}`);
  }

  const token = (data as SlackAppTokenRecord | null)?.slack_app_token?.trim();
  if (!token) {
    throw new Error("Slack app token missing in server config");
  }

  return token;
}
