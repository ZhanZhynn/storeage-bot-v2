export type RequestPhase =
  | "idle"
  | "queued"
  | "bootstrapping"
  | "streaming"
  | "awaiting_input"
  | "completed"
  | "failed"
  | "cancelled";

const TERMINAL_PHASES = new Set<RequestPhase>(["completed", "failed", "cancelled"]);

export function isTerminalRequestPhase(phase: RequestPhase): boolean {
  return TERMINAL_PHASES.has(phase);
}
