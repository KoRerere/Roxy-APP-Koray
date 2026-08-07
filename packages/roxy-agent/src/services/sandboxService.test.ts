import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, it, vi } from 'vitest'

const fork = vi.fn()
const publishTaskMonitorBrowserAttached = vi.fn()
const publishTaskMonitorBrowserEvent = vi.fn()
const publishTaskMonitorBrowserFinished = vi.fn()

vi.mock('node:child_process', () => ({
  fork,
}))

vi.mock('@/core/task-monitor', () => ({
  publishTaskMonitorBrowserAttached,
  publishTaskMonitorBrowserEvent,
  publishTaskMonitorBrowserFinished,
}))

beforeEach(() => {
  vi.resetModules()
  fork.mockReset()
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

it('injects the opened browser websocket as BROWSER_URL', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-browser-env-'))
  const worker = new EventEmitter() as any
  worker.stdout = new PassThrough()
  worker.stderr = new PassThrough()
  worker.kill = vi.fn()
  fork.mockReturnValue(worker)

  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({
      code: 0,
      data: [{ dirId: 'profile-1', ws: 'ws://127.0.0.1/devtools/browser/abc' }],
    }),
  })))

  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      scriptSha512: 'a'.repeat(128),
      dirId: 'profile-1',
      runId: 'run_test_123',
      outputDir: path.join(tempDir, 'workdir'),
      logFilePath: path.join(tempDir, 'logs', 'run.log'),
      permissionsFile: path.join(tempDir, 'missing.permissions.json'),
    })

    const forkEnv = fork.mock.calls[0][2].env
    const today = new Date()
    const dayStamp = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')
    const browserOutputDir = path.join(tempDir, 'workdir', 'browser', dayStamp)
    assert.equal(forkEnv.BROWSER_URL, 'ws://127.0.0.1/devtools/browser/abc')
    assert.equal(forkEnv.BROWSER_TYPE, 'chromium')
    assert.equal(forkEnv.SANDBOX_SCRIPT_SHA512, 'a'.repeat(128))
    assert.equal(forkEnv.SANDBOX_LOGS_DIR, path.join(tempDir, 'logs'))
    assert.equal(forkEnv.SANDBOX_DEBUG, '0')
    assert.equal(forkEnv.ROXY_PLAYWRIGHT_SCREENSHOTS_DIR, browserOutputDir)
    assert.equal(forkEnv.SANDBOX_OUTPUT_DIR, path.join(tempDir, 'workdir'))
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('publishes task monitor events around the shared sandbox execution boundary', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-task-monitor-'))
  const worker = new EventEmitter() as any
  worker.stdout = new PassThrough()
  worker.stderr = new PassThrough()
  worker.kill = vi.fn()
  fork.mockReturnValue(worker)

  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    const run = await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      browserType: 'chromium',
      dirId: 'profile-1',
      runId: 'run_task_monitor',
      outputDir: path.join(tempDir, 'output'),
      logFilePath: path.join(tempDir, 'logs', 'run.log'),
      taskMonitor: {
        taskId: 'task-1',
        browserId: 'profile-1',
        label: 'profile-1',
        input: { scriptPath: 'official-script', dirId: 'profile-1', debug: false },
      },
    })

    assert.deepEqual(publishTaskMonitorBrowserAttached.mock.calls, [
      [{ taskId: 'task-1', browserId: 'profile-1', dirId: 'profile-1', label: 'profile-1' }],
      [{
        taskId: 'task-1',
        browserId: 'profile-1',
        dirId: 'profile-1',
        label: 'profile-1',
        ws: 'ws://127.0.0.1/devtools/browser/abc',
        browserType: 'chromium',
      }],
    ])
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[0]?.[0].stage, 'start')
    assert.deepEqual(publishTaskMonitorBrowserEvent.mock.calls[0]?.[0].input, {
      scriptPath: 'official-script',
      dirId: 'profile-1',
      debug: false,
    })

    worker.emit('close', 0, null)
    const result = await run.finished

    assert.equal(result.status, 'done')
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[1]?.[0].stage, 'end')
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[1]?.[0].result, 'done')
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[1]?.[0].success, true)
    assert.deepEqual(publishTaskMonitorBrowserFinished.mock.calls, [[{
      taskId: 'task-1',
      browserId: 'profile-1',
      dirId: 'profile-1',
    }]])
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('returns the script main value and reports LoginRequired as a monitored failure', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-script-result-'))
  const worker = new EventEmitter() as any
  worker.stdout = new PassThrough()
  worker.stderr = new PassThrough()
  worker.kill = vi.fn()
  fork.mockReturnValue(worker)

  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    const run = await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      dirId: 'profile-1',
      runId: 'run_login_required',
      outputDir: path.join(tempDir, 'output'),
      logFilePath: path.join(tempDir, 'logs', 'run.log'),
      taskMonitor: {
        taskId: 'task-login-required',
        browserId: 'profile-1',
      },
    })

    worker.emit('message', {
      type: 'script_result',
      runId: 'run_login_required',
      returnValue: 'LoginRequired',
    })
    worker.emit('close', 0, null)

    const result = await run.finished
    assert.equal(result.status, 'failed')
    assert.equal(result.returnValue, 'LoginRequired')
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[1]?.[0].stage, 'error')
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[1]?.[0].result, 'LoginRequired')
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[1]?.[0].success, false)
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[1]?.[0].errorMessage, 'LoginRequired')
    assert.deepEqual(publishTaskMonitorBrowserFinished.mock.calls, [[{
      taskId: 'task-login-required',
      browserId: 'profile-1',
      dirId: 'profile-1',
    }]])
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('captures direct child stdout and stderr in the script log', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-log-'))
  const logFilePath = path.join(tempDir, 'run.log')
  const outputDir = path.join(tempDir, 'output')
  const worker = new EventEmitter() as any
  worker.stdout = new PassThrough()
  worker.stderr = new PassThrough()
  worker.kill = vi.fn()
  fork.mockReturnValue(worker)

  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    const run = await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      runId: 'run_log_test',
      outputDir,
      logFilePath,
    })

    worker.stdout.end('native stdout message\n')
    worker.stderr.end('native stderr message\n')
    await new Promise(resolve => setImmediate(resolve))
    worker.emit('close', 1, null)

    const log = await fsPromises.readFile(logFilePath, 'utf-8')
    assert.match(log, /\[sandbox stdout\] native stdout message/)
    assert.match(log, /\[sandbox stderr\] native stderr message/)
    assert.deepEqual(await run.finished, {
      status: 'failed',
      exitCode: 1,
      artifacts: [],
      outputs: [{ type: 'log', path: logFilePath, changeType: 'created' }],
      logFilePath,
    })
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('returns categorized run outputs for the current sandbox run', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-outputs-'))
  const logFilePath = path.join(tempDir, 'output', 'logs', 'run.log')
  const outputDir = path.join(tempDir, 'output')
  const worker = new EventEmitter() as any
  worker.stdout = new PassThrough()
  worker.stderr = new PassThrough()
  worker.kill = vi.fn()
  fork.mockReturnValue(worker)

  try {
    const oldKvPath = path.join(outputDir, 'old.kv.json')
    const stateKvPath = path.join(outputDir, 'state.kv.json')
    await fsPromises.mkdir(outputDir, { recursive: true })
    await fsPromises.writeFile(oldKvPath, '{}', 'utf-8')
    await fsPromises.writeFile(stateKvPath, '{"before":true}', 'utf-8')
    const oldDate = new Date(Date.now() - 10_000)
    await fsPromises.utimes(oldKvPath, oldDate, oldDate)
    await fsPromises.utimes(stateKvPath, oldDate, oldDate)

    const { startSandboxScriptRun } = await import('./sandboxService')
    const run = await startSandboxScriptRun({
      scriptPath: '/tmp/script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      runId: 'run_outputs_test',
      outputDir,
      logFilePath,
    })

    await fsPromises.writeFile(stateKvPath, '{"ok":true}', 'utf-8')
    await fsPromises.writeFile(path.join(outputDir, 'rows.csv'), 'id\n1\n', 'utf-8')
    await fsPromises.mkdir(path.dirname(logFilePath), { recursive: true })
    await fsPromises.writeFile(logFilePath, 'run log\n', 'utf-8')
    worker.emit('message', {
      type: 'script_artifacts',
      runId: 'run_outputs_test',
      paths: [stateKvPath, path.join(outputDir, 'rows.csv')],
      changes: [
        {
          type: 'kv',
          path: stateKvPath,
          name: 'state',
          operations: [
            { action: 'set', count: 2 },
            { action: 'delete', count: 1 },
          ],
        },
        {
          type: 'table',
          path: path.join(outputDir, 'rows.csv'),
          name: 'rows',
          operations: [{ action: 'append', count: 1, rowCount: 1 }],
        },
      ],
    })
    worker.emit('close', 0, null)

    const result = await run.finished
    assert.deepEqual(result.outputs, [
      { type: 'log', path: logFilePath, changeType: 'created' },
      {
        type: 'kv',
        path: stateKvPath,
        changeType: 'modified',
        operations: [
          { action: 'set', count: 2 },
          { action: 'delete', count: 1 },
        ],
      },
      {
        type: 'table',
        path: path.join(outputDir, 'rows.csv'),
        changeType: 'created',
        operations: [{ action: 'append', count: 1, rowCount: 1 }],
      },
    ])
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('maps the manifest and workdir to Node filesystem permission flags', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-flags-'))
  const permissionsFile = path.join(tempDir, 'script.permissions.json')
  await fsPromises.writeFile(permissionsFile, JSON.stringify({
    version: 1,
    fs: { read: ['/Users/foo/data/', '/abs/path/to/'] },
    fetch: { allow: [] },
  }))
  const worker = new EventEmitter() as any
  worker.stdout = new PassThrough()
  worker.stderr = new PassThrough()
  worker.kill = vi.fn()
  fork.mockReturnValue(worker)

  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({
      code: 0,
      data: [{ dirId: 'profile-1', ws: 'ws://127.0.0.1/devtools/browser/abc' }],
    }),
  })))

  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    await startSandboxScriptRun({
      scriptPath: '/tmp/source-script.ts',
      dirId: 'profile-1',
      runId: 'run_test_permissions',
      outputDir: '/tmp/roxy-script-output',
      logFilePath: '/tmp/roxy-script-logs/run.log',
      permissionsFile,
    })

    const execArgv = fork.mock.calls[0][2].execArgv
    assert.ok(execArgv.includes('--permission'))
    assert.equal(execArgv.includes('--allow-child-process'), false)
    assert.equal(execArgv.includes('--allow-worker'), false)

    const writeFlags = execArgv.filter((arg: string) => arg.startsWith('--allow-fs-write='))
    assert.deepEqual(writeFlags, [
      '--allow-fs-write=/tmp/roxy-script-output',
      '--allow-fs-write=/tmp/roxy-script-logs',
    ])

    const readFlags = execArgv.filter((arg: string) => arg.startsWith('--allow-fs-read='))
    assert.deepEqual(readFlags, [
      '--allow-fs-read=/tmp/roxy-agent.mjs',
      '--allow-fs-read=/tmp',
      '--allow-fs-read=/tmp/roxy-script-output',
      '--allow-fs-read=/tmp/source-script.ts',
      '--allow-fs-read=/Users/foo/data/',
      '--allow-fs-read=/abs/path/to/',
    ])
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('does not widen filesystem permissions in development', async () => {
  const worker = new EventEmitter() as any
  worker.stdout = new PassThrough()
  worker.stderr = new PassThrough()
  worker.kill = vi.fn()
  fork.mockReturnValue(worker)
  process.env.ENV_TYPE = 'development'

  const { startSandboxScriptRun } = await import('./sandboxService')
  await startSandboxScriptRun({
    scriptPath: '/tmp/source-script.ts',
    browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
    runId: 'run_test_dependency_reads',
    outputDir: '/tmp/roxy-script-output',
    logFilePath: '/tmp/roxy-script-logs/run.log',
  })

  const execArgv = fork.mock.calls[0][2].execArgv
  assert.ok(execArgv.includes('--permission'))
  assert.equal(execArgv.includes('--allow-fs-read=*'), false)
  assert.ok(execArgv.includes('--allow-fs-read=/tmp/roxy-script-output'))
  assert.equal(execArgv.some((arg: string) => arg.startsWith('--allow-fs-write=')), true)
})

