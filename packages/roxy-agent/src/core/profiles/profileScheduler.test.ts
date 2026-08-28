import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import { ProfileLeaseRegistry } from './profileLeaseRegistry'
import {
  applyForceOpenPolicy,
  checkWindowScope,
  createProfileSchedulerPlugin,
  extractDirIds,
  isWindowTargetTool,
  ProfileScheduler,
} from './profileScheduler'

const PLAYWRIGHT_LAUNCH = 'mcp_roxybrowser_playwright_worker-1__roxy_browser_launch'
const PLAYWRIGHT_SNAPSHOT = 'mcp_roxybrowser_playwright_worker-1__browser_snapshot'
const PLAYWRIGHT_CLOSE = 'mcp_roxybrowser_playwright_worker-1__browser_close'
const OPENAPI_CLOSE = 'mcp_roxybrowser-openapi-mcp__roxy_profile_close'

describe('extractDirIds', () => {
  it('reads both dirId and dirIds shapes', () => {
    assert.deepEqual(extractDirIds({ dirId: 'a' }), ['a'])
    assert.deepEqual(extractDirIds({ dirIds: ['a', 'b'] }), ['a', 'b'])
    assert.deepEqual(extractDirIds({ dirId: 'a', dirIds: ['b'] }), ['a', 'b'])
    assert.deepEqual(extractDirIds({ dirIds: ['a', '', 1] }), ['a'])
    assert.deepEqual(extractDirIds(undefined), [])
  })

  it('reads dirIds from batched script run items', () => {
    assert.deepEqual(extractDirIds({ scripts: [
      { scriptPath: 'official:a', dirIds: ['a'] },
      { scriptPath: 'official:b', dirIds: ['b', 'c'] },
    ] }), ['a', 'b', 'c'])
  })
})

describe('isWindowTargetTool', () => {
  it('covers the window-opening tools', () => {
    assert.ok(isWindowTargetTool('roxy_profile_open'))
    assert.ok(isWindowTargetTool('roxy_profile_connection_info'))
    assert.ok(isWindowTargetTool('roxy_profile_close'))
    assert.ok(isWindowTargetTool('roxy_profile_delete'))
    assert.ok(isWindowTargetTool('roxy_browser_launch'))
    assert.ok(isWindowTargetTool('roxy_script_run'))
    assert.ok(!isWindowTargetTool('browser_snapshot'))
    assert.ok(isWindowTargetTool('mcp_roxybrowser_playwright_worker-1__roxy_browser_launch'))
  })
})

describe('checkWindowScope', () => {
  it('allows dirIds inside the authorized set', () => {
    assert.equal(
      checkWindowScope('roxy_browser_launch', { dirId: 'a' }, new Set(['a', 'b'])),
      undefined,
    )
  })

  it('rejects dirIds outside the authorized set', () => {
    const violation = checkWindowScope('roxy_browser_launch', { dirId: 'c' }, new Set(['a']))
    assert.deepEqual(violation, { toolName: 'roxy_browser_launch', requested: ['c'], allowed: ['a'] })
  })

  it('applies window scope checks to namespaced MCP tools', () => {
    const toolName = 'mcp_roxybrowser_playwright_worker-1__roxy_browser_launch'
    const violation = checkWindowScope(toolName, { dirId: 'dir-2' }, new Set(['dir-1']))

    assert.deepEqual(violation, { toolName, requested: ['dir-2'], allowed: ['dir-1'] })
  })

  it('rejects partial out-of-scope batches', () => {
    const violation = checkWindowScope('roxy_profile_open', { dirIds: ['a', 'z'] }, new Set(['a']))
    assert.deepEqual(violation?.requested, ['z'])
  })

  it('rejects window-target calls that omit a dirId for a bound worker', () => {
    // Regression: a worker that omitted dirId could fall through to the MCP
    // implementation and operate whichever browser it selected by default.
    // Fixed by: requiring an explicit target whenever a worker is window-bound.
    const violation = checkWindowScope('roxy_browser_launch', {}, new Set(['a']))
    assert.deepEqual(violation, { toolName: 'roxy_browser_launch', requested: ['<missing>'], allowed: ['a'] })
  })

  it('keeps profile deletion inside the authorized window scope', () => {
    assert.deepEqual(
      checkWindowScope('roxy_profile_delete', { dirIds: ['a', 'z'] }, new Set(['a'])),
      { toolName: 'roxy_profile_delete', requested: ['z'], allowed: ['a'] },
    )
  })

  it('does not restrict when no window is bound', () => {
    assert.equal(checkWindowScope('roxy_browser_launch', { dirId: 'c' }, undefined), undefined)
    assert.equal(checkWindowScope('roxy_browser_launch', { dirId: 'c' }, new Set()), undefined)
  })

  it('ignores non-window tools', () => {
    assert.equal(checkWindowScope('browser_snapshot', { dirId: 'c' }, new Set(['a'])), undefined)
  })
})

