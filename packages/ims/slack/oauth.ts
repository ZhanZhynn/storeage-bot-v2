import { stopCodexOAuthServer } from "@/agents/opencode/codex-auth";

export function stopOAuthServer(): void {
  stopCodexOAuthServer();
}
