import type { EventProjector } from "@/core/kernel/event-projector";
import { isTerminalRequestPhase, type RequestPhase } from "@/core/kernel/request-phase";
import type { SessionService } from "@/core/kernel/session-service";
import type { StatusPublisher } from "@/core/kernel/status-publisher";
import type { ThreadKey } from "@/core/model/thread-key";

type RequestRunDeps = {
  sessionService: SessionService;
  statusPublisher: StatusPublisher;
  eventProjector: EventProjector;
};

export class RequestRun {
  private phase: RequestPhase = "idle";

  constructor(
    private readonly threadKey: ThreadKey,
    private readonly deps: RequestRunDeps
  ) {}

  getPhase(): RequestPhase {
    return this.phase;
  }

  async start(message: string): Promise<void> {
    this.setPhase("bootstrapping");
    await this.deps.sessionService.bootstrap(this.threadKey);
    this.setPhase("streaming");
    this.deps.eventProjector.setCurrentText(message);
    await this.deps.statusPublisher.publishStatus(this.threadKey, message);
    this.setPhase("completed");
  }

  async cancel(): Promise<void> {
    if (isTerminalRequestPhase(this.phase)) return;
    this.setPhase("cancelled");
    await this.deps.statusPublisher.publishFinal(this.threadKey, "Stopped by user");
  }

  private setPhase(phase: RequestPhase): void {
    this.phase = phase;
    this.deps.eventProjector.setPhase(phase);
  }
}
