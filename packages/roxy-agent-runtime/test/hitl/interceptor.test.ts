import { describe, expect, it, vi } from 'vitest'
import { HitlInterceptor } from '../../src/hitl/interceptor.ts'
import { FakeHitlHandler } from '../helpers/makeFakeHandler.ts'
import type { ToolContext, ToolDescriptor } from '../../src/core/interfaces.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'

function tool(name: string, sensitive = false): ToolDescriptor {
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

function ctx(): ToolContext {
  return { agentId: 'a', traceId: 't1', signal: new AbortController().signal }
}

describe('HitlInterceptor', () => {
  it('needsApproval=false → returns { approved: true } without calling requestApproval', async () => {
    const handler = new FakeHitlHandler({ mode: 'full' })
    const spy = vi.spyOn(handler, 'requestApproval')
    const interceptor = new HitlInterceptor(handler)
    const result = await interceptor.intercept(tool('ls', false), {}, ctx())
    expect(result.approved).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('needsApproval=true + approve → returns { approved: true }', async () => {
    const handler = new FakeHitlHandler({ mode: 'strict', results: [{ decision: 'approve' }] })
    const interceptor = new HitlInterceptor(handler)
    const result = await interceptor.intercept(tool('apply_patch', true), {}, ctx())
    expect(result.approved).toBe(true)
  })

  it('needsApproval=true + reject → returns { approved: false, result with feedback }', async () => {
    const handler = new FakeHitlHandler({
      mode: 'strict',
      results: [{ decision: 'reject', feedback: 'use read-only tools' }],
    })
    const interceptor = new HitlInterceptor(handler)
    const result = await interceptor.intercept(tool('apply_patch', true), {}, ctx())
    expect(result.approved).toBe(false)
    if (!result.approved) {
      expect(result.result.isError).toBe(true)
      expect(result.result.content).toContain('use read-only tools')
    }
  })

  it('reject with no feedback → sensible default rejection message', async () => {
    const handler = new FakeHitlHandler({ mode: 'strict', results: [{ decision: 'reject' }] })
    const interceptor = new HitlInterceptor(handler)
    const result = await interceptor.intercept(tool('exec_command'), {}, ctx())
    expect(result.approved).toBe(false)
    if (!result.approved) {
      expect(result.result.content.length).toBeGreaterThan(0)
    }
  })

  it('requestApproval is called with correct toolName and traceId', async () => {
    const handler = new FakeHitlHandler({ mode: 'strict', results: [{ decision: 'approve' }] })
    const interceptor = new HitlInterceptor(handler)
    await interceptor.intercept(tool('exec_command', true), { cmd: 'ls' }, ctx())
    expect(handler.requests[0]?.toolName).toBe('exec_command')
    expect(handler.requests[0]?.traceId).toBe('t1')
  })
})
