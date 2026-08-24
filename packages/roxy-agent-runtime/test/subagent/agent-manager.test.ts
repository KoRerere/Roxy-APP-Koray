import { describe, expect, it } from 'vitest'
import { AgentManager } from '../../src/subagent/agent-manager.ts'
import { ROOT_AGENT_PATH } from '../../src/core/contracts/agent-manager.ts'
import type {
  AgentPath,
  AgentLifecycleEvent,
  AgentResponse,
  ManagedAgentBuildOptions,
  ManagedAgentBuilder,
  ManagedAgentHandle,
  SubAgentSpec,
} from '../../src/core/interfaces.ts'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

interface BuilderOptions {
  report?: (message: string, opts: ManagedAgentBuildOptions) => string
  delayMs?: number
  failBuild?: boolean
  failInvoke?: boolean
  onBuild?: (opts: ManagedAgentBuildOptions) => void
  onInvoke?: (message: string, opts: ManagedAgentBuildOptions) => void | Promise<void>
}

function makeBuilder(options: BuilderOptions = {}): {
  builder: ManagedAgentBuilder
  handles: ManagedAgentHandle[]
  invocations: { path: AgentPath; message: string }[]
  disposed: AgentPath[]
} {
  const handles: ManagedAgentHandle[] = []
  const invocations: { path: AgentPath; message: string }[] = []
  const disposed: AgentPath[] = []
  const builder: ManagedAgentBuilder = async (_spec, opts) => {
    options.onBuild?.(opts)
    if (options.failBuild) {
      throw new Error('build failed')
    }
    if (options.delayMs) {
      await sleep(options.delayMs)
    }
    const handle: ManagedAgentHandle = {
      invoke: async (message) => {
        await options.onInvoke?.(message, opts)
        invocations.push({ path: opts.path, message })
        if (options.failInvoke) {
          throw new Error('invoke failed')
        }
        const report = options.report ? options.report(message, opts) : `report:${message}`
        const response: AgentResponse = {
          messages: [{ role: 'assistant', content: report }],
          trajectory: [],
        }
        return response
      },
      dispose: async () => {
        disposed.push(opts.path)
      },
    }
    handles.push(handle)
    return handle
  }
  return { builder, handles, invocations, disposed }
}

function makeSpec(name: string): SubAgentSpec {
  return { agentType: name, description: `${name} spec`, systemPrompt: '' }
}

function newManager(specs: SubAgentSpec[], builder: ManagedAgentBuilder): AgentManager {
  const map = new Map(specs.map((s) => [s.agentType, s]))
  const manager = new AgentManager({ specs: map, builder })
  manager.registerRoot({
    invoke: async () => ({ messages: [], trajectory: [] }),
    dispose: async () => {},
  })
  return manager
}

function callerSignal(): AbortSignal {
  return new AbortController().signal
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve: () => resolve!() }
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate()) {
      return
    }
    await sleep(0)
  }
  throw new Error('condition was not met')
}

