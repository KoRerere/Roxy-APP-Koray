import type {
  ClarificationRequest,
  ClarificationResult,
  IClarificationHandler,
  PendingClarification,
} from '../core/interfaces.ts'

/**
 * Auto-responds to every clarification with an empty answer. Use in:
 * - Fully automated pipelines that must never park for human input.
 * - Tests that want to exercise the clarification code path without blocking.
 *
 * The model receives `answer: ""` and is expected to handle it gracefully
 * (pick a sensible default, log that no input arrived, or abort the sub-task).
 * Pair with a system prompt instruction like "if the user provides no answer,
 * choose the safest default and continue" when using this handler in prod.
 */
export class NullClarificationHandler implements IClarificationHandler {
  async request(_req: ClarificationRequest): Promise<ClarificationResult> {
    return { answer: '' }
  }
}

/**
 * The REAL interactive channel: `request()` parks on a Promise and publishes a
 * {@link PendingClarification} through {@link onPending}. The runtime
 * (AgentImpl) wires `onPending` so the pending is (a) registered for
 * `Agent.clarify(traceId, …)` and (b) surfaced as a `clarification_pending`
 * stream event for the UI to render.
 *
 * Resolution paths — first one wins, the rest are no-ops:
 *  - `pending.resume(result)` (stream consumer / UI),
 *  - `Agent.clarify(traceId, result)` (out-of-band caller),
 *  - timeout (`request.timeoutMs`, else the constructor default) → `answer: ""`.
 *
 * Fail-safe: with no `onPending` listener wired, nothing could ever resolve
 * the promise — so it resolves immediately with `answer: ""` (Null behavior)
 * instead of hanging the loop.
 */
export class SuspendingClarificationHandler implements IClarificationHandler {
  /** Wired by AgentImpl at construction; UIs may chain onto it. */
  onPending?: (pending: PendingClarification) => void
  private readonly defaultTimeoutMs?: number

  constructor(opts: { timeoutMs?: number } = {}) {
    this.defaultTimeoutMs = opts.timeoutMs
  }

  request(req: ClarificationRequest): Promise<ClarificationResult> {
    if (!this.onPending) {
      return Promise.resolve({ answer: '' })
    }
    return new Promise((resolve) => {
      let settled = false
      let timer: NodeJS.Timeout | undefined
      const finish = (result: ClarificationResult): void => {
        if (settled) {
          return
        }
        settled = true
        if (timer) {
          clearTimeout(timer)
        }
        resolve(result)
      }
      const timeoutMs = req.timeoutMs ?? this.defaultTimeoutMs
      if (timeoutMs !== undefined && timeoutMs > 0) {
        timer = setTimeout(() => finish({ answer: '' }), timeoutMs)
      }
      this.onPending!({ traceId: req.traceId, request: req, resume: finish })
    })
  }
}

/**
 * Resolves clarifications from a pre-scripted queue — pops answers in FIFO
 * order per `request()` call. Use in unit tests that want to assert the exact
 * question the model asked and supply a deterministic answer without any
 * async I/O. Throws if the queue is exhausted.
 */
export class ScriptedClarificationHandler implements IClarificationHandler {
  private readonly queue: string[]
  readonly calls: ClarificationRequest[] = []

  constructor(answers: string[]) {
    this.queue = [...answers]
  }

  async request(req: ClarificationRequest): Promise<ClarificationResult> {
    this.calls.push(req)
    const answer = this.queue.shift()
    if (answer === undefined) {
      throw new Error(
        `ScriptedClarificationHandler: no scripted answer for call #${this.calls.length} ("${req.question}")`,
      )
    }
    return { answer }
  }
}