it('allowlists node_modules dirs reachable from the entry bundle for dependency resolution', async () => {
  // dev 入口（dist-vite/agent.mjs）externalize axios 等依赖，ESM resolver 需读取其 node_modules 下的 package.json。
  const entryDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-entry-'))
  const entryNodeModules = path.join(entryDir, 'node_modules')
  await fsPromises.mkdir(entryNodeModules)
  process.env.AGENT_SCRIPT_PATH = path.join(entryDir, 'agent.mjs')

  const worker = new EventEmitter() as any
  worker.stdout = new PassThrough()
  worker.stderr = new PassThrough()
  worker.kill = vi.fn()
  fork.mockReturnValue(worker)

  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    await startSandboxScriptRun({
      scriptPath: '/tmp/source-script.ts',
      browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
      runId: 'run_test_node_modules_reads',
      outputDir: '/tmp/roxy-script-output',
      logFilePath: '/tmp/roxy-script-logs/run.log',
    })

    const execArgv = fork.mock.calls[0][2].execArgv
    assert.ok(execArgv.includes(`--allow-fs-read=${entryNodeModules}`))
  }
  finally {
    await fsPromises.rm(entryDir, { recursive: true, force: true })
  }
})

it('rejects an untrusted remote script before opening a browser', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('fetch should not be called for untrusted script URLs')
  }))

  const { startSandboxScriptRun } = await import('./sandboxService')

  await assert.rejects(
    () => startSandboxScriptRun({
      scriptPath: 'https://example.com/scripts/remote-script.ts',
      dirId: 'profile-1',
      runId: 'run_test_456',
    }),
    /Remote script host is not allowed/,
  )

  assert.equal(fork.mock.calls.length, 0)
  assert.equal((fetch as any).mock.calls.length, 0)

  vi.unstubAllGlobals()
})

