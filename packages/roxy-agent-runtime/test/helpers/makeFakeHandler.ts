import type {
  ApprovalRequest,
  ApprovalResult,
  HitlMode,
  IHITLHandler,
  ToolDescriptor,
} from '../../src/core/interfaces.ts'
import { toolNeedsHumanApproval } from '../../src/hitl/policy.ts'

/**
 * Scriptable HITL handler for tests. Provide a queue of approval results
 * (popped per `requestApproval` call) or a resolver function.
 *
 * `needsApproval` follows the documented matrix:
 *  - full:     false (always)
 *  - strict:   true (always) — mimics strict with sensitiveOnly=false
 *  - delegate: true iff the runtime approval policy flags the tool
 */
export class FakeHitlHandler implements IHITLHandler {
  readonly mode: HitlMode
  private readonly queue: ApprovalResult[]
  private readonly resolver?: (req: ApprovalRequest) => ApprovalResult
  readonly requests: ApprovalRequest[] = []

  constructor(
    opts: {
      mode?: HitlMode
      results?: ApprovalResult[]
      resolver?: (req: ApprovalRequest) => ApprovalResult
    } = {},
  ) {
    this.mode = opts.mode ?? 'strict'
    this.queue = [...(opts.results ?? [])]
    this.resolver = opts.resolver
  }

  needsApproval(tool?: ToolDescriptor): boolean {
    if (this.mode === 'full') {
      return false
    }
    if (this.mode === 'strict') {
      return true
    }
    return tool ? toolNeedsHumanApproval(tool) : false
  }

  requestApproval(req: ApprovalRequest): Promise<ApprovalResult> {
    this.requests.push(req)
    const result = this.resolver ? this.resolver(req) : (this.queue.shift() ?? { decision: 'approve' })
    return Promise.resolve(result)
  }
}
