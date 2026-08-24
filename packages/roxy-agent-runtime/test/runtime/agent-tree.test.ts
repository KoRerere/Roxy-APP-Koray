import { describe, expect, it } from 'vitest'
import { AgentRuntime } from '../../src/runtime/runtime.ts'
import { AgentManager } from '../../src/subagent/agent-manager.ts'
import { createTestAgentDefinition } from '../helpers/buildTestAgent.ts'
import type { ManagedAgentBuilder } from '../../src/core/interfaces.ts'

const noopBuilder: ManagedAgentBuilder = async () => ({
  invoke: async () => ({ messages: [], trajectory: [] }),
  dispose: async () => {},
})

describe('AgentRuntime agent tree integration', () => {
  it('registers /root exactly once when created with a manager', async () => {
    const manager = new AgentManager({ specs: new Map(), builder: noopBuilder })
    const def = createTestAgentDefinition({})
    def.agentManager = manager
    const runtime = await AgentRuntime.create(def)

    expect(runtime.agentManager).toBe(manager)
    const nodes = manager.list()
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.path).toBe('/root')
    expect(nodes[0]!.name).toBe('root')
    expect(nodes[0]!.agentType).toBe('root')
    expect(nodes[0]!.status).toBe('running')

    await runtime.dispose()
    const after = manager.list('/root').find((n) => n.path === '/root')
    expect(after?.status).toBe('cancelled')
  })

  it('agents assembled without a manager have no tree identity', async () => {
    const def = createTestAgentDefinition({})
    const runtime = await AgentRuntime.create(def)
    expect(runtime.agentManager).toBeUndefined()
    await runtime.dispose()
  })

  it('root invoke abort cancels running descendants', async () => {
    // Regression: aborting a root turn stopped only the root Agent loop, while
    // background children retained MCP clients and leases under the manager.
    // Fixed by: bridging the root invoke signal into manager.cancelSubtree().
    let startChild: () => void
    const childStarted = new Promise<void>((resolve) => {
      startChild = resolve
    })
    let childAborted = false
    const builder: ManagedAgentBuilder = async (_spec, options) => ({
      invoke: async () => {
        startChild()
        await new Promise<void>((resolve) => {
          options.signal.addEventListener(
            'abort',
            () => {
              childAborted = true
              resolve()
            },
            { once: true },
          )
        })
        return { messages: [], trajectory: [] }
      },
      dispose: async () => {},
    })
    const spec = { agentType: 'worker', description: 'worker', systemPrompt: '' }
    const manager = new AgentManager({ specs: new Map([['worker', spec]]), builder })
    const def = createTestAgentDefinition({ responses: [] })
    def.agentManager = manager
    const runtime = await AgentRuntime.create(def)
    await manager.spawn({
      parentPath: '/root',
      agentType: 'worker',
      name: 'worker',
      message: 'm',
      callerSignal: new AbortController().signal,
    })
    await childStarted

    const controller = new AbortController()
    controller.abort()
    await expect(runtime.invoke('stop', controller.signal)).resolves.toEqual({ messages: [], trajectory: [] })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const childWasAborted = childAborted
    const childStatus = manager.list('/root/worker')[0]?.status
    await runtime.dispose()
    expect(childWasAborted).toBe(true)
    expect(childStatus).toBe('cancelled')
  })

  it('root stream abort cancels running descendants', async () => {
    let startChild: () => void
    const childStarted = new Promise<void>((resolve) => {
      startChild = resolve
    })
    let childAborted = false
    const builder: ManagedAgentBuilder = async (_spec, options) => ({
      invoke: async () => {
        startChild()
        await new Promise<void>((resolve) => {
          options.signal.addEventListener(
            'abort',
            () => {
              childAborted = true
              resolve()
            },
            { once: true },
          )
        })
        return { messages: [], trajectory: [] }
      },
      dispose: async () => {},
    })
    const spec = { agentType: 'worker', description: 'worker', systemPrompt: '' }
    const manager = new AgentManager({ specs: new Map([['worker', spec]]), builder })
    const def = createTestAgentDefinition({ responses: [] })
    def.agentManager = manager
    const runtime = await AgentRuntime.create(def)
    await manager.spawn({
      parentPath: '/root',
      agentType: 'worker',
      name: 'worker',
      message: 'm',
      callerSignal: new AbortController().signal,
    })
    await childStarted

    const controller = new AbortController()
    controller.abort()
    for await (const _event of runtime.stream('stop', controller.signal)) {
      // A pre-aborted stream produces no model events.
    }
    await new Promise((resolve) => setTimeout(resolve, 0))

    const childWasAborted = childAborted
    const childStatus = manager.list('/root/worker')[0]?.status
    await runtime.dispose()
    expect(childWasAborted).toBe(true)
    expect(childStatus).toBe('cancelled')
  })
})