it('rejects a malformed script permission manifest before forking the sandbox', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-permissions-'))
  const permissionsFile = path.join(tempDir, 'script.permissions.json')
  await fsPromises.writeFile(permissionsFile, JSON.stringify({ version: 2 }))

  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    await assert.rejects(
      () => startSandboxScriptRun({
        scriptPath: '/tmp/script.ts',
        browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
        runId: 'run_invalid_permissions',
        permissionsFile,
        taskMonitor: {
          taskId: 'task-invalid-permissions',
          browserId: 'profile-1',
        },
      }),
      /Invalid script permissions/,
    )
    assert.equal(fork.mock.calls.length, 0)
    assert.equal(publishTaskMonitorBrowserAttached.mock.calls.length, 1)
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[0]?.[0].stage, 'start')
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[1]?.[0].stage, 'error')
    assert.match(publishTaskMonitorBrowserEvent.mock.calls[1]?.[0].errorMessage, /Invalid script permissions/)
    assert.deepEqual(publishTaskMonitorBrowserFinished.mock.calls, [[{
      taskId: 'task-invalid-permissions',
      browserId: 'profile-1',
      dirId: undefined,
    }]])
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('removes the monitored browser when sandbox startup fails', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-start-failure-'))
  fork.mockImplementation(() => {
    throw new Error('sandbox process could not start')
  })

  try {
    const { startSandboxScriptRun } = await import('./sandboxService')
    await assert.rejects(
      () => startSandboxScriptRun({
        scriptPath: '/tmp/script.ts',
        browserUrl: 'ws://127.0.0.1/devtools/browser/abc',
        dirId: 'profile-1',
        runId: 'run_start_failure',
        outputDir: path.join(tempDir, 'output'),
        logFilePath: path.join(tempDir, 'logs', 'run.log'),
        taskMonitor: {
          taskId: 'task-start-failure',
          browserId: 'profile-1',
        },
      }),
      /sandbox process could not start/,
    )

    assert.equal(publishTaskMonitorBrowserAttached.mock.calls.length, 1)
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[0]?.[0].stage, 'start')
    assert.equal(publishTaskMonitorBrowserEvent.mock.calls[1]?.[0].stage, 'error')
    assert.deepEqual(publishTaskMonitorBrowserFinished.mock.calls, [[{
      taskId: 'task-start-failure',
      browserId: 'profile-1',
      dirId: 'profile-1',
    }]])
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})