describe('AgentManager registration', () => {
  it('includes terminal report and error in lifecycle events without exposing the spawn message', async () => {
    const events: AgentLifecycleEvent[] = []
    const { builder } = makeBuilder({
      report: (_message, opts) =>
        opts.name === 'ok'
          ? 'done'
          : (() => {
              throw new Error('failed child')
            })(),
    })
    const manager = new AgentManager({
      specs: new Map([['browser_worker', makeSpec('browser_worker')]]),
      builder,
      onEvent: (event) => events.push(event),
    })
    manager.registerRoot({ invoke: async () => ({ messages: [], trajectory: [] }), dispose: async () => {} })
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'browser_worker',
      name: 'ok',
      message: 'secret assignment',
      callerSignal: new AbortController().signal,
    })
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'browser_worker',
      name: 'bad',
      message: 'another secret',
      callerSignal: new AbortController().signal,
    })
    await manager.wait(ROOT_AGENT_PATH)

    expect(events.find((event) => event.agentPath === '/root/ok' && event.type === 'agent_completed')?.report).toBe(
      'done',
    )
    expect(events.find((event) => event.agentPath === '/root/bad' && event.type === 'agent_failed')?.error).toBe(
      'failed child',
    )
    expect(JSON.stringify(events)).not.toContain('secret assignment')
  })
  it('registerRoot exposes /root with fixed metadata', () => {
    const { builder } = makeBuilder()
    const manager = newManager([makeSpec('worker')], builder)
    const nodes = manager.list()
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.path).toBe(ROOT_AGENT_PATH)
    expect(nodes[0]!.name).toBe('root')
    expect(nodes[0]!.agentType).toBe('root')
    expect(nodes[0]!.status).toBe('running')
  })

  it('rejects maxConcurrentSubagents outside the supported 1..10 range', () => {
    // Regression: an unchecked override could silently disable the fixed
    // production safety cap or make every spawn impossible.
    // Fixed by: validating deterministic test overrides in the constructor.
    const { builder } = makeBuilder()
    const specs = new Map([['worker', makeSpec('worker')]])
    expect(() => new AgentManager({ specs, builder, maxConcurrentSubagents: 0 })).toThrow(/between 1 and 10/i)
    expect(() => new AgentManager({ specs, builder, maxConcurrentSubagents: 11 })).toThrow(/between 1 and 10/i)
    expect(() => new AgentManager({ specs, builder, maxConcurrentSubagents: 1.5 })).toThrow(/integer/i)
  })
})

