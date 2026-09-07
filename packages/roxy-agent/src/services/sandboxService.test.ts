import type { SandboxHostRunResult, SandboxRunPayload } from '@/core/sandbox/host-protocol'
import assert from 'node:assert/strict'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it, vi } from 'vitest'

const { profilesOpen, profilesConnectionInfo, transportRequest, RoxyBrowserClient } = vi.hoisted(() => ({
  profilesOpen: vi.fn(),
  profilesConnectionInfo: vi.fn(),
  transportRequest: vi.fn(),
  // 生产代码通过 `new` 构造 RoxyBrowserClient，因此测试桩需要保留构造函数形态。
  // eslint-disable-next-line prefer-arrow-callback
  RoxyBrowserClient: vi.fn().mockImplementation(function () {
    return {
      profiles: {
        open: profilesOpen,
        connectionInfo: profilesConnectionInfo,
      },
      api: {
        transport: {
          workspaceId: 42,
          request: transportRequest,
        },
      },
    }
  }),
}))

vi.mock('@roxybrowser/openapi', () => ({ RoxyBrowserClient }))

const reserve = vi.fn()
const publishTaskMonitorBrowserAttached = vi.fn()
const publishTaskMonitorBrowserEvent = vi.fn()
const publishTaskMonitorBrowserFinished = vi.fn()

vi.mock('./sandboxHostManager', () => ({
  sandboxHostManager: { reserve, shutdown: vi.fn() },
}))

vi.mock('@/core/task-monitor', () => ({
  publishTaskMonitorBrowserAttached,
  publishTaskMonitorBrowserEvent,
  publishTaskMonitorBrowserFinished,
}))

interface HostHarness {
  payload?: SandboxRunPayload
  runId?: string
  handlers?: { onLog?: (event: { level: string, message: string, runId: string }) => void }
  resolve: (result: SandboxHostRunResult) => void
  reject: (error: Error) => void
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  release: ReturnType<typeof vi.fn>
}

function createHostHarness(): HostHarness {
  let resolve!: (result: SandboxHostRunResult) => void
  let reject!: (error: Error) => void
  const finished = new Promise<SandboxHostRunResult>((res, rej) => {
    resolve = res
    reject = rej
  })
  const harness = {} as HostHarness
  const stop = vi.fn()
  const release = vi.fn()
  const start = vi.fn(async (runId: string, payload: SandboxRunPayload, handlers: HostHarness['handlers']) => {
    harness.runId = runId
    harness.payload = payload
    harness.handlers = handlers
    return { finished, stop }
  })
  Object.assign(harness, { resolve, reject, start, stop, release })
  reserve.mockResolvedValue({ start, release })
  return harness
}

async function createTempRun(prefix: string): Promise<{
  root: string
  outputDir: string
  logFilePath: string
  permissionsFile: string
}> {
  const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), prefix))
  return {
    root,
    outputDir: path.join(root, 'output'),
    logFilePath: path.join(root, 'logs', 'run.log'),
    permissionsFile: path.join(root, 'missing.permissions.json'),
  }
}