describe('applyForceOpenPolicy', () => {
  it('forces forceOpen false on opening tools', () => {
    assert.deepEqual(
      applyForceOpenPolicy('roxy_browser_launch', { dirId: 'a', forceOpen: true }),
      { dirId: 'a', forceOpen: false },
    )
    assert.deepEqual(
      applyForceOpenPolicy('roxy_profile_open', { dirIds: ['a'] }),
      { dirIds: ['a'], forceOpen: false },
    )
  })

  it('leaves other tools untouched', () => {
    const input = { dirId: 'a' }
    assert.equal(applyForceOpenPolicy('roxy_script_run', input), input)
  })
})

describe('profile scheduler plugin', () => {
  it('only monitors browser tools from the built-in Playwright MCP', async () => {
    // Regression: the broad profile middleware treated OpenAPI profile
    // management calls as browser operations, so create/delete briefly
    // appeared in the frontend browser monitor.
    // Fixed by: matching only namespaced Playwright browser tools.
    let middleware: any
    const api: any = {
      addToolMiddleware: (value: any) => {
        if (value.match?.test(PLAYWRIGHT_SNAPSHOT)) {
          middleware = value
        }
      },
      onDispose: () => {},
    }

    await createProfileSchedulerPlugin({
      ownerId: 'delete-owner',
      taskId: 'delete-task',
    }).setup(api)

    expect(middleware.match).toBeInstanceOf(RegExp)
    expect(middleware.match.test(PLAYWRIGHT_SNAPSHOT)).toBe(true)
    expect(middleware.match.test(PLAYWRIGHT_LAUNCH)).toBe(true)
    expect(middleware.match.test(PLAYWRIGHT_CLOSE)).toBe(true)
    expect(middleware.match.test('browser_snapshot')).toBe(false)
    expect(middleware.match.test('roxy_profile_open')).toBe(false)
    expect(middleware.match.test('mcp_roxybrowser-openapi-mcp__roxy_profile_delete')).toBe(false)
    expect(middleware.match.test(OPENAPI_CLOSE)).toBe(false)
  })

  it('uses OpenAPI profile close only to remove monitor state', async () => {
    // Regression: closing a profile was handled by the browser-operation
    // middleware, which emitted a synthetic monitor event for the close call.
    // Fixed by: giving OpenAPI close a dedicated state-removal middleware.
    const events: Array<{ kind: string, dirId?: string, stage?: string }> = []
    const closed: string[] = []
    let monitorMiddleware: any
    let closeMiddleware: any
    const api: any = {
      addToolMiddleware: (value: any) => {
        if (value.match?.test(PLAYWRIGHT_SNAPSHOT)) {
          monitorMiddleware = value
        }
        if (value.match?.test(OPENAPI_CLOSE)) {
          closeMiddleware = value
        }
      },
      onDispose: () => {},
    }

    const scheduler = new ProfileScheduler(new ProfileLeaseRegistry())
    await createProfileSchedulerPlugin({
      ownerId: 'close-owner',
      taskId: 'close-task',
      scheduler,
      onProfileClosed: (dirId) => {
        closed.push(dirId)
      },
      monitor: {
        attach: ({ dirId }) => events.push({ kind: 'attach', dirId }),
        event: ({ dirId, stage }) => events.push({ kind: 'event', dirId, stage }),
        finish: ({ dirId }) => events.push({ kind: 'finish', dirId }),
      },
    }).setup(api)

    expect(monitorMiddleware).toBeDefined()
    expect(closeMiddleware).toBeDefined()
    const ctx = {
      agentId: 'agent',
      sessionId: 'session',
      traceId: 'trace',
      toolName: OPENAPI_CLOSE,
      toolSource: 'mcp',
      toolUseId: 'close-call',
      callIndex: 0,
    }
    await expect(closeMiddleware.before({ dirId: 'profile-closed' }, ctx)).resolves.toEqual({ dirId: 'profile-closed' })
    await closeMiddleware.after({ toolUseId: 'close-call', content: 'closed', isError: false }, ctx)

    expect(closed).toEqual(['profile-closed'])
    expect(events).toEqual([])
    expect(scheduler.getOwner('profile-closed')).toBeUndefined()
  })

  it('serializes ownership of one profile and releases it with the agent lifecycle', async () => {
    const events: Array<{ kind: string, dirId?: string, stage?: string }> = []
    const scheduler = createProfileSchedulerPlugin({
      ownerId: 'conversation-a:turn-1',
      taskId: 'task-a',
      monitor: {
        attach: ({ dirId }) => events.push({ kind: 'attach', dirId }),
        event: ({ dirId, stage }) => events.push({ kind: 'event', dirId, stage }),
        finish: ({ dirId }) => events.push({ kind: 'finish', dirId }),
      },
    })
    const second = createProfileSchedulerPlugin({ ownerId: 'conversation-b:turn-1' })
    const firstApi: any = { addToolMiddleware: (middleware: any) => {
      firstApi.middleware = middleware
    }, onDispose: (fn: () => Promise<void>) => {
      firstApi.dispose = fn
    } }
    const secondApi: any = { addToolMiddleware: (middleware: any) => {
      secondApi.middleware = middleware
    }, onDispose: (fn: () => Promise<void>) => {
      secondApi.dispose = fn
    } }

    await scheduler.setup(firstApi)
    await second.setup(secondApi)

    const ctx = { agentId: 'agent-a', sessionId: 'conversation-a', traceId: 'trace-a', toolName: PLAYWRIGHT_LAUNCH, toolSource: 'mcp', toolUseId: 'call-a', callIndex: 0 }
    const input = await firstApi.middleware.before({ dirId: 'profile-1', forceOpen: true }, ctx)
    expect(input).toEqual({ dirId: 'profile-1', forceOpen: false })
    await firstApi.middleware.after({ toolUseId: 'call-a', content: 'connected', isError: false }, ctx)
    expect(events).toEqual([
      { kind: 'attach', dirId: 'profile-1' },
      { kind: 'event', dirId: 'profile-1', stage: 'start' },
      { kind: 'event', dirId: 'profile-1', stage: 'end' },
    ])

    await expect(secondApi.middleware.before({ dirId: 'profile-1' }, { ...ctx, toolUseId: 'call-b' }))
      .rejects
      .toThrow(/正在被其他会话操作/)

    // Same owner may issue sequential operations without deadlocking itself.
    await expect(firstApi.middleware.before({ dirId: 'profile-1' }, { ...ctx, toolUseId: 'call-c' })).resolves.toEqual({ dirId: 'profile-1', forceOpen: false })
    await firstApi.dispose()
    expect(events.at(-1)).toEqual({ kind: 'finish', dirId: 'profile-1' })
    await expect(secondApi.middleware.before({ dirId: 'profile-1' }, { ...ctx, toolUseId: 'call-d' })).resolves.toEqual({ dirId: 'profile-1', forceOpen: false })
    await secondApi.dispose()
  })

  it('uses the owner profile for browser tools that omit dirId after binding', async () => {
    const scheduler = createProfileSchedulerPlugin({ ownerId: 'conversation-a:turn-2' })
    const api: any = { addToolMiddleware: (middleware: any) => {
      api.middleware = middleware
    }, onDispose: (fn: () => Promise<void>) => {
      api.dispose = fn
    } }
    await scheduler.setup(api)
    const ctx = { agentId: 'agent-a', sessionId: 'conversation-a', traceId: 'trace-a', toolName: PLAYWRIGHT_SNAPSHOT, toolSource: 'mcp', toolUseId: 'call-a', callIndex: 0 }

    await api.middleware.before({ dirId: 'profile-2' }, ctx)
    await expect(api.middleware.before({}, { ...ctx, toolUseId: 'call-b' })).resolves.toEqual({})
    await api.dispose()
  })

  it('keeps an independent active profile for parallel workers sharing one execution owner', async () => {
    const scheduler = new ProfileScheduler(new ProfileLeaseRegistry())
    const workerA = createProfileSchedulerPlugin({
      ownerId: 'shared-execution',
      workerId: 'worker-a',
      allowedDirIds: ['profile-a'],
      scheduler,
    })
    const workerB = createProfileSchedulerPlugin({
      ownerId: 'shared-execution',
      workerId: 'worker-b',
      allowedDirIds: ['profile-b'],
      scheduler,
    })
    const apiA: any = { addToolMiddleware: (middleware: any) => {
      apiA.middleware = middleware
    }, onDispose: () => {} }
    const apiB: any = { addToolMiddleware: (middleware: any) => {
      apiB.middleware = middleware
    }, onDispose: () => {} }
    await workerA.setup(apiA)
    await workerB.setup(apiB)

    const baseCtx = {
      agentId: 'agent',
      sessionId: 'conversation',
      traceId: 'trace',
      toolSource: 'mcp',
      callIndex: 0,
    }
    await apiA.middleware.before(
      { dirId: 'profile-a' },
      { ...baseCtx, toolName: PLAYWRIGHT_LAUNCH, toolUseId: 'launch-a' },
    )
    await apiB.middleware.before(
      { dirId: 'profile-b' },
      { ...baseCtx, toolName: PLAYWRIGHT_LAUNCH.replace('worker-1', 'worker-2'), toolUseId: 'launch-b' },
    )

    await expect(apiA.middleware.before(
      {},
      { ...baseCtx, toolName: PLAYWRIGHT_SNAPSHOT, toolUseId: 'snapshot-a' },
    )).resolves.toEqual({})
    await expect(apiB.middleware.before(
      {},
      { ...baseCtx, toolName: PLAYWRIGHT_SNAPSHOT.replace('worker-1', 'worker-2'), toolUseId: 'snapshot-b' },
    )).resolves.toEqual({})
  })

  it('publishes a monitor error when a profile lease blocks a tool call', async () => {
    const schedulerA = createProfileSchedulerPlugin({ ownerId: 'owner-a', taskId: 'task-a' })
    const errors: Array<{ stage: string, success: boolean }> = []
    const schedulerB = createProfileSchedulerPlugin({
      ownerId: 'owner-b',
      taskId: 'task-b',
      monitor: {
        attach: () => {},
        event: ({ stage, success }) => errors.push({ stage, success }),
        finish: () => {},
      },
    })
    const apiA: any = { addToolMiddleware: (middleware: any) => {
      apiA.middleware = middleware
    }, onDispose: (fn: any) => {
      apiA.dispose = fn
    } }
    const apiB: any = { addToolMiddleware: (middleware: any) => {
      apiB.middleware = middleware
    }, onDispose: () => {} }
    await schedulerA.setup(apiA)
    await schedulerB.setup(apiB)
    const ctx = { agentId: 'agent', sessionId: 'session', traceId: 'trace', toolName: PLAYWRIGHT_LAUNCH, toolSource: 'mcp', toolUseId: 'call', callIndex: 0 }

    await apiA.middleware.before({ dirId: 'profile-locked' }, ctx)
    await expect(apiB.middleware.before({ dirId: 'profile-locked' }, { ...ctx, toolUseId: 'blocked' })).rejects.toThrow()
    expect(errors).toContainEqual({ stage: 'error', success: false })
    await apiA.dispose()
  })

  it('uses a worker-scoped browser session id for frontend grouping', async () => {
    const attached: string[] = []
    const plugin = createProfileSchedulerPlugin({
      ownerId: 'worker-owner',
      taskId: 'task-worker',
      workerId: 'worker-7',
      monitor: {
        attach: ({ browserId }) => attached.push(browserId),
        event: () => {},
        finish: () => {},
      },
    })
    const api: any = { addToolMiddleware: (middleware: any) => {
      api.middleware = middleware
    }, onDispose: (fn: any) => {
      api.dispose = fn
    } }
    await plugin.setup(api)
    const ctx = { agentId: 'agent', sessionId: 'session', traceId: 'trace', toolName: PLAYWRIGHT_LAUNCH, toolSource: 'mcp', toolUseId: 'call', callIndex: 0 }
    await api.middleware.before({ dirId: 'profile-shared' }, ctx)
    expect(attached).toEqual(['worker-7:profile-shared'])
    await api.dispose()
  })
})