describe('AgentManager spawn path', () => {
  it('passes spawn dirIds to the managed agent builder', async () => {
    // Regression: AgentManager forwarded only message, so hosts could not
    // configure a child Playwright allowlist from structured spawn input.
    // Fixed by: carrying dirIds through ManagedAgentBuildOptions.
    let buildOptions: ManagedAgentBuildOptions | undefined
    const { builder } = makeBuilder({ onBuild: (options) => (buildOptions = options) })
    const manager = newManager([makeSpec('worker')], builder)

    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'browser_worker',
      message: 'inspect the selected profiles',
      dirIds: ['dir-1', 'dir-2'],
      callerSignal: callerSignal(),
    })
    await manager.wait(ROOT_AGENT_PATH)

    expect(buildOptions?.dirIds).toEqual(['dir-1', 'dir-2'])
  })

  it('root spawn produces /root/<name>', async () => {
    const { builder } = makeBuilder()
    const manager = newManager([makeSpec('worker')], builder)
    const receipt = await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'tiktok_operator',
      message: 'do stuff',
      callerSignal: callerSignal(),
    })
    expect(receipt.path).toBe('/root/tiktok_operator')
    expect(receipt.name).toBe('tiktok_operator')
    expect(receipt.agentType).toBe('worker')
    expect(receipt.status).toBe('starting')
  })

  it('child spawn produces a nested three-level path', async () => {
    const invokeGate = deferred()
    const { builder } = makeBuilder({ onInvoke: () => invokeGate.promise })
    const manager = newManager([makeSpec('worker')], builder)
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'tiktok_operator',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await waitUntil(() => manager.list('/root/tiktok_operator')[0]?.status === 'running')
    const receipt = await manager.spawn({
      parentPath: '/root/tiktok_operator',
      agentType: 'worker',
      name: 'video_data_collector',
      message: 'm',
      callerSignal: callerSignal(),
    })
    expect(receipt.path).toBe('/root/tiktok_operator/video_data_collector')

    invokeGate.resolve()
    await manager.wait(ROOT_AGENT_PATH)
  })

  it('rejects invalid snake_case name', async () => {
    const { builder } = makeBuilder()
    const manager = newManager([makeSpec('worker')], builder)
    await expect(
      manager.spawn({
        parentPath: ROOT_AGENT_PATH,
        agentType: 'worker',
        name: 'TikTokOperator',
        message: 'm',
        callerSignal: callerSignal(),
      }),
    ).rejects.toThrow(/name/i)
  })

  it('rejects unknown agent_type', async () => {
    const { builder } = makeBuilder()
    const manager = newManager([makeSpec('worker')], builder)
    await expect(
      manager.spawn({
        parentPath: ROOT_AGENT_PATH,
        agentType: 'ghost',
        name: 'n',
        message: 'm',
        callerSignal: callerSignal(),
      }),
    ).rejects.toThrow(/agent_type|unknown/i)
  })

  it('same-parent duplicate name -> agent_already_exists (concurrent safe)', async () => {
    const { builder } = makeBuilder({ delayMs: 20 })
    const manager = newManager([makeSpec('worker')], builder)
    const a = manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'dup',
      message: 'm',
      callerSignal: callerSignal(),
    })
    const b = manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'dup',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await expect(Promise.allSettled([a, b])).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'fulfilled' }),
        expect.objectContaining({
          status: 'rejected',
          reason: expect.objectContaining({ message: expect.stringMatching(/already exists/i) }),
        }),
      ]),
    )
  })

  it('different parents may share the same name', async () => {
    const invokeGate = deferred()
    const { builder } = makeBuilder({ onInvoke: () => invokeGate.promise })
    const manager = newManager([makeSpec('worker')], builder)
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'a',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'b',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await waitUntil(() => manager.list('/root/a')[0]?.status === 'running')
    await waitUntil(() => manager.list('/root/b')[0]?.status === 'running')
    const r1 = await manager.spawn({
      parentPath: '/root/a',
      agentType: 'worker',
      name: 'shared',
      message: 'm',
      callerSignal: callerSignal(),
    })
    const r2 = await manager.spawn({
      parentPath: '/root/b',
      agentType: 'worker',
      name: 'shared',
      message: 'm',
      callerSignal: callerSignal(),
    })
    expect(r1.path).toBe('/root/a/shared')
    expect(r2.path).toBe('/root/b/shared')

    invokeGate.resolve()
    await manager.wait(ROOT_AGENT_PATH)
  })

  it('rejects spawning from a terminal parent', async () => {
    // Regression: a completed child remained a valid parent, allowing new work
    // to appear below an agent that could no longer own or supervise it.
    // Fixed by: rejecting spawn when the trusted parent node is terminal.
    const { builder } = makeBuilder()
    const manager = newManager([makeSpec('worker')], builder)
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'parent',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await waitUntil(() => manager.list('/root/parent')[0]?.status === 'completed')

    await expect(
      manager.spawn({
        parentPath: '/root/parent',
        agentType: 'worker',
        name: 'late_child',
        message: 'm',
        callerSignal: callerSignal(),
      }),
    ).rejects.toMatchObject({ code: 'agent_parent_terminal' })
  })
})

