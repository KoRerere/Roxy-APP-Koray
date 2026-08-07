import type { Message } from "./provider.ts";

// ---------------------------------------------------------------------------
// Observability / Trajectory
// ---------------------------------------------------------------------------

/**
 * Canonical phases of the agent lifecycle, recorded as a trajectory event.
 *
 * Sequence for a single tool turn:
 *   model_thought → tool_selected → hitl_intercept? → tool_executed → result_returned
 */
export type TrajectoryPhase =
  | "model_thought"
  | "tool_selected"
  | "hitl_intercept"
  | "clarification_requested"
  | "tool_executed"
  | "result_returned"
  | "skill_invoked"
  | "todo_updated"
  | "memory_trimmed"
  | "subagent_delegated"
  | "error";

export interface TrajectoryEvent {
  traceId: string;
  /** Epoch milliseconds (Date.now()) — injected by the recorder at emit time. */
  ts: number;
  phase: TrajectoryPhase;
  data: Record<string, unknown>;
}

export interface ITrajectoryRecorder {
  /** Begin a new trace for an input; returns the traceId. */
  start(input: Message[]): string;
  emit(event: TrajectoryEvent): void;
  end(traceId: string): void;
  /** Return the ordered events for a trace (empty if unknown). */
  getTrace(traceId: string): TrajectoryEvent[];
}
