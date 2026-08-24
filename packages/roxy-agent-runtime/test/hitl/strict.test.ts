import { describe, expect, it } from 'vitest'
import { StrictHitlHandler } from '../../src/hitl/handler.ts'
import type { ToolDescriptor } from '../../src/core/interfaces.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'

function tool(name: string, sensitive: boolean): ToolDescriptor {
  return {
    name,
    description: name,
    inputSchema: testToolInputSchema,
    source: 'builtin',
    annotations: sensitive
      ? { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
      : { readOnlyHint: true, openWorldHint: false },
  }
}

const req = { toolName: 'x', input: {}, reason: 'test', traceId: 't1' }

describe('StrictHitlHandler', () => {
  it('mode is strict', () => {
    expect(new StrictHitlHandler().mode).toBe('strict')
  })

  it('requires approval for all tools (sensitiveOnly defaults to false)', () => {
    const h = new StrictHitlHandler()
    expect(h.needsApproval(tool('ls', false))).toBe(true)
    expect(h.needsApproval(tool('apply_patch', true))).toBe(true)
  })

  it('sensitiveOnly=true: only sensitive tools require approval', () => {
    const h = new StrictHitlHandler(true)
    expect(h.needsApproval(tool('apply_patch', true))).toBe(true)
    expect(h.needsApproval(tool('ls', false))).toBe(false)
  })

  it('sensitiveOnly=true: read-only tool → no approval', () => {
    const h = new StrictHitlHandler(true)
    const readOnly: ToolDescriptor = {
      name: 'x',
      description: 'x',
      inputSchema: testToolInputSchema,
      source: 'builtin',
      annotations: { readOnlyHint: true, openWorldHint: false },
    }
    expect(h.needsApproval(readOnly)).toBe(false)
  })

  it('sensitiveOnly=true: unannotated tools are allowed', () => {
    const h = new StrictHitlHandler(true)
    const unspecified: ToolDescriptor = {
      name: 'mcp_unknown__tool',
      description: 'x',
      inputSchema: testToolInputSchema,
      source: 'mcp',
    }
    expect(h.needsApproval(unspecified)).toBe(false)
  })

  it('resolver returns its result', async () => {
    const h = new StrictHitlHandler(false, { resolver: () => ({ decision: 'reject', feedback: 'denied' }) })
    const r = await h.requestApproval(req)
    expect(r.decision).toBe('reject')
    expect(r.feedback).toBe('denied')
  })

  it('result queue is consumed in order', async () => {
    const h = new StrictHitlHandler(false, {
      results: [{ decision: 'approve' }, { decision: 'reject', feedback: 'no' }],
    })
    expect((await h.requestApproval(req)).decision).toBe('approve')
    expect((await h.requestApproval(req)).decision).toBe('reject')
  })

  it('auto-approves when neither resolver nor queue is provided (defensive)', async () => {
    const h = new StrictHitlHandler()
    const r = await h.requestApproval(req)
    expect(r.decision).toBe('approve')
  })
})