describe('AgentManager concurrency quota', () => {
  it('rejects work above the configured session limit', async () => {
    // Regression: AgentManager had no session-level active subagent limit, so
    // one model turn could reserve an unbounded number of child resources.
    // Fixed by: atomically reserving at most maxConcurrentSubagents slots.
    const invokeGate = deferred()
    const { builder } = makeBuilder({ onInvoke: () => invokeGate.promise })
    const specs = [makeSpec('worker')]
    const manager = new AgentManager({
      specs: new Map(specs.map((spec) => [spec.agentType, spec])),
      builder,
      maxConcurrentSubagents: 2,
    })
    manager.registerRoot({ invoke: async () => ({ messages: [], trajectory: [] }), dispose: async () => {} })

    for (const name of ['first', 'second']) {
      await manager.spawn({
        parentPath: ROOT_AGENT_PATH,
        agentType: 'worker',
        name,
        message: 'm',
        callerSignal: callerSignal(),
      })
    }

    await expect(
      manager.spawn({
        parentPath: ROOT_AGENT_PATH,
        agentType: 'worker',
        name: 'third',
        message: 'm',
        callerSignal: callerSignal(),
      }),
    ).rejects.toMatchObject({
      code: 'agent_concurrency_limit_reached',
      active: 2,
      limit: 2,
    })
    expect(manager.list('/root/third')).toEqual([])

    invokeGate.resolve()
    await manager.wait(ROOT_AGENT_PATH)
  })

  it('holds the slot until child cleanup settles', async () => {
    // Regression: a child released its implicit capacity as soon as invoke()
    // completed, even while dispose() still held MCP and lease resources.
    // Fixed by: releasing the reserved slot only after dispose() settles.
    const cleanupGate = deferred()
    const specs = [makeSpec('worker')]
    const builder: ManagedAgentBuilder = async () => ({
      invoke: async () => ({ messages: [{ role: 'assistant', content: 'done' }], trajectory: [] }),
      dispose: () => cleanupGate.promise,
    })
    const manager = new AgentManager({
      specs: new Map(specs.map((spec) => [spec.agentType, spec])),
      builder,
      maxConcurrentSubagents: 1,
    })
    manager.registerRoot({ invoke: async () => ({ messages: [], trajectory: [] }), dispose: async () => {} })

    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'first',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await waitUntil(() => manager.list('/root/first')[0]?.status === 'completed')
    expect(manager.list('/root/first')[0]?.cleanupSettled).toBe(false)

    await expect(
      manager.spawn({
        parentPath: ROOT_AGENT_PATH,
        agentType: 'worker',
        name: 'second',
        message: 'm',
        callerSignal: callerSignal(),
      }),
    ).rejects.toMatchObject({ code: 'agent_concurrency_limit_reached' })

    cleanupGate.resolve()
    await waitUntil(() => manager.list('/root/first')[0]?.cleanupSettled === true)
    await expect(
      manager.spawn({
        parentPath: ROOT_AGENT_PATH,
        agentType: 'worker',
        name: 'second',
        message: 'm',
        callerSignal: callerSignal(),
      }),
    ).resolves.toMatchObject({ path: '/root/second' })
  })
})

describe('AgentManager background execution', () => {
  it('spawn returns immediately with starting; report saved on completion', async () => {
    const { builder, invocations } = makeBuilder({ delayMs: 30 })
    const manager = newManager([makeSpec('worker')], builder)
    const receipt = await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'slow',
      message: 'do work',
      callerSignal: callerSignal(),
    })
    expect(receipt.status).toBe('starting')
    // Wait for background builder+invoke to settle.
    await sleep(60)
    expect(invocations).toHaveLength(1)
    expect(invocations[0]!.message).toBe('do work')
    const node = manager.list('/root/slow').find((n) => n.path === '/root/slow')
    expect(node?.status).toBe('completed')
    expect(node?.report).toBe('report:do work')
  })

  it('builder rejection converges to failed, no unhandled rejection', async () => {
    const { builder } = makeBuilder({ failBuild: true })
    const manager = newManager([makeSpec('worker')], builder)
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'boom',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await sleep(10)
    const node = manager.list('/root/boom').find((n) => n.path === '/root/boom')
    expect(node?.status).toBe('failed')
    expect(node?.error).toMatch(/build failed/i)
  })

  it('invoke rejection converges to failed', async () => {
    const { builder } = makeBuilder({ failInvoke: true })
    const manager = newManager([makeSpec('worker')], builder)
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'invoke_boom',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await sleep(10)
    const node = manager.list('/root/invoke_boom').find((n) => n.path === '/root/invoke_boom')
    expect(node?.status).toBe('failed')
    expect(node?.error).toMatch(/invoke failed/i)
  })
})

describe('AgentManager list', () => {
  it('default prefix /root lists whole tree sorted by path', async () => {
    const { builder } = makeBuilder()
    const manager = newManager([makeSpec('worker')], builder)
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'b_node',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'a_node',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await sleep(0)
    const paths = manager.list().map((n) => n.path)
    expect(paths).toEqual(['/root', '/root/a_node', '/root/b_node'])
  })

  it('prefix boundary: /root/foo does not match /root/foobar', async () => {
    const { builder } = makeBuilder()
    const manager = newManager([makeSpec('worker')], builder)
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'foo',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'foobar',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await sleep(0)
    const paths = manager.list('/root/foo').map((n) => n.path)
    expect(paths).toEqual(['/root/foo'])
  })

  it('non-existent prefix returns empty list', () => {
    const { builder } = makeBuilder()
    const manager = newManager([makeSpec('worker')], builder)
    expect(manager.list('/root/missing')).toEqual([])
  })
})

