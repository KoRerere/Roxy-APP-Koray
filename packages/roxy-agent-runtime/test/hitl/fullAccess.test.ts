import { describe, expect, it } from 'vitest'
import { FullAccessHandler } from '../../src/hitl/handler.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'
import type { ToolDescriptor } from '../../src/core/interfaces.ts'

describe('FullAccessHandler (contract)', () => {
  const handler = new FullAccessHandler()
  const sensitive: ToolDescriptor = {
    name: 'exec_command',
    description: 'd',
    inputSchema: testToolInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  }

  it('mode is full', () => {
    expect(handler.mode).toBe('full')
  })

  it('never requires approval, even for sensitive tools', () => {
    expect(handler.needsApproval(sensitive)).toBe(false)
    expect(handler.needsApproval()).toBe(false)
  })

  it('auto-approves if ever called (defensive, never crashes)', async () => {
    const result = await handler.requestApproval({
      toolName: 'exec_command',
      input: {},
      reason: 'n/a',
      traceId: 't1',
    })
    expect(result).toEqual({ decision: 'approve' })
  })
})
