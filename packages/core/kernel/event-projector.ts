import type { RequestPhase } from "@/core/kernel/request-phase";

export type ProjectedRequestState = Readonly<{
  phase: RequestPhase;
  currentText: string;
  toolNames: string[];
}>;

export class EventProjector {
  private state: ProjectedRequestState = {
    phase: "idle",
    currentText: "",
    toolNames: [],
  };

  getState(): ProjectedRequestState {
    return this.state;
  }

  setPhase(phase: RequestPhase): void {
    this.state = {
      ...this.state,
      phase,
    };
  }

  setCurrentText(currentText: string): void {
    this.state = {
      ...this.state,
      currentText,
    };
  }
}
