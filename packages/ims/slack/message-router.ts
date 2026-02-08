import { log, handleAsyncOperation, withRetry, CircuitBreaker } from "@/utils";

type RouterDeps = {
  app: any;
  isAuthorizedChannel: (channelId: string) => boolean;
  resolveWorkspaceAuth: (
    teamId?: string,
    enterpriseId?: string
  ) => { workspaceName?: string; botToken?: string; [key: string]: unknown } | undefined;
  getChannelWorkspaceName: (channelId: string) => string | undefined;
  setChannelWorkspaceName: (channelId: string, workspaceName: string) => void;
  setChannelWorkspaceAuth: (
    channelId: string,
    auth: { workspaceName?: string; botToken?: string; [key: string]: unknown } | undefined
  ) => void;
  isThreadActive: (channelId: string, threadId: string) => boolean;
  markThreadActive: (channelId: string, threadId: string) => void;
  isGitHubCommand: (text: string) => boolean;
  isSettingsCommand: (text: string) => boolean;
  postGitHubLauncher: (channelId: string, userId: string, client: any) => Promise<void>;
  postSettingsLauncher: (channelId: string, userId: string, client: any) => Promise<void>;
  describeSettingsIssues: (channelId: string) => string[];
  getChannelAgentProvider: (channelId: string) => "opencode" | "claudecode" | "codex" | "kimi" | "qwen";
  handleStopCommand: (channelId: string, threadId: string) => Promise<boolean>;
  handleIncomingMessage: (context: {
    channelId: string;
    threadId: string;
    userId: string;
    messageId: string;
    workspaceName?: string;
  }, text: string) => Promise<void>;
};

// Circuit breaker for Slack API calls
const slackApiCircuitBreaker = new CircuitBreaker(3, 30000); // 3 failures, 30 sec timeout

export function registerSlackMessageRouter(deps: RouterDeps): void {
  const slackApp = deps.app;

  slackApp.message(async ({ message, say, client }: any) => {
    try {
      if (message.subtype !== undefined) return;
      if (!("text" in message) || !message.text) return;
      if (!("user" in message)) return;

      const channelId = message.channel;
      const userId = message.user;
      const text = message.text;
      const threadId = message.thread_ts || message.ts;

      if (!deps.isAuthorizedChannel(channelId)) {
        log.info("[DROP] Unauthorized channel", { channelId });
        return;
      }

      // Add retry and error handling for Slack API calls
      const authResult = await handleAsyncOperation(
        () => withRetry(() => client.auth.test(), 2),
        "Slack auth.test",
        {
          retries: 2,
          circuitBreaker: slackApiCircuitBreaker,
          fallback: () => Promise.resolve({ user_id: null, team_id: null })
        }
      );

      if (!authResult) {
        log.error("Failed to authenticate with Slack after retries", { channelId });
        return;
      }

      const currentBotUserId = authResult.user_id as string;
      if (authResult.team_id) {
        const auth = deps.resolveWorkspaceAuth(authResult.team_id, authResult.enterprise_id ?? undefined);
        if (auth?.workspaceName && !deps.getChannelWorkspaceName(channelId)) {
          deps.setChannelWorkspaceName(channelId, auth.workspaceName);
        }
        deps.setChannelWorkspaceAuth(channelId, auth);
      }

      if (userId === currentBotUserId) {
        log.debug("[DROP] Message from bot user", { channelId, userId });
        return;
      }

      if (/\bstop\b/i.test(text)) {
        const stopped = await handleAsyncOperation(
          () => deps.handleStopCommand(channelId, threadId),
          "Handle stop command",
          {
            onError: (error) => log.error("Error handling stop command", { error: error.message, channelId, threadId })
          }
        );
        
        if (stopped) {
          await handleAsyncOperation(
            () => say({ text: "Request stopped.", thread_ts: threadId }),
            "Send stop confirmation",
            {
              circuitBreaker: slackApiCircuitBreaker,
              onError: (error) => log.error("Failed to send stop confirmation", { error: error.message })
            }
          );
          return;
        }
      }

      const isMention = currentBotUserId ? text.includes(`<@${currentBotUserId}>`) : false;
      const threadActive = deps.isThreadActive(channelId, threadId);

      if (!isMention && !threadActive) {
        log.info("[DROP] Not mentioned and thread inactive", { channelId, threadId });
        return;
      }

      const mentionsOthers = /<@U[A-Z0-9]+>/g.test(text) && !isMention;
      if (mentionsOthers) {
        log.info("[DROP] Mentions other user", { channelId, threadId });
        return;
      }

      deps.markThreadActive(channelId, threadId);

      const cleanText = currentBotUserId
        ? text.replace(new RegExp(`<@${currentBotUserId}>`, "g"), "").trim()
        : text.trim();

      if (deps.isGitHubCommand(cleanText)) {
        if (isMention) {
          await handleAsyncOperation(
            () => deps.postGitHubLauncher(channelId, userId, client),
            "Post GitHub launcher",
            {
              circuitBreaker: slackApiCircuitBreaker,
              onError: (error) => log.error("Failed to post GitHub launcher", { error: error.message, channelId, userId })
            }
          );
        }
        return;
      }

      if (deps.isSettingsCommand(cleanText)) {
        if (isMention) {
          await handleAsyncOperation(
            () => deps.postSettingsLauncher(channelId, userId, client),
            "Post settings launcher",
            {
              circuitBreaker: slackApiCircuitBreaker,
              onError: (error) => log.error("Failed to post settings launcher", { error: error.message, channelId, userId })
            }
          );
        }
        return;
      }

      const settingsIssues = deps.describeSettingsIssues(channelId);
      if (settingsIssues.length > 0) {
        await handleAsyncOperation(
          () => say({
            text: `Channel settings need attention:\n- ${settingsIssues.join("\n- ")}`,
            thread_ts: threadId,
          }),
          "Send settings issues notification",
          {
            circuitBreaker: slackApiCircuitBreaker,
            onError: (error) => log.error("Failed to send settings issues notification", { error: error.message })
          }
        );
        
        await handleAsyncOperation(
          () => deps.postSettingsLauncher(channelId, userId, client),
          "Post settings launcher after issues detected",
          {
            circuitBreaker: slackApiCircuitBreaker,
            onError: (error) => log.error("Failed to post settings launcher after issues", { error: error.message, channelId, userId })
          }
        );
        return;
      }

      const workspaceName = deps.getChannelWorkspaceName(channelId) || "unknown";
      if (!cleanText) {
        await handleAsyncOperation(
          () => say({
            text: "Hi! How can I help you? Just ask me anything.",
            thread_ts: threadId,
          }),
          "Send welcome message",
          {
            circuitBreaker: slackApiCircuitBreaker,
            onError: (error) => log.error("Failed to send welcome message", { error: error.message })
          }
        );
        return;
      }

      await handleAsyncOperation(
        () => deps.handleIncomingMessage(
          {
            channelId,
            threadId,
            userId,
            messageId: message.ts,
            workspaceName,
          },
          cleanText
        ),
        "Handle incoming message",
        {
          onError: (error) => log.error("Error processing incoming message", { 
            error: error.message, 
            channelId, 
            threadId, 
            userId 
          })
        }
      );
    } catch (error) {
      log.error("Unexpected error in message handler", { error: error.message });
      // Don't send error back to Slack to avoid spamming users
    }
  });
}
