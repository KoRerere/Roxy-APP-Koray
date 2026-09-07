import type { RuntimeFileCollector } from '@/runtime/file-collector'
import { describe, expect, it, vi } from 'vitest'
import { ProfileRuntimeManager } from './profileRuntimeManager'

function collector(): RuntimeFileCollector {
  return {
    record: vi.fn(),
    addArtifactRoot: vi.fn(),
    consume: () => [],
    peek: () => [],
  }
}

describe('profileRuntimeManager', () => {
  it('syncs automation only when a page tool runs and releases it with its binding', async () => {
    const connection = {
      dirId: 'dir-1',
      endpoint: 'ws://one',
      protocol: 'cdp' as const,
      browserType: 'chromium' as const,
      connectedAt: 1,
    }
    const onAutomationSync = vi.fn(async () => true)
    const onAutomationRelease = vi.fn(async () => {})
    const manager = new ProfileRuntimeManager({
      connections: {
        get: vi.fn(async () => connection),
        list: vi.fn(async () => [connection]),
        open: vi.fn(),
      },
      createResource: vi.fn(async () => ({
        tools: new Map(),
        close: vi.fn(async () => {}),
        artifactRoot: '/tmp/one',
        getActiveTargetId: vi.fn(async () => 'target-1'),
      })),
      onAutomationSync,
      onAutomationRelease,
    })
    const binding = manager.createBinding({ bindingId: 'binding-a', executionId: 'run-a', collector: collector() })

    await binding.activate('dir-1')
    await binding.ensureActive()
    expect(onAutomationSync).not.toHaveBeenCalled()

    await binding.run(async () => {}, { automation: 'sync-before' })
    await manager.releaseBinding('binding-a')

    expect(onAutomationSync).toHaveBeenCalledTimes(1)
    expect(onAutomationSync).toHaveBeenCalledWith('dir-1', 'run-a', 'target-1')
    expect(onAutomationRelease).toHaveBeenCalledTimes(1)
    expect(onAutomationRelease).toHaveBeenCalledWith('dir-1', 'run-a')
  })

  it('keeps a group until the last same-execution binding releases it', async () => {
    const connection = {
      dirId: 'dir-1', endpoint: 'ws://one', protocol: 'cdp' as const, browserType: 'chromium' as const, connectedAt: 1,
    }
    const onAutomationSync = vi.fn(async () => true)
    const onAutomationRelease = vi.fn(async () => {})
    const manager = new ProfileRuntimeManager({
      connections: { get: vi.fn(async () => connection), list: vi.fn(async () => [connection]), open: vi.fn() },
      createResource: vi.fn(async () => ({
        tools: new Map(), close: vi.fn(async () => {}), artifactRoot: '/tmp/one', getActiveTargetId: vi.fn(async () => 'target-1'),
      })),
      onAutomationSync,
      onAutomationRelease,
    })
    const root = manager.createBinding({ bindingId: 'root', executionId: 'run-a' })
    const child = manager.createBinding({ bindingId: 'child', executionId: 'run-a' })

    await root.activate('dir-1')
    await child.activate('dir-1')
    await root.run(async () => {}, { automation: 'sync-before' })
    await child.run(async () => {}, { automation: 'sync-before' })
    await manager.releaseBinding('root')

    expect(onAutomationRelease).not.toHaveBeenCalled()
    await manager.releaseBinding('child')
    expect(onAutomationSync).toHaveBeenCalledTimes(2)
    expect(onAutomationRelease).toHaveBeenCalledWith('dir-1', 'run-a')
  })

  it('retries a failed sync and forgets UI state when the browser is invalidated', async () => {
    const connection = {
      dirId: 'dir-1', endpoint: 'ws://one', protocol: 'cdp' as const, browserType: 'chromium' as const, connectedAt: 1,
    }
    const onAutomationSync = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(true)
    const onAutomationRelease = vi.fn(async () => {})
    const manager = new ProfileRuntimeManager({
      connections: { get: vi.fn(async () => connection), list: vi.fn(async () => [connection]), open: vi.fn() },
      createResource: vi.fn(async () => ({
        tools: new Map(), close: vi.fn(async () => {}), artifactRoot: '/tmp/one', getActiveTargetId: vi.fn(async () => 'target-1'),
      })),
      onAutomationSync,
      onAutomationRelease,
    })
    const binding = manager.createBinding({ bindingId: 'binding-a', executionId: 'run-a' })

    await binding.activate('dir-1')
    await binding.run(async () => {}, { automation: 'sync-before' })
    await binding.run(async () => {}, { automation: 'sync-before' })
    await manager.invalidate('dir-1')
    await binding.activate('dir-1')
    await binding.run(async () => {}, { automation: 'sync-before' })

    expect(onAutomationSync).toHaveBeenCalledTimes(3)
    expect(onAutomationRelease).not.toHaveBeenCalled()
  })

  it('keeps leases run-scoped while reusing one endpoint-scoped playwright resource', async () => {
    const connection = {
      dirId: 'dir-1',
      endpoint: 'ws://127.0.0.1/devtools/browser/one',
      protocol: 'cdp' as const,
      browserType: 'chromium' as const,
      connectedAt: 1,
    }
    const createResource = vi.fn(async () => ({
      tools: new Map(),
      close: vi.fn(async () => {}),
      artifactRoot: '/tmp/profile-dir-1',
    }))
    const manager = new ProfileRuntimeManager({
      connections: {
        get: vi.fn(async () => connection),
        list: vi.fn(async () => [connection]),
        open: vi.fn(),
      },
      createResource,
    })

    const first = manager.createBinding({
      bindingId: 'binding-a',
      executionId: 'run-a',
      conversationId: 'conversation-a',
      collector: collector(),
    })
    await first.activate('dir-1', 'chromium')

    const second = manager.createBinding({
      bindingId: 'binding-b',
      executionId: 'run-b',
      conversationId: 'conversation-b',
      collector: collector(),
    })
    await expect(second.activate('dir-1', 'chromium')).rejects.toThrow(/正在被其他会话操作/)

    await manager.releaseExecution('run-a')
    await second.activate('dir-1', 'chromium')

    expect(createResource).toHaveBeenCalledTimes(1)
    await manager.shutdown()
  })

  it('allows root and child bindings from the same execution to share one profile lease', async () => {
    const connection = {
      dirId: 'dir-1',
      endpoint: 'ws://127.0.0.1/devtools/browser/one',
      protocol: 'cdp' as const,
      browserType: 'chromium' as const,
      connectedAt: 1,
    }
    const createResource = vi.fn(async () => ({
      tools: new Map(),
      close: vi.fn(async () => {}),
      artifactRoot: '/tmp/shared-execution',
    }))
    const manager = new ProfileRuntimeManager({
      connections: {
        get: vi.fn(async () => connection),
        list: vi.fn(async () => [connection]),
        open: vi.fn(),
      },
      createResource,
    })
    const root = manager.createBinding({ bindingId: 'root', executionId: 'run-a' })
    const child = manager.createBinding({ bindingId: 'child', executionId: 'run-a' })

    await root.activate('dir-1')
    await child.activate('dir-1')

    expect(createResource).toHaveBeenCalledTimes(1)
    await manager.shutdown()
  })

  it('replaces the resource after the browser endpoint changes', async () => {
    const closeFirst = vi.fn(async () => {})
    const get = vi.fn()
      .mockResolvedValueOnce({
        dirId: 'dir-1',
        endpoint: 'ws://127.0.0.1/devtools/browser/one',
        protocol: 'cdp',
        browserType: 'chromium',
        connectedAt: 1,
      })
      .mockResolvedValueOnce({
        dirId: 'dir-1',
        endpoint: 'ws://127.0.0.1/devtools/browser/two',
        protocol: 'cdp',
        browserType: 'chromium',
        connectedAt: 2,
      })
    const createResource = vi.fn()
      .mockResolvedValueOnce({ tools: new Map(), close: closeFirst, artifactRoot: '/tmp/one' })
      .mockResolvedValueOnce({ tools: new Map(), close: vi.fn(async () => {}), artifactRoot: '/tmp/two' })
    const manager = new ProfileRuntimeManager({
      connections: { get, list: vi.fn(async () => []), open: vi.fn() },
      createResource,
    })
    const binding = manager.createBinding({
      bindingId: 'binding-a',
      executionId: 'run-a',
      conversationId: 'conversation-a',
      collector: collector(),
    })

    await binding.activate('dir-1', 'chromium')
    await binding.ensureActive()

    expect(closeFirst).toHaveBeenCalledTimes(1)
    expect(createResource).toHaveBeenCalledTimes(2)
    await manager.shutdown()
  })

  it('keeps retired artifact generations until the referencing execution is released', async () => {
    const firstConnection = {
      dirId: 'dir-1',
      endpoint: 'ws://127.0.0.1/devtools/browser/one',
      protocol: 'cdp' as const,
      browserType: 'chromium' as const,
      connectedAt: 1,
    }
    const secondConnection = {
      ...firstConnection,
      endpoint: 'ws://127.0.0.1/devtools/browser/two',
      connectedAt: 2,
    }
    const cleanupFirst = vi.fn(async () => {})
    const cleanupSecond = vi.fn(async () => {})
    const get = vi.fn()
      .mockResolvedValueOnce(firstConnection)
      .mockResolvedValueOnce(secondConnection)
    const manager = new ProfileRuntimeManager({
      connections: {
        get,
        list: vi.fn(async () => [secondConnection]),
        open: vi.fn(),
      },
      createResource: vi.fn()
        .mockResolvedValueOnce({
          tools: new Map(),
          close: vi.fn(async () => {}),
          artifactRoot: '/tmp/one',
          cleanupArtifacts: cleanupFirst,
        })
        .mockResolvedValueOnce({
          tools: new Map(),
          close: vi.fn(async () => {}),
          artifactRoot: '/tmp/two',
          cleanupArtifacts: cleanupSecond,
        }),
    })
    const binding = manager.createBinding({
      bindingId: 'binding-a',
      executionId: 'run-a',
      conversationId: 'conversation-a',
      collector: collector(),
    })

    await binding.activate('dir-1')
    await binding.ensureActive()

    expect(cleanupFirst).not.toHaveBeenCalled()
    await manager.releaseExecution('run-a')
    expect(cleanupFirst).toHaveBeenCalledTimes(1)
    expect(cleanupSecond).not.toHaveBeenCalled()

    await manager.shutdown()
    expect(cleanupSecond).toHaveBeenCalledTimes(1)
  })

  it('cleans a shared artifact generation only once during shutdown', async () => {
    const connection = {
      dirId: 'dir-1',
      endpoint: 'ws://127.0.0.1/devtools/browser/one',
      protocol: 'cdp' as const,
      browserType: 'chromium' as const,
      connectedAt: 1,
    }
    const cleanupArtifacts = vi.fn(async () => {})
    const manager = new ProfileRuntimeManager({
      connections: {
        get: vi.fn(async () => connection),
        list: vi.fn(async () => [connection]),
        open: vi.fn(),
      },
      createResource: vi.fn(async () => ({
        tools: new Map(),
        close: vi.fn(async () => {}),
        artifactRoot: '/tmp/shared',
        cleanupArtifacts,
      })),
    })
    const binding = manager.createBinding({ bindingId: 'binding-a', executionId: 'run-a', collector: collector() })

    await binding.activate('dir-1')
    await manager.disconnectResource('dir-1')
    await binding.activate('dir-1')
    await manager.shutdown()

    expect(cleanupArtifacts).toHaveBeenCalledTimes(1)
  })

  it('serializes operations for the same profile', async () => {
    const manager = new ProfileRuntimeManager({
      connections: {
        get: vi.fn(async () => ({
          dirId: 'dir-1',
          endpoint: 'ws://127.0.0.1/devtools/browser/one',
          protocol: 'cdp' as const,
          browserType: 'chromium' as const,
          connectedAt: 1,
        })),
        list: vi.fn(async () => []),
        open: vi.fn(),
      },
      createResource: vi.fn(async () => ({ tools: new Map(), close: vi.fn(async () => {}), artifactRoot: '/tmp/one' })),
    })
    const binding = manager.createBinding({
      bindingId: 'binding-a',
      executionId: 'run-a',
      conversationId: 'conversation-a',
      collector: collector(),
    })
    await binding.activate('dir-1', 'chromium')
    const order: string[] = []
    let release!: () => void
    const gate = new Promise<void>(resolve => release = resolve)

    const first = binding.run(async () => {
      order.push('first-start')
      await gate
      order.push('first-end')
      return 'first'
    })
    const second = binding.run(async () => {
      order.push('second')
      return 'second'
    })
    await vi.waitFor(() => expect(order).toEqual(['first-start']))
    release()
    await Promise.all([first, second])
    expect(order).toEqual(['first-start', 'first-end', 'second'])
    await manager.shutdown()
  })

  it('keeps operations on different profiles parallel', async () => {
    const connections = new Map([
      ['dir-1', { dirId: 'dir-1', endpoint: 'ws://one', protocol: 'cdp' as const, browserType: 'chromium' as const, connectedAt: 1 }],
      ['dir-2', { dirId: 'dir-2', endpoint: 'ws://two', protocol: 'cdp' as const, browserType: 'chromium' as const, connectedAt: 1 }],
    ])
    const manager = new ProfileRuntimeManager({
      connections: {
        get: vi.fn(async dirId => connections.get(dirId)),
        list: vi.fn(async () => [...connections.values()]),
        open: vi.fn(),
      },
      createResource: vi.fn(async connection => ({
        tools: new Map(),
        close: vi.fn(async () => {}),
        artifactRoot: `/tmp/${connection.dirId}`,
      })),
    })
    const first = manager.createBinding({ bindingId: 'binding-a', executionId: 'run-a' })
    const second = manager.createBinding({ bindingId: 'binding-b', executionId: 'run-a' })
    await first.activate('dir-1')
    await second.activate('dir-2')
    const started: string[] = []
    let releaseFirst!: () => void
    const firstGate = new Promise<void>(resolve => releaseFirst = resolve)

    const firstRun = first.run(async () => {
      started.push('dir-1')
      await firstGate
    })
    const secondRun = second.run(async () => {
      started.push('dir-2')
    })

    await vi.waitFor(() => expect(started).toEqual(['dir-1', 'dir-2']))
    releaseFirst()
    await Promise.all([firstRun, secondRun])
    await manager.shutdown()
  })

  it('keeps cached resources when connectionInfo fails during execution release', async () => {
    const connection = {
      dirId: 'dir-1',
      endpoint: 'ws://127.0.0.1/devtools/browser/one',
      protocol: 'cdp' as const,
      browserType: 'chromium' as const,
      connectedAt: 1,
    }
    const close = vi.fn(async () => {})
    const onIdle = vi.fn()
    const manager = new ProfileRuntimeManager({
      connections: {
        get: vi.fn(async () => connection),
        list: vi.fn(async () => {
          throw new Error('connectionInfo unavailable')
        }),
        open: vi.fn(),
      },
      createResource: vi.fn(async () => ({ tools: new Map(), close, artifactRoot: '/tmp/one' })),
      onIdle,
    })
    const binding = manager.createBinding({ bindingId: 'binding-a', executionId: 'run-a' })
    await binding.activate('dir-1')

    await manager.releaseExecution('run-a')

    expect(onIdle).toHaveBeenCalledWith('dir-1')
    expect(close).not.toHaveBeenCalled()
    await manager.shutdown()
  })

  it('invalidates cached resources when polling observes restart or close', async () => {
    const close = vi.fn(async () => {})
    const connection = {
      dirId: 'dir-1',
      endpoint: 'ws://127.0.0.1/devtools/browser/one',
      protocol: 'cdp' as const,
      browserType: 'chromium' as const,
      connectedAt: 1,
    }
    const manager = new ProfileRuntimeManager({
      connections: {
        get: vi.fn(async () => connection),
        list: vi.fn(async () => [connection]),
        open: vi.fn(),
      },
      createResource: vi.fn(async () => ({ tools: new Map(), close, artifactRoot: '/tmp/one' })),
    })
    const binding = manager.createBinding({ bindingId: 'binding-a', executionId: 'run-a' })
    await binding.activate('dir-1')

    await manager.reconcileConnections([{
      ...connection,
      endpoint: 'ws://127.0.0.1/devtools/browser/two',
      connectedAt: 2,
    }])
    expect(close).toHaveBeenCalledTimes(1)

    await manager.reconcileConnections([])
    await expect(binding.ensureActive()).rejects.toThrow(/当前没有已绑定的浏览器|已关闭/)
    await manager.shutdown()
  })
})
