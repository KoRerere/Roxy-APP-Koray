import { describe, expect, it } from 'vitest'
import { HitlInterceptor } from '../../src/hitl/interceptor.ts'
import { FakeHitlHandler } from '../helpers/makeFakeHandler.ts'
import type { ToolContext, ToolDescriptor } from '../../src/core/interfaces.ts'
import { z } from 'zod'

function ctx(): ToolContext {
  return { agentId: 'a', traceId: 't1', signal: new AbortController().signal }
}

describe('HitlInterceptor — diff via previewFn', () => {
  it('passes diff from previewFn to ApprovalRequest', async () => {
    const handler = new FakeHitlHandler({ mode: 'strict', results: [{ decision: 'approve' }] })
    const interceptor = new HitlInterceptor(handler)

    const tool: ToolDescriptor = {
      name: 'apply_patch',
      description: 'apply patch',
      kind: 'custom',
      inputSchema: z.string(),
      source: 'builtin',
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      previewFn: async (input) => (typeof input === 'string' ? input : undefined),
    }
    const patch = '*** Begin Patch\n*** Update File: f.ts\n@@\n-old\n+new\n*** End Patch'

    await interceptor.intercept(tool, patch, ctx())

    expect(handler.requests[0]?.diff).toBe(patch)
  })

  it('diff is undefined when previewFn is absent', async () => {
    const handler = new FakeHitlHandler({ mode: 'strict', results: [{ decision: 'approve' }] })
    const interceptor = new HitlInterceptor(handler)

    const tool: ToolDescriptor = {
      name: 'exec_command',
      description: 'exec',
      inputSchema: z.object({}).passthrough(),
      source: 'builtin',
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    }

    await interceptor.intercept(tool, { cmd: 'ls' }, ctx())
    expect(handler.requests[0]?.diff).toBeUndefined()
  })

  it('diff is undefined when previewFn throws', async () => {
    const handler = new FakeHitlHandler({ mode: 'strict', results: [{ decision: 'approve' }] })
    const interceptor = new HitlInterceptor(handler)

    const tool: ToolDescriptor = {
      name: 'apply_patch',
      description: 'apply patch',
      kind: 'custom',
      inputSchema: z.string(),
      source: 'builtin',
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      previewFn: async () => {
        throw new Error('cannot read')
      },
    }

    // Should not throw — errors from previewFn are swallowed
    const result = await interceptor.intercept(tool, {}, ctx())
    expect(result.approved).toBe(true)
    expect(handler.requests[0]?.diff).toBeUndefined()
  })

  it('diff is undefined when previewFn returns undefined', async () => {
    const handler = new FakeHitlHandler({ mode: 'strict', results: [{ decision: 'approve' }] })
    const interceptor = new HitlInterceptor(handler)

    const tool: ToolDescriptor = {
      name: 'apply_patch',
      description: 'apply patch',
      kind: 'custom',
      inputSchema: z.string(),
      source: 'builtin',
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      previewFn: async () => undefined,
    }

    await interceptor.intercept(tool, {}, ctx())
    expect(handler.requests[0]?.diff).toBeUndefined()
  })
})
