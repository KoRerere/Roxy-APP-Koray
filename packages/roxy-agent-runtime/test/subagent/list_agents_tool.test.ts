import { describe, expect, it } from 'vitest'
import { listAgentsTool } from '../../src/tools/builtin/list-agents.ts'
import type { AgentNodeSnapshot, AgentPath, IAgentManager, ToolContext } from '../../src/core/interfaces.ts'

function makeCtx(manager: IAgentManager | undefined): ToolContext {
  const ctx: ToolContext = { agentId: 'a1', traceId: 't1', signal: new AbortController().signal, agentPath: '/root' }
  if (manager) {
    ctx.agentManager = manager
  }
  return ctx
}

function managerWithList(listImpl: (prefix?: AgentPath) => AgentNodeSnapshot[]): IAgentManager {
  return {
    registerRoot: () => {},
    spawn: async () => ({ path: '/root/x', name: 'x', agentType: 'x', status: 'starting' }),
    list: listImpl,
    wait: async () => ({ timedOut: false, agents: [], runningPaths: [] }),
    cancelSubtree: () => {},
    dispose: async () => {},
  }
}

describe('list_agents tool', () => {
  it('descriptor advertises read-only closed-world annotations', () => {
    const { descriptor } = listAgentsTool()
    expect(descriptor.name).toBe('list_agents')
    expect(descriptor.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
  })

  it('returns the snapshot list as JSON', async () => {
    const nodes: AgentNodeSnapshot[] = [
      { path: '/root', name: 'root', agentType: 'root', status: 'running', startedAt: 1 },
      {
        path: '/root/foo',
        parentPath: '/root',
        name: 'foo',
        agentType: 'browser_worker',
        status: 'completed',
        startedAt: 2,
        finishedAt: 3,
        report: 'ok',
      },
    ]
    const manager = managerWithList(() => nodes)
    const { handler } = listAgentsTool()
    const r = await handler({}, makeCtx(manager))
    expect(r.isError).toBe(false)
    expect(r.content).toContain('/root/foo')
    expect(r.content).toContain('completed')
    expect(r.content).toContain('"report"')
  })

  it('defaults path_prefix to /root when omitted', async () => {
    let captured: AgentPath | undefined
    const manager = managerWithList((prefix) => {
      captured = prefix
      return []
    })
    const { handler } = listAgentsTool()
    await handler({}, makeCtx(manager))
    expect(captured).toBe('/root')
  })

  it('forwards an explicit path_prefix', async () => {
    let captured: AgentPath | undefined
    const manager = managerWithList((prefix) => {
      captured = prefix
      return []
    })
    const { handler } = listAgentsTool()
    await handler({ path_prefix: '/root/foo' }, makeCtx(manager))
    expect(captured).toBe('/root/foo')
  })

  it('invalid path_prefix -> input_invalid', async () => {
    const { handler } = listAgentsTool()
    const r = await handler({ path_prefix: 'not-a-path' }, makeCtx(managerWithList(() => [])))
    expect(r.isError).toBe(true)
    expect(r.errorKind).toBe('input_invalid')
  })

  it('missing agentManager -> isError', async () => {
    const { handler } = listAgentsTool()
    const r = await handler({}, makeCtx(undefined))
    expect(r.isError).toBe(true)
    expect(r.content).toMatch(/manager|tree/i)
  })
})
