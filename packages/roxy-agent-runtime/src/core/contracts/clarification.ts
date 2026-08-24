// ---------------------------------------------------------------------------
// Clarification (model-initiated user input)
// ---------------------------------------------------------------------------

/**
 * A discrete option for a model-initiated clarification question.
 */
export interface ClarificationOption {
  label: string
  description: string
}

/**
 * One model-initiated clarification question.
 */
export interface ClarificationQuestion {
  header: string
  id: string
  question: string
  options: ClarificationOption[]
}

/**
 * Structured request the model makes when it needs user input mid-loop.
 * Emitted as a `clarification_pending` stream event; the outer caller (CLI,
 * UI, automated test) resolves it via {@link Agent.clarify}.
 *
 * Contrast with {@link ApprovalRequest} (HITL): HITL is runtime-triggered
 * ("should I allow this sensitive action?"). Clarification is model-triggered
 * ("I need more information to continue"). Both use the same suspend/resume
 * skeleton but are intentionally separate — their UX, transport, and
 * semantics differ.
 */
export interface ClarificationRequest {
  traceId: string
  /**
   * The complete `ask_user` question set. The tool input itself is exactly
   * `{ questions }`; each question has a stable id for its submitted answer.
   */
  questions?: ClarificationQuestion[]
  /**
   * Legacy generic clarification fields. They remain for non-tool callers
   * such as plugin authorization, whose free-form requests do not use the
   * `ask_user` structured question contract.
   */
  question?: string
  /**
   * When present: UI should present a selection list; the user must pick one
   * label. Keep each option under 80 characters for terminal compatibility.
   * When absent: UI should present a free-text input field.
   */
  options?: string[]
  /**
   * Milliseconds before the pending clarification auto-resolves with
   * `answer: ""`. When absent the loop parks indefinitely until `clarify()`
   * is called. Callers relying on this assume the model handles `answer: ""`
   * gracefully (e.g. picks a default or aborts the sub-task).
   */
  timeoutMs?: number
}

export interface ClarificationResult {
  /**
   * The user response. `ask_user` returns a JSON object keyed by question id;
   * legacy free-form clarification callers may return plain text.
   */
  answer: string
}

/** A pending clarification awaiting external resolution. */
export interface PendingClarification {
  traceId: string
  request: ClarificationRequest
  /** Call this to unpark the loop with the user's answer. */
  resume: (result: ClarificationResult) => void
}

/**
 * Transport adapter for clarification requests. Implement this to bridge the
 * runtime to any UI: terminal readline, WebSocket push, HTTP long-poll, etc.
 *
 * The framework ships a `NullClarificationHandler` (auto-responds `answer: ""`)
 * for automated pipelines and tests. Real terminal / HTTP handlers are
 * application-layer concerns, not framework concerns.
 *
 * The handler MUST resolve (never reject). On timeout or error, resolve with
 * `{ answer: "" }` so the model can decide what to do with an empty reply.
 */
export interface IClarificationHandler {
  /**
   * Present the clarification request to the user and return their response.
   * Called exactly once per `ask_user` tool invocation; the runtime awaits
   * the resolved value and feeds it back as the `tool_result` content.
   */
  request(req: ClarificationRequest): Promise<ClarificationResult>
}
