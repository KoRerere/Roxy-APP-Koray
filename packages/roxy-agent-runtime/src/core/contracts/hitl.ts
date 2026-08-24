import type { ToolDescriptor } from './tools.ts'

// ---------------------------------------------------------------------------
// Human-in-the-loop
// ---------------------------------------------------------------------------

export type HitlMode = 'strict' | 'delegate' | 'full'

export interface ApprovalRequest {
  toolName: string
  input: unknown
  reason: string
  traceId: string
  /** Unified diff string computed by the tool's {@link ToolDescriptor.previewFn}. */
  diff?: string
}

export interface ApprovalResult {
  decision: 'approve' | 'reject'
  /** Optional human feedback; on reject this is fed back to the model. */
  feedback?: string
  /**
   * When set on an "approve" result, the handler should permanently add a
   * rule so future calls matching the same pattern skip approval entirely.
   * Ignored on "reject".
   */
  remember?: {
    /** Glob matched against tool name, e.g. `"exec_command"`, `"write_*"`. */
    toolPattern: string
    /** For the `exec_command` tool: glob matched against the command string, e.g. `"git add *"`. */
    commandPattern?: string
  }
}

export interface IHITLHandler {
  readonly mode: HitlMode
  /**
   * Whether a given tool invocation requires approval.
   *  - strict:  true for every tool (unless `sensitiveOnly` was set, then
   *             true only when the standard annotations policy flags it).
   *  - delegate: true iff the standard annotations policy or a matching rule
   *             flags it (see {@link HitlRule}). Read-only tools are exempt.
   *  - full:    always false (never approves).
   */
  needsApproval(tool: ToolDescriptor, input?: unknown): boolean
  /**
   * Request approval. In v1 (sync path) this resolves on the same tick from a
   * queue/resolver supplied at construction. The async checkpointed
   * suspend/resume path is designed but not the default. MUST never be called
   * when `needsApproval` returns false — the interceptor guarantees this.
   */
  requestApproval(req: ApprovalRequest): Promise<ApprovalResult>
  /**
   * Dynamically add a rule at runtime (e.g. after a "yes, don't ask again"
   * approval). Optional — only `DelegateHitlHandler` implements it.
   * `commandPattern` is only meaningful for the `exec_command` tool.
   */
  addRule?(rule: HitlRule, commandPattern?: string): void
}

/** A tool-name glob used by delegate-mode HITL policy. */
export interface HitlRule {
  match: string
  sensitive: boolean
}

/** A pending approval awaiting external resolution. */
export interface PendingApproval {
  traceId: string
  request: ApprovalRequest
  resume: (result: ApprovalResult) => void
}
