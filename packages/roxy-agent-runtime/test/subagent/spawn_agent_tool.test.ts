import { describe, expect, it } from 'vitest'
import { spawnAgentTool } from '../../src/tools/builtin/spawn-agent.ts'
import { AgentManagerError } from '../../src/subagent/agent-manager.ts'
import type {
  AgentPath,
  IAgentManager,
  SpawnAgentReceipt,
  SpawnAgentRequest,
  SubAgentSpec,
  ToolContext,
} from '../../src/core/interfaces.ts'

const specs: SubAgentSpec[] = [
  { agentType: 'browser_worker', description: 'operates a browser profile', systemPrompt: '' },
]

function mockManager(spawnImpl?: (req: SpawnAgentRequest) => Promise<SpawnAgentReceipt>): IAgentManager {
  return {
    registerRoot: () => {},
    spawn:
      spawnImpl ??
      (async (req) => ({
        path: `${req.parentPath}/${req.name}`,
        name: req.name,
        agentType: req.agentType,
        status: 'starting',
      })),
    list: () => [],
    wait: async () => ({ timedOut: false, agents: [], runningPaths: [] }),
    cancelSubtree: () => {},
    dispose: async () => {},
  }
}

function makeCtx(manager: IAgentManager | undefined, agentPath: AgentPath = '/root'): ToolContext {
  const signal = new AbortController().signal
  const ctx: ToolContext = { agentId: 'a1', traceId: 't1', signal, agentPath }
  if (manager) {
    ctx.agentManager = manager
  }
  return ctx
}

describe('spawn_agent tool', () => {
  it('briefly advertises proactive parallel delegation and result collection', () => {
    // Regression: the descriptor explained only the input contract, so models
    // rarely selected spawn_agent unless users explicitly requested a subagent.
    // Fixed by: adding concise proactive-use and wait_agent guidance.
    const { descriptor } = spawnAgentTool({ specs })
    const guidance = descriptor.description.split('Available agent_type values:')[0]!

    expect(descriptor.name).toBe('spawn_agent')
    expect(descriptor.description).toContain('browser_worker')
    expect(descriptor.description).toContain('dirIds')
    expect(guidance).toContain('parallel')
    expect(guidance).toContain('wait_agent')
    expect(guidance.length).toBeLessThanOrEqual(420)
    expect(descriptor.annotations).toEqual({ readOnlyHint: false, destructiveHint: true, openWorldHint: true })
  })

  it('spawns a child under the caller path and returns the receipt', async () => {
    let captured:
      | {
          parentPath: AgentPath
          agentType: string
          name: string
          message: string
          dirIds?: string[]
          signal: AbortSignal
        }
      | undefined
    const manager = mockManager(async (req) => {
      captured = {
        parentPath: req.parentPath,
        agentType: req.agentType,
        name: req.name,
        message: req.message,
        dirIds: req.dirIds,
        signal: req.callerSignal,
      }
      return { path: '/root/tiktok_operator', name: 'tiktok_operator', agentType: 'browser_worker', status: 'starting' }
    })
    const ctx = makeCtx(manager, '/root')
    const { handler } = spawnAgentTool({ specs })
    const r = await handler(
      {
        agent_type: 'browser_worker',
        name: 'tiktok_operator',
        message: 'do stuff',
        dirIds: ['dir-1', 'dir-2'],
      },
      ctx,
    )
    expect(r.isError).toBe(false)
    expect(r.content).toContain('/root/tiktok_operator')
    expect(r.content).toContain('starting')
    expect(captured?.parentPath).toBe('/root')
    expect(captured?.agentType).toBe('browser_worker')
    expect(captured?.message).toBe('do stuff')
    expect(captured?.dirIds).toEqual(['dir-1', 'dir-2'])
    expect(captured?.signal).toBe(ctx.signal)
  })

  it('defaults omitted dirIds to an empty browser scope request', async () => {
    // Regression: browser scope was embedded in an unstructured message,
    // forcing the model to produce a JSON string inside another tool input.
    // Fixed by: carrying optional dirIds as a first-class spawn_agent field.
    let captured: SpawnAgentRequest | undefined
    const manager = mockManager(async (request) => {
      captured = request
      return { path: '/root/worker', name: 'worker', agentType: 'browser_worker', status: 'starting' }
    })
    const { handler } = spawnAgentTool({ specs })

    await handler({ agent_type: 'browser_worker', name: 'worker', message: 'inspect the page' }, makeCtx(manager))

    expect(captured?.dirIds).toEqual([])
  })

  it('manager error (already_exists / unknown agent_type) -> isError', async () => {
    const manager = mockManager(async () => {
      throw new Error('agent already exists')
    })
    const { handler } = spawnAgentTool({ specs })
    const r = await handler({ agent_type: 'browser_worker', name: 'dup', message: 'm' }, makeCtx(manager))
    expect(r.isError).toBe(true)
    expect(r.content).toMatch(/already exists/i)
  })

  it('serializes typed manager errors as a stable JSON envelope', async () => {
    // Regression: manager errors were flattened into human-only text, so hosts
    // could not reliably distinguish capacity exhaustion from other failures.
    // Fixed by: preserving the manager domain code and quota fields in JSON.
    const manager = mockManager(async () => {
      throw new AgentManagerError({
        code: 'agent_concurrency_limit_reached',
        message: 'spawn_agent: subagent concurrency limit reached (2/2 active for this session).',
        active: 2,
        limit: 2,
      })
    })
    const { handler } = spawnAgentTool({ specs })
    const result = await handler({ agent_type: 'browser_worker', name: 'third', message: 'm' }, makeCtx(manager))

    expect(result.isError).toBe(true)
    expect(result.errorKind).toBe('handler_error')
    expect(JSON.parse(result.content)).toEqual({
      error: {
        code: 'agent_concurrency_limit_reached',
        message: 'spawn_agent: subagent concurrency limit reached (2/2 active for this session).',
        active: 2,
        limit: 2,
      },
    })
  })

  it('invalid name (not snake_case) -> input_invalid', async () => {
    const { handler } = spawnAgentTool({ specs })
    const r = await handler(
      { agent_type: 'browser_worker', name: 'TikTokOperator', message: 'm' },
      makeCtx(mockManager()),
    )
    expect(r.isError).toBe(true)
    expect(r.errorKind).toBe('input_invalid')
  })

  it('rejects legacy fields (subagent_type/description) -> input_invalid', async () => {
    const { handler } = spawnAgentTool({ specs })
    const r = await handler(
      { subagent_type: 'browser_worker', description: 'm' } as unknown as {
        agent_type: string
        name: string
        message: string
      },
      makeCtx(mockManager()),
    )
    expect(r.isError).toBe(true)
    expect(r.errorKind).toBe('input_invalid')
  })

  it('missing message -> input_invalid', async () => {
    const { handler } = spawnAgentTool({ specs })
    const r = await handler(
      { agent_type: 'browser_worker', name: 'x' } as unknown as { agent_type: string; name: string; message: string },
      makeCtx(mockManager()),
    )
    expect(r.isError).toBe(true)
    expect(r.errorKind).toBe('input_invalid')
  })

  it('missing agentManager -> isError', async () => {
    const { handler } = spawnAgentTool({ specs })
    const r = await handler({ agent_type: 'browser_worker', name: 'x', message: 'm' }, makeCtx(undefined))
    expect(r.isError).toBe(true)
    expect(r.content).toMatch(/manager|tree/i)
  })
})
