/**
 * "Yes, and don't ask again" — remember rule tests.
 *
 * When ApprovalResult carries a `remember` field, the interceptor must
 * call handler.addRule() so that subsequent calls to the same tool/command
 * bypass HITL entirely.
 */
import { describe, it, expect, vi } from 'vitest'
import { HitlInterceptor } from '../../src/hitl/interceptor.ts'
import { DelegateHitlHandler } from '../../src/hitl/handler.ts'
import type { ToolDescriptor, ToolContext } from '../../src/core/interfaces.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'

function ctx(id = 't1'): ToolContext {
  return { agentId: 'a', traceId: id, signal: new AbortController().signal }
}

const execCommandTool: ToolDescriptor = {
  name: 'exec_command',
  description: 'run a command',
  inputSchema: testToolInputSchema,
  source: 'builtin',
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
}

const patchTool: ToolDescriptor = {
  name: 'apply_patch',
  description: 'apply a patch',
  inputSchema: testToolInputSchema,
  source: 'builtin',
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
}

// ── DelegateHitlHandler.addRule ──────────────────────────────────────────────

describe('DelegateHitlHandler — addRule', () => {
  it("after addRule({ match: 'apply_patch', sensitive: false }), needsApproval returns false", () => {
    const handler = new DelegateHitlHandler([])
    expect(handler.needsApproval(patchTool)).toBe(true)
    handler.addRule({ match: 'apply_patch', sensitive: false })
    expect(handler.needsApproval(patchTool)).toBe(false)
  })

  it('addRule with glob pattern matches correctly', () => {
    const handler = new DelegateHitlHandler([])
    handler.addRule({ match: 'apply_*', sensitive: false })
    expect(handler.needsApproval(patchTool)).toBe(false)
    expect(handler.needsApproval(execCommandTool)).toBe(true) // not matched
  })

  it('onRuleAdded callback is fired when a rule is added', () => {
    const cb = vi.fn()
    const handler = new DelegateHitlHandler([], { onRuleAdded: cb })
    handler.addRule({ match: 'apply_patch', sensitive: false })
    expect(cb).toHaveBeenCalledOnce()
    expect(cb).toHaveBeenCalledWith({ match: 'apply_patch', sensitive: false }, undefined)
  })

  it('onRuleAdded receives commandPattern when provided', () => {
    const cb = vi.fn()
    const handler = new DelegateHitlHandler([], { onRuleAdded: cb })
    handler.addRule({ match: 'exec_command', sensitive: false }, 'git add *')
    expect(cb).toHaveBeenCalledWith({ match: 'exec_command', sensitive: false }, 'git add *')
  })

  it('dynamically added rule takes precedence over annotations', () => {
    const handler = new DelegateHitlHandler([])
    // destructive tool starts as needing approval
    expect(handler.needsApproval(execCommandTool)).toBe(true)
    // add a rule that marks it as not requiring approval
    handler.addRule({ match: 'exec_command', sensitive: false })
    expect(handler.needsApproval(execCommandTool)).toBe(false)
  })
})

// ── Interceptor consumes remember field ─────────────────────────────────────

describe('HitlInterceptor — remember field', () => {
  it('when result has remember, addRule is called and subsequent call is approved without asking', async () => {
    const handler = new DelegateHitlHandler([], {
      resolver: () => ({
        decision: 'approve',
        remember: { toolPattern: 'apply_patch' },
      }),
    })
    const interceptor = new HitlInterceptor(handler)

    // First call: needs approval, handler approves + remembers
    const first = await interceptor.intercept(patchTool, {}, ctx('t1'))
    expect(first.approved).toBe(true)

    // Second call: rule now in place, should skip approval entirely
    const requestApprovalSpy = vi.spyOn(handler, 'requestApproval')
    const second = await interceptor.intercept(patchTool, {}, ctx('t2'))
    expect(second.approved).toBe(true)
    expect(requestApprovalSpy).not.toHaveBeenCalled()
  })

  it('remember with commandPattern passes commandPattern to addRule', async () => {
    const addRuleSpy = vi.fn()
    const handler = new DelegateHitlHandler([], {
      resolver: () => ({
        decision: 'approve',
        remember: { toolPattern: 'exec_command', commandPattern: 'git add *' },
      }),
    })
    handler.addRule = addRuleSpy
    const interceptor = new HitlInterceptor(handler)

    await interceptor.intercept(execCommandTool, { cmd: 'git add .' }, ctx())
    expect(addRuleSpy).toHaveBeenCalledWith({ match: 'exec_command', sensitive: false }, 'git add *')
  })

  it('reject result with remember field is still a rejection (remember is ignored)', async () => {
    const handler = new DelegateHitlHandler([], {
      resolver: () => ({
        decision: 'reject',
        feedback: 'no',
        remember: { toolPattern: 'apply_patch' },
      }),
    })
    const interceptor = new HitlInterceptor(handler)
    const result = await interceptor.intercept(patchTool, {}, ctx())
    expect(result.approved).toBe(false)
    // rule should NOT have been added on reject
    expect(handler.needsApproval(patchTool)).toBe(true)
  })
})