describe('AgentManager wait', () => {
  it('no descendants -> immediate return', async () => {
    const { builder } = makeBuilder()
    const manager = newManager([makeSpec('worker')], builder)
    const result = await manager.wait(ROOT_AGENT_PATH)
    expect(result.timedOut).toBe(false)
    expect(result.runningPaths).toEqual([])
  })

  it('waits for grandchildren created during the wait', async () => {
    const specs = [makeSpec('worker')]
    const map = new Map(specs.map((s) => [s.agentType, s]))
    // Child spawns a grandchild mid-invoke, then completes.
    const { builder } = makeBuilder({
      onInvoke: async (_msg, opts) => {
        if (opts.path === '/root/parent') {
          await opts.manager.spawn({
            parentPath: opts.path,
            agentType: 'worker',
            name: 'child',
            message: 'm',
            callerSignal: callerSignal(),
          })
        }
      },
    })
    const manager = new AgentManager({ specs: map, builder })
    manager.registerRoot({ invoke: async () => ({ messages: [], trajectory: [] }), dispose: async () => {} })
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'parent',
      message: 'm',
      callerSignal: callerSignal(),
    })
    const result = await manager.wait(ROOT_AGENT_PATH, 1000)
    expect(result.timedOut).toBe(false)
    expect(result.runningPaths).toEqual([])
    const child = manager.list('/root/parent/child').find((n) => n.path === '/root/parent/child')
    expect(child?.status).toBe('completed')
  })

  it('timeout returns snapshot and does not cancel the child', async () => {
    const { builder } = makeBuilder({ delayMs: 200 })
    const manager = newManager([makeSpec('worker')], builder)
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'long',
      message: 'm',
      callerSignal: callerSignal(),
    })
    const result = await manager.wait(ROOT_AGENT_PATH, 20)
    expect(result.timedOut).toBe(true)
    expect(result.runningPaths).toContain('/root/long')
    const node = manager.list('/root/long').find((n) => n.path === '/root/long')
    expect(node?.status).not.toBe('cancelled')
  })

  it('returns at business terminal without waiting for cleanup', async () => {
    // Regression: wait() observed the child lifecycle promise, whose boundary
    // includes dispose(), so report collection blocked on unrelated cleanup.
    // Fixed by: notifying subtree waiters at the business terminal transition.
    const cleanupGate = deferred()
    const specs = [makeSpec('worker')]
    const builder: ManagedAgentBuilder = async () => ({
      invoke: async () => ({ messages: [{ role: 'assistant', content: 'done' }], trajectory: [] }),
      dispose: () => cleanupGate.promise,
    })
    const manager = new AgentManager({ specs: new Map([['worker', specs[0]!]]), builder })
    manager.registerRoot({ invoke: async () => ({ messages: [], trajectory: [] }), dispose: async () => {} })
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'worker',
      message: 'm',
      callerSignal: callerSignal(),
    })

    const result = await manager.wait(ROOT_AGENT_PATH, 100)
    expect(result.timedOut).toBe(false)
    expect(result.runningPaths).toEqual([])
    expect(result.agents.find((node) => node.path === '/root/worker')).toMatchObject({
      status: 'completed',
      cleanupSettled: false,
    })

    cleanupGate.resolve()
    await waitUntil(() => manager.list('/root/worker')[0]?.cleanupSettled === true)
  })
})

