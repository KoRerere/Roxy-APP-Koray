import { describe, expect, it, vi } from 'vitest'
import type { ApprovalRequest, ApprovalResult, IHITLHandler, ToolDescriptor } from '../../src/core/interfaces.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'
import { FakeHitlHandler } from '../helpers/makeFakeHandler.ts'

/**
 * CONTRACT tests for the HITL approval matrix.
 *
 * `needsApproval` truth table the production handlers MUST implement:
 *
 *   mode \ tool            | annotations-gated | read-only closed-world |
 *   -----------------------+-------------------+-----------------------|
 *   strict                 |  true             |  true*                |  (*false if sensitiveOnly)
 *   strict (sensitiveOnly) |  true             |  false                |
 *   delegate               |  true             |  false                |
 *   full                   |  false            |  false                |
 *
 * On reject, ApprovalResult.feedback is non-empty and feeds back as tool_result.
 */

const readTool: ToolDescriptor = {
  name: 'ls',
  description: 'list',
  inputSchema: testToolInputSchema,
  source: 'builtin',
  annotations: { readOnlyHint: true, openWorldHint: false },
}
const writeTool: ToolDescriptor = {
  name: 'apply_patch',
  description: 'apply patch',
  inputSchema: testToolInputSchema,
  source: 'builtin',
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
}

describe('FakeHitlHandler (approval matrix contract)', () => {
  it('full mode approves nothing', () => {
    const h = new FakeHitlHandler({ mode: 'full' })
    expect(h.needsApproval(writeTool)).toBe(false)
    expect(h.needsApproval(readTool)).toBe(false)
  })

  it('strict mode approves everything', () => {
    const h = new FakeHitlHandler({ mode: 'strict' })
    expect(h.needsApproval(writeTool)).toBe(true)
    expect(h.needsApproval(readTool)).toBe(true)
  })

  it('delegate mode approves only annotations-gated tools (mimic via resolver)', () => {
    const h: IHITLHandler = {
      mode: 'delegate',
      needsApproval: (t: ToolDescriptor) =>
        t.annotations?.destructiveHint === true || t.annotations?.openWorldHint === true,
      requestApproval: () => Promise.resolve<ApprovalResult>({ decision: 'approve' }),
    }
    expect(h.needsApproval(writeTool)).toBe(true)
    expect(h.needsApproval(readTool)).toBe(false)
  })

  it('reject result carries feedback that must be fed back to the model', async () => {
    const h = new FakeHitlHandler({
      mode: 'strict',
      results: [{ decision: 'reject', feedback: 'use read_file instead' }],
    })
    const result = await h.requestApproval({
      toolName: 'apply_patch',
      input: {},
      reason: 'Tool "apply_patch" requires approval',
      traceId: 't1',
    })
    expect(result.decision).toBe('reject')
    expect(result.feedback).toBe('use read_file instead')
    expect(h.requests).toHaveLength(1)
  })

  it('approve result has no required feedback', async () => {
    const h = new FakeHitlHandler({
      mode: 'strict',
      results: [{ decision: 'approve' }],
    })
    const result = await h.requestApproval({
      toolName: 'ls',
      input: {},
      reason: 'strict',
      traceId: 't2',
    })
    expect(result.decision).toBe('approve')
    expect(result.feedback).toBeUndefined()
  })

  it('resolver computes the result from the request', async () => {
    const resolver = vi.fn(
      (req: ApprovalRequest): ApprovalResult =>
        req.toolName === 'exec_command' ? { decision: 'reject', feedback: 'no shell' } : { decision: 'approve' },
    )
    const h = new FakeHitlHandler({ mode: 'delegate', resolver })
    const r = await h.requestApproval({
      toolName: 'exec_command',
      input: {},
      reason: 'x',
      traceId: 't3',
    })
    expect(r.decision).toBe('reject')
    expect(resolver).toHaveBeenCalledTimes(1)
  })
})