beforeEach(() => {
  vi.resetModules()
  reserve.mockReset()
  profilesOpen.mockReset()
  profilesConnectionInfo.mockReset()
  transportRequest.mockReset()
  publishTaskMonitorBrowserAttached.mockReset()
  publishTaskMonitorBrowserEvent.mockReset()
  publishTaskMonitorBrowserFinished.mockReset()
  process.env.ROXY_WORKSPACE_ID = '42'
  process.env.ROXY_API_HOST = 'http://127.0.0.1:26580'
  process.env.ROXY_API_KEY = 'api-key'
  process.env.AGENT_SCRIPT_PATH = '/tmp/roxy-agent.mjs'
  process.env.ENV_TYPE = 'production'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('opens Chromium after reserving a Host slot and sends a structured run payload', async () => {
  const temp = await createTempRun('roxy-sandbox-browser-')
  const host = createHostHarness()
  profilesConnectionInfo.mockResolvedValueOnce([])
  profilesOpen.mockResolvedValueOnce({ ws: 'ws://127.0.0.1/devtools/browser/abc' })

  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    const launched: string[] = []
    const run = await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      dirId: 'profile-1',
      runId: 'run-1',
      outputDir: temp.outputDir,
      logFilePath: temp.logFilePath,
      permissionsFile: temp.permissionsFile,
      onBrowserLaunched: dirId => launched.push(dirId),
    })

    assert.equal(reserve.mock.calls.length, 1)
    assert.equal(host.runId, 'run-1')
    assert.equal(host.payload?.browserUrl, 'ws://127.0.0.1/devtools/browser/abc')
    assert.equal(host.payload?.browserType, 'chromium')
    assert.equal(host.payload?.outputDir, temp.outputDir)
    assert.equal(host.payload?.logFilePath, temp.logFilePath)
    assert.equal(host.payload?.scriptPath, '/tmp/script.ts')
    assert.equal(run.browserType, 'chromium')
    assert.equal(RoxyBrowserClient.mock.calls[0]?.[0].baseUrl, 'http://127.0.0.1:26580')
    assert.equal(RoxyBrowserClient.mock.calls[0]?.[0].apiKey, 'api-key')
    assert.equal(RoxyBrowserClient.mock.calls[0]?.[0].workspaceId, 42)
    assert.deepEqual(profilesConnectionInfo.mock.calls, [[['profile-1']]])
    assert.deepEqual(profilesOpen.mock.calls, [['profile-1', { forceOpen: true }]])
    assert.deepEqual(launched, ['profile-1'])

    host.resolve({ status: 'done', exitCode: 0, artifactPaths: [], storageChanges: [] })
    assert.equal((await run.finished).status, 'done')
  }
  finally {
    await fsPromises.rm(temp.root, { recursive: true, force: true })
  }
})

it('opens all target windows through agent/open and waits for core download and launch', async () => {
  transportRequest
    .mockResolvedValueOnce({
      code: 0,
      data: {
        rows: [
          { dirId: 'profile-1', success: true, status: 'opened', launchInfo: { ws: 'ws://127.0.0.1/devtools/browser/one' } },
          { dirId: 'profile-2', success: true, status: 'core_downloading' },
        ],
      },
      msg: '',
    })
    .mockResolvedValueOnce({
      code: 0,
      data: [
        { dirId: 'profile-1', success: true, status: 'opened', ws: 'ws://127.0.0.1/devtools/browser/one' },
        { dirId: 'profile-2', success: true, status: 'launching' },
      ],
      msg: '',
    })
    .mockResolvedValueOnce({
      code: 0,
      data: [
        { dirId: 'profile-1', success: true, status: 'opened', ws: 'ws://127.0.0.1/devtools/browser/one' },
        { dirId: 'profile-2', success: true, status: 'opened', launchInfo: { ws: 'ws://127.0.0.1/devtools/browser/two' } },
      ],
      msg: '',
    })

  const { openBrowsersForDirIds } = await import('./sandboxService')
  const launched: string[] = []
  const connections = await openBrowsersForDirIds(['profile-1', 'profile-2'], {
    layout: 'grid',
    onBrowserLaunched: dirId => launched.push(dirId),
  })

  assert.deepEqual([...connections.entries()], [
    ['profile-1', { ws: 'ws://127.0.0.1/devtools/browser/one', browserType: 'chromium' }],
    ['profile-2', { ws: 'ws://127.0.0.1/devtools/browser/two', browserType: 'chromium' }],
  ])
  assert.deepEqual(launched, ['profile-1', 'profile-2'])
  assert.deepEqual(transportRequest.mock.calls.map(([request]) => request), [
    {
      method: 'POST',
      path: '/browser/agent/open',
      params: { workspaceId: 42, dirIds: ['profile-1', 'profile-2'], forceOpen: false, layout: 'grid' },
    },
    {
      method: 'GET',
      path: '/browser/agent/open_status',
      params: { dirIds: ['profile-1', 'profile-2'] },
    },
    {
      method: 'GET',
      path: '/browser/agent/open_status',
      params: { dirIds: ['profile-1', 'profile-2'] },
    },
  ])
})