describe('AgentManager cancel', () => {
  it('cancelSubtree cancels all running descendants', async () => {
    const cancelled: AgentPath[] = []
    const { builder } = makeBuilder({
      onInvoke: async (_msg, opts) => {
        opts.signal.addEventListener('abort', () => cancelled.push(opts.path))
        // Hold until aborted.
        await new Promise<void>((resolve) => opts.signal.addEventListener('abort', () => resolve()))
      },
    })
    const manager = newManager([makeSpec('worker')], builder)
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'a',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'b',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await sleep(5)
    manager.cancelSubtree(ROOT_AGENT_PATH)
    await sleep(10)
    expect(cancelled).toContain('/root/a')
    expect(cancelled).toContain('/root/b')
    for (const p of ['/root/a', '/root/b']) {
      const node = manager.list(p).find((n) => n.path === p)
      expect(node?.status).toBe('cancelled')
    }
  })

  it('sibling failure does not cancel other descendants', async () => {
    // One child fails its invoke, the other completes; ensure neither cancels the other.
    const map = new Map([['worker', makeSpec('worker')]])
    const failBuilder: ManagedAgentBuilder = async (_spec, opts) => {
      const handle: ManagedAgentHandle = {
        invoke: async () => {
          if (opts.name === 'bad') {
            throw new Error('bad child failed')
          }
          await sleep(40)
          return { messages: [{ role: 'assistant', content: 'ok' }], trajectory: [] }
        },
        dispose: async () => {},
      }
      return handle
    }
    const manager = new AgentManager({ specs: map, builder: failBuilder })
    manager.registerRoot({ invoke: async () => ({ messages: [], trajectory: [] }), dispose: async () => {} })
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'bad',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'good',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await sleep(60)
    const bad = manager.list('/root/bad').find((n) => n.path === '/root/bad')
    const good = manager.list('/root/good').find((n) => n.path === '/root/good')
    expect(bad?.status).toBe('failed')
    expect(good?.status).toBe('completed')
  })

  it('terminal child releases handle resources; snapshot retained', async () => {
    const { builder, disposed } = makeBuilder()
    const manager = newManager([makeSpec('worker')], builder)
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'done',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await sleep(20)
    expect(disposed).toContain('/root/done')
    const node = manager.list('/root/done').find((n) => n.path === '/root/done')
    expect(node?.status).toBe('completed')
    expect(node?.report).toBe('report:m')
  })
})

describe('AgentManager dispose', () => {
  it('dispose cancels running descendants and is idempotent', async () => {
    const { builder } = makeBuilder({ delayMs: 200 })
    const manager = newManager([makeSpec('worker')], builder)
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'running',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await sleep(5)
    await manager.dispose()
    await manager.dispose()
    const node = manager.list('/root/running').find((n) => n.path === '/root/running')
    expect(node?.status).toBe('cancelled')
  })

  it('does not resolve until every child cleanup has settled', async () => {
    // Regression: dispose() marked children cancelled and then filtered them
    // out of its pending set, returning before child dispose() completed.
    // Fixed by: awaiting every reserved child's lifecycle/cleanup promise.
    const cleanupGate = deferred()
    const started = deferred()
    const specs = [makeSpec('worker')]
    const builder: ManagedAgentBuilder = async (_spec, opts) => ({
      invoke: async () => {
        started.resolve()
        await new Promise<void>((resolve) => opts.signal.addEventListener('abort', () => resolve(), { once: true }))
        return { messages: [], trajectory: [] }
      },
      dispose: () => cleanupGate.promise,
    })
    const manager = new AgentManager({ specs: new Map([['worker', specs[0]!]]), builder })
    manager.registerRoot({ invoke: async () => ({ messages: [], trajectory: [] }), dispose: async () => {} })
    await manager.spawn({
      parentPath: ROOT_AGENT_PATH,
      agentType: 'worker',
      name: 'running',
      message: 'm',
      callerSignal: callerSignal(),
    })
    await started.promise

    let disposed = false
    const disposePromise = manager.dispose().then(() => {
      disposed = true
    })
    await sleep(0)
    expect(disposed).toBe(false)

    cleanupGate.resolve()
    await disposePromise
    expect(disposed).toBe(true)
    expect(manager.list('/root/running')[0]?.cleanupSettled).toBe(true)
  })
})
