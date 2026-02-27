import type { ThreadKey } from "@/core/model/thread-key";

export type SessionBootstrapResult = Readonly<{
  sessionId: string;
  cwd: string;
  created: boolean;
}>;

export interface SessionService {
  bootstrap(threadKey: ThreadKey): Promise<SessionBootstrapResult>;
}
