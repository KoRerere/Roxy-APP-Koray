import { describe, expect, it } from 'vitest'
import { waitAgentTool } from '../../src/tools/builtin/wait-agent.ts'
import type { AgentPath, IAgentManager, ToolContext, WaitAgentResult } from '../../src/core/interfaces.ts'

function makeCtx(manager: IAgentManager | undefined, agentPath: AgentPath = '/root'): ToolContext {
  const signal = new AbortController().signal
  const ctx: ToolContext = { agentId: 'a1', traceId: 't1', signal, agentPath }
  if (manager) {
    ctx.agentManager = manager
  }
  return ctx
}

function managerWithWait(
  waitImpl: (callerPath: AgentPath, timeoutMs?: number, signal?: AbortSignal) => Promise<WaitAgentResult>,
): IAgentManager {
  return {
    registerRoot: () => {},
    spawn: async () => ({ path: '/root/x', name: 'x', agentType: 'x', status: 'starting' }),
    list: () => [],
    wait: waitImpl,
    cancelSubtree: () => {},
    dispose: async () => {},
  }
}

describe('wait_agent tool', () => {
  it('descriptor advertises read-only closed-world annotations', () => {
    const { descriptor } = waitAgentTool()
    expect(descriptor.name).toBe('wait_agent')
    expect(descriptor.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
  })

  it('waits for the caller subtree and returns the result', async () => {
    let captured: { callerPath: AgentPath; timeoutMs?: number; signal?: AbortSignal } | undefined
    const manager = managerWithWait(async (callerPath, timeoutMs, signal) => {
      captured = { callerPath, timeoutMs, signal }
      return { timedOut: false, agents: [], runningPaths: [] }
    })
    const ctx = makeCtx(manager, '/root')
    const { handler } = waitAgentTool()
    const r = await handler({ timeout_ms: 500 }, ctx)
    expect(r.isError).toBe(false)
    expect(captured?.callerPath).toBe('/root')
    expect(captured?.timeoutMs).toBe(500)
    expect(captured?.signal).toBe(ctx.signal)
  })

  it('omits timeout_ms when not provided', async () => {
    let captured: { timeoutMs?: number } | undefined
    const manager = managerWithWait(async (callerPath, timeoutMs) => {
      captured = { timeoutMs }
      return { timedOut: false, agents: [], runningPaths: [] }
    })
    const { handler } = waitAgentTool()
    await handler({}, makeCtx(manager))
    expect(captured?.timeoutMs).toBeUndefined()
  })

  it('invalid timeout_ms (non-positive) -> input_invalid', async () => {
    const { handler } = waitAgentTool()
    const r = await handler(
      { timeout_ms: 0 },
      makeCtx(managerWithWait(async () => ({ timedOut: false, agents: [], runningPaths: [] }))),
    )
    expect(r.isError).toBe(true)
    expect(r.errorKind).toBe('input_invalid')
  })

  it('missing agentManager -> isError', async () => {
    const { handler } = waitAgentTool()
    const r = await handler({}, makeCtx(undefined))
    expect(r.isError).toBe(true)
    expect(r.content).toMatch(/manager|tree/i)
  })
})