it('preserves return values, artifacts and categorized storage outputs', async () => {
  const temp = await createTempRun('roxy-sandbox-output-')
  const host = createHostHarness()
  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    const run = await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      runId: 'run-output',
      outputDir: temp.outputDir,
      logFilePath: temp.logFilePath,
      permissionsFile: temp.permissionsFile,
    })

    const csv = path.join(temp.outputDir, 'rows.csv')
    const kv = path.join(temp.outputDir, 'state.kv.json')
    await fsPromises.mkdir(temp.outputDir, { recursive: true })
    await fsPromises.writeFile(csv, 'id\n1\n')
    await fsPromises.writeFile(kv, '{"ok":true}')
    await fsPromises.mkdir(path.dirname(temp.logFilePath), { recursive: true })
    await fsPromises.writeFile(temp.logFilePath, 'run log\n')
    host.resolve({
      status: 'done',
      exitCode: 0,
      returnValue: 'ok',
      artifactPaths: [csv, kv],
      storageChanges: [
        { type: 'table', name: 'rows', path: csv, operations: [{ action: 'append', count: 1, rowCount: 1 }] },
        { type: 'kv', name: 'state', path: kv, operations: [{ action: 'set', count: 1 }] },
      ],
    })

    const result = await run.finished
    assert.equal(result.returnValue, 'ok')
    assert.deepEqual(result.artifacts.map(item => item.localPath).sort(), [csv, kv].sort())
    assert.deepEqual(result.outputs, [
      { type: 'log', path: temp.logFilePath, changeType: 'created' },
      { type: 'kv', path: kv, changeType: 'created', operations: [{ action: 'set', count: 1 }] },
      { type: 'table', path: csv, changeType: 'created', operations: [{ action: 'append', count: 1, rowCount: 1 }] },
    ])
  }
  finally {
    await fsPromises.rm(temp.root, { recursive: true, force: true })
  }
})

it('streams Host run logs to the caller', async () => {
  const temp = await createTempRun('roxy-sandbox-log-')
  const host = createHostHarness()
  const logs: unknown[] = []
  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    const run = await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      runId: 'run-log',
      outputDir: temp.outputDir,
      logFilePath: temp.logFilePath,
      permissionsFile: temp.permissionsFile,
      onLog: event => logs.push(event),
    })
    host.handlers?.onLog?.({ level: 'info', message: 'progress', runId: 'run-log' })
    host.resolve({ status: 'done', exitCode: 0, artifactPaths: [], storageChanges: [] })
    await run.finished
    assert.deepEqual(logs, [{ level: 'info', message: 'progress', runId: 'run-log' }])
  }
  finally {
    await fsPromises.rm(temp.root, { recursive: true, force: true })
  }
})

it('preserves Host failure error details on the finished result', async () => {
  const temp = await createTempRun('roxy-sandbox-error-')
  const host = createHostHarness()
  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    const run = await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      runId: 'run-error',
      outputDir: temp.outputDir,
      logFilePath: temp.logFilePath,
      permissionsFile: temp.permissionsFile,
    })
    host.resolve({
      status: 'failed',
      exitCode: 1,
      error: 'TypeError: labelRe.test is not a function',
      artifactPaths: [],
      storageChanges: [],
    })
    const result = await run.finished
    assert.equal(result.status, 'failed')
    assert.equal(result.error, 'TypeError: labelRe.test is not a function')
  }
  finally {
    await fsPromises.rm(temp.root, { recursive: true, force: true })
  }
})

it('maps LoginRequired to failure and publishes one monitored terminal event', async () => {
  const temp = await createTempRun('roxy-sandbox-monitor-')
  const host = createHostHarness()
  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    const run = await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      dirId: 'profile-1',
      runId: 'run-login',
      outputDir: temp.outputDir,
      logFilePath: temp.logFilePath,
      permissionsFile: temp.permissionsFile,
      taskMonitor: { taskId: 'task-1', browserId: 'profile-1' },
    })
    host.resolve({
      status: 'done',
      exitCode: 0,
      returnValue: 'LoginRequired',
      artifactPaths: [],
      storageChanges: [],
    })
    const result = await run.finished
    assert.equal(result.status, 'failed')
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls.at(-1)?.[0].stage, 'error')
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls.at(-1)?.[0].errorMessage, 'LoginRequired')
    assert.equal(publishTaskMonitorBrowserFinished.mock.calls.length, 1)
  }
  finally {
    await fsPromises.rm(temp.root, { recursive: true, force: true })
  }
})

it('forwards stop to the active Host run', async () => {
  const temp = await createTempRun('roxy-sandbox-stop-')
  const host = createHostHarness()
  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    const run = await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      outputDir: temp.outputDir,
      logFilePath: temp.logFilePath,
      permissionsFile: temp.permissionsFile,
    })
    run.stop()
    assert.deepEqual(host.stop.mock.calls, [['user']])
    host.resolve({ status: 'timeout', exitCode: 124, artifactPaths: [], storageChanges: [] })
    await run.finished
  }
  finally {
    await fsPromises.rm(temp.root, { recursive: true, force: true })
  }
})

it('allows Firefox before starting a Host run', async () => {
  const temp = await createTempRun('roxy-sandbox-firefox-')
  const host = createHostHarness()
  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    const run = await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/session/firefox',
      browserType: 'firefox',
      outputDir: temp.outputDir,
      logFilePath: temp.logFilePath,
      permissionsFile: temp.permissionsFile,
    })
    assert.equal(host.start.mock.calls.length, 1)
    assert.equal(host.payload?.browserType, 'firefox')
    assert.equal(run.browserType, 'firefox')
    host.resolve({ status: 'done', exitCode: 0, artifactPaths: [], storageChanges: [] })
    await run.finished
  }
  finally {
    await fsPromises.rm(temp.root, { recursive: true, force: true })
  }
})

it('rejects untrusted remote scripts before reserving or opening a browser', async () => {
  vi.stubGlobal('fetch', vi.fn())
  const { startSandboxScriptRun } = await import('./sandboxService')
  await assert.rejects(() => startSandboxScriptRun({
    scriptPath: 'https://example.com/script.ts',
    dirId: 'profile-1',
  }), /Remote script host is not allowed/)
  assert.equal(reserve.mock.calls.length, 0)
  assert.equal((fetch as any).mock.calls.length, 0)
})

it('rejects malformed permission manifests before reserving the Host', async () => {
  const temp = await createTempRun('roxy-sandbox-permission-')
  await fsPromises.writeFile(temp.permissionsFile, JSON.stringify({ version: 2 }))
  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    await assert.rejects(() => startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      outputDir: temp.outputDir,
      logFilePath: temp.logFilePath,
      permissionsFile: temp.permissionsFile,
    }), /Invalid script permissions/)
    assert.equal(reserve.mock.calls.length, 0)
  }
  finally {
    await fsPromises.rm(temp.root, { recursive: true, force: true })
  }
})

it('rejects a sandbox run while another Agent execution owns the same profile', async () => {
  const temp = await createTempRun('roxy-sandbox-shared-lease-')
  const host = createHostHarness()
  const { profileLeaseRegistry } = await import('@/core/profiles/profileLeaseRegistry')
  profileLeaseRegistry.acquire({ executionId: 'agent-run', sourceType: 'chat' }, ['profile-1'])
  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    await assert.rejects(() => startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      dirId: 'profile-1',
      outputDir: temp.outputDir,
      logFilePath: temp.logFilePath,
      permissionsFile: temp.permissionsFile,
    }), /正在被其他会话操作/)
    assert.equal(host.start.mock.calls.length, 0)
    assert.equal(host.release.mock.calls.length, 1)
  }
  finally {
    profileLeaseRegistry.clear()
    await fsPromises.rm(temp.root, { recursive: true, force: true })
  }
})

it('does not publish a transient browser monitor entry when Host startup fails', async () => {
  // Regression: monitoring published a browser attachment before the Host had
  // started, so the panel flashed open for a browser connection that never existed.
  // Fixed by: publish monitor lifecycle events only after Sandbox startup succeeds.
  const temp = await createTempRun('roxy-sandbox-start-failure-')
  const host = createHostHarness()
  host.start.mockRejectedValueOnce(new Error('host failed'))
  try {
    const { getOccupiedSandboxDirIds, startSandboxScriptRun } = await import('./sandboxService')
    await assert.rejects(() => startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      dirId: 'profile-1',
      outputDir: temp.outputDir,
      logFilePath: temp.logFilePath,
      permissionsFile: temp.permissionsFile,
      taskMonitor: { taskId: 'task-failure', browserId: 'profile-1' },
    }), /host failed/)
    assert.deepEqual(getOccupiedSandboxDirIds(), [])
    assert.equal(host.release.mock.calls.length, 1)
    assert.equal(publishTaskMonitorBrowserAttached.mock.calls.length, 0)
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls.length, 0)
    assert.equal(publishTaskMonitorBrowserFinished.mock.calls.length, 0)
  }
  finally {
    await fsPromises.rm(temp.root, { recursive: true, force: true })
  }
})
