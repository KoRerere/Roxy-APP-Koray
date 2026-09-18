import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import vm from 'node:vm'
import { beforeEach, expect, it, vi } from 'vitest'

const fork = vi.fn()
const ask = vi.fn()

vi.mock('node:child_process', () => ({ fork }))

class FakeChild extends EventEmitter {
  connected = true
  stdout = new PassThrough()
  stderr = new PassThrough()
  generation = ''
  send = vi.fn((message: any) => {
    if (message.type === 'host.shutdown' || message.type === 'host.drain') {
      queueMicrotask(() => {
        this.connected = false
        this.emit('exit', 0, null)
      })
    }
  })

  kill = vi.fn((_signal?: string) => {
    queueMicrotask(() => {
      this.connected = false
      this.emit('exit', null, _signal ?? 'SIGTERM')
    })
    return true
  })
}

const payload = {
  scriptPath: '/tmp/script.ts',
  assetSlug: 'script',
  profile: 'release' as const,
  browserUrl: 'ws://127.0.0.1/devtools/browser/test',
  browserType: 'chromium' as const,
  options: {},
  permissions: { version: 1 as const, fs: { read: [] }, fetch: { allow: [] } },
  outputDir: '/tmp/output',
  browserOutputDir: '/tmp/output/browser',
  logsDir: '/tmp/output/logs',
  logFilePath: '/tmp/output/logs/run.log',
}

beforeEach(() => {
  vi.resetModules()
  fork.mockReset()
  ask.mockReset()
  process.env.AGENT_SCRIPT_PATH = '/tmp/roxy-agent.mjs'
  process.env.ENV_TYPE = 'production'
  process.env.SANDBOX_HOST_MAX_RUNS = '100'
})

function installHost(): FakeChild {
  const child = new FakeChild()
  fork.mockImplementation((_path, _args, options) => {
    child.generation = options.env.SANDBOX_HOST_GENERATION
    queueMicrotask(() => child.emit('message', {
      type: 'host.ready',
      protocolVersion: 1,
      generation: child.generation,
      pid: 1234,
      startedAt: Date.now(),
    }))
    return child
  })
  return child
}

it.skipIf(!vm.SourceTextModule)('将真实 Sandbox VM 的图片与调用参数通过 IPC 传到宿主', async () => {
  // 回归：VM 出站和宿主入站都丢弃 options，图片无法穿过 IPC。
  // 修复：两端按协议保留可序列化选项，取消信号仍由宿主注入。
  const root = await mkdtemp(path.join(os.tmpdir(), 'sandbox-llm-images-'))
  const child = installHost()
  const { SandboxRunSession } = await import('@/core/sandbox/sandbox-run-session')
  const { SandboxHostManager } = await import('./sandboxHostManager')
  const manager = new SandboxHostManager(1, () => ({ ask }))
  const images = [{ base64: 'aW1hZ2U=', mimeType: 'image/png' }]
  const options = { images, model: 'vision-model', temperature: 0.1, maxTokens: 120 }
  const schema = { type: 'object', properties: { description: { type: 'string' } } }
  let session: InstanceType<typeof SandboxRunSession> | undefined
  const scriptPath = path.join(root, 'script.ts')
  await writeFile(scriptPath, `
    import { ask, json } from '@roxybrowser/sandbox/llm'
    export async function main() {
      const options = ${JSON.stringify(options)}
      const text = await ask('描述图片', options)
      const value = await json('提取描述', ${JSON.stringify(schema)}, options)
      return text + ':' + value.description
    }
  `)
  ask.mockResolvedValueOnce('图片').mockResolvedValueOnce({ description: '内容' })
  const originalSend = child.send.getMockImplementation()!
  child.send.mockImplementation((message: any) => {
    originalSend(message)
    if (message.type === 'rpc.llm.response') {
      session!.handleLlmResponse(message.requestId, message)
    }
    if (message.type === 'run.start') {
      const emit = (event: Record<string, unknown>) => child.emit('message', JSON.parse(JSON.stringify({
        ...event,
        protocolVersion: 1,
        generation: child.generation,
        runId: message.runId,
      })))
      session = new SandboxRunSession({
        runId: message.runId,
        payload: message.payload,
        emit: (event) => {
          if (event.type === 'llm.request') {
            emit({ ...event, type: 'rpc.llm.request' })
          }
        },
      })
      queueMicrotask(() => {
        emit({ type: 'run.started' })
        void session!.run().then(result => emit({ type: 'run.finished', result }))
      })
    }
  })
  try {
    const reservation = await manager.reserve()
    const run = await reservation.start('run-images', {
      ...payload,
      scriptPath,
      outputDir: root,
      browserOutputDir: path.join(root, 'browser', 'today'),
      logsDir: path.join(root, 'logs'),
      logFilePath: path.join(root, 'logs', 'run.log'),
    })
    const result = await run.finished
    expect(result.error).toBeUndefined()
    expect(result.returnValue).toBe('图片:内容')
    expect(ask).toHaveBeenNthCalledWith(1, {
      prompt: '描述图片',
      options: { ...options, signal: expect.any(AbortSignal) },
    })
    expect(ask).toHaveBeenNthCalledWith(2, {
      prompt: '提取描述',
      schema,
      options: { ...options, signal: expect.any(AbortSignal) },
    })
  }
  finally {
    await manager.shutdown()
    await rm(root, { recursive: true, force: true })
  }
})

it('reuses one Host process for consecutive sandbox runs', async () => {
  const child = installHost()
  const { SandboxHostManager } = await import('./sandboxHostManager')
  const manager = new SandboxHostManager(1, () => ({ ask }))
  try {
    const firstReservation = await manager.reserve()
    const firstStart = firstReservation.start('run-1', payload)
    await new Promise(resolve => setImmediate(resolve))
    child.emit('message', { type: 'run.started', protocolVersion: 1, generation: child.generation, runId: 'run-1' })
    const first = await firstStart
    child.emit('message', {
      type: 'run.finished',
      protocolVersion: 1,
      generation: child.generation,
      runId: 'run-1',
      result: { status: 'done', exitCode: 0, artifactPaths: [], storageChanges: [] },
    })
    assert.equal((await first.finished).status, 'done')

    const secondReservation = await manager.reserve()
    const secondStart = secondReservation.start('run-2', payload)
    await new Promise(resolve => setImmediate(resolve))
    child.emit('message', { type: 'run.started', protocolVersion: 1, generation: child.generation, runId: 'run-2' })
    const second = await secondStart
    child.emit('message', {
      type: 'run.finished',
      protocolVersion: 1,
      generation: child.generation,
      runId: 'run-2',
      result: { status: 'done', exitCode: 0, artifactPaths: [], storageChanges: [] },
    })
    await second.finished
    assert.equal(fork.mock.calls.length, 1)
  }
  finally {
    await manager.shutdown()
  }
})

it('starts Firefox sandbox payloads through the persistent Host', async () => {
  const child = installHost()
  const { SandboxHostManager } = await import('./sandboxHostManager')
  const manager = new SandboxHostManager(1, () => ({ ask }))
  try {
    const reservation = await manager.reserve()
    const start = reservation.start('run-firefox', {
      ...payload,
      browserUrl: 'ws://127.0.0.1/session/firefox',
      browserType: 'firefox',
    })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(child.send.mock.calls[0]?.[0].type, 'run.start')
    assert.equal(child.send.mock.calls[0]?.[0].payload.browserType, 'firefox')
    child.emit('message', { type: 'run.started', protocolVersion: 1, generation: child.generation, runId: 'run-firefox' })
    const run = await start
    child.emit('message', {
      type: 'run.finished',
      protocolVersion: 1,
      generation: child.generation,
      runId: 'run-firefox',
      result: { status: 'done', exitCode: 0, artifactPaths: [], storageChanges: [] },
    })
    assert.equal((await run.finished).status, 'done')
  }
  finally {
    await manager.shutdown()
  }
})

it('queues reservations at the configured concurrency limit', async () => {
  const { SandboxHostManager } = await import('./sandboxHostManager')
  const manager = new SandboxHostManager(1, () => ({ ask }))
  try {
    const first = await manager.reserve()
    let secondResolved = false
    const secondPromise = manager.reserve().then((reservation) => {
      secondResolved = true
      return reservation
    })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(secondResolved, false)
    first.release()
    const second = await secondPromise
    assert.equal(secondResolved, true)
    second.release()
  }
  finally {
    await manager.shutdown()
  }
})

it('settles active runs as killed when the Host exits', async () => {
  const child = installHost()
  const { SandboxHostManager } = await import('./sandboxHostManager')
  const manager = new SandboxHostManager(1, () => ({ ask }))
  try {
    const reservation = await manager.reserve()
    const starting = reservation.start('run-crash', payload)
    await new Promise(resolve => setImmediate(resolve))
    child.emit('message', { type: 'run.started', protocolVersion: 1, generation: child.generation, runId: 'run-crash' })
    const run = await starting
    child.connected = false
    child.emit('exit', 1, null)
    const result = await run.finished
    assert.equal(result.status, 'killed')
    assert.match(result.error ?? '', /exited/)
  }
  finally {
    await manager.shutdown()
  }
})

it('retains phase and recent log diagnostics for active runs', async () => {
  const child = installHost()
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
  const managerModule = await import('./sandboxHostManager')
  const manager = new managerModule.SandboxHostManager(1, () => ({ ask }))
  try {
    const reservation = await manager.reserve()
    const starting = reservation.start('run-diagnostics', payload, {
      onLog: () => {},
    })
    await new Promise(resolve => setImmediate(resolve))
    child.emit('message', { type: 'run.started', protocolVersion: 1, generation: child.generation, runId: 'run-diagnostics' })
    await starting
    child.emit('message', {
      type: 'run.phase',
      protocolVersion: 1,
      generation: child.generation,
      runId: 'run-diagnostics',
      phase: 'playwright_connect_start',
      timestamp: Date.now(),
    })
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('phase=playwright_connect_start'))
    child.emit('message', {
      type: 'run.log',
      protocolVersion: 1,
      generation: child.generation,
      runId: 'run-diagnostics',
      level: 'info',
      message: 'connect pending',
    })
    ;(manager as any).checkHealth()
    expect(error).not.toHaveBeenCalled()
    child.emit('message', {
      type: 'host.heartbeat',
      protocolVersion: 1,
      generation: child.generation,
      pid: 1234,
      timestamp: Date.now(),
      activeRuns: 1,
      memory: { rss: 10, heapUsed: 5, external: 1 },
      eventLoopDelayMs: 321,
    })
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('eventLoopDelayMs=321'))
    ;(manager as any).host.lastSeen = Date.now() - 70_000
    ;(manager as any).checkHealth()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('phase=playwright_connect_start'))
    expect(error).toHaveBeenCalledWith(expect.stringContaining('lastLog="connect pending"'))
    await starting.then(run => run.finished)
  }
  finally {
    debug.mockRestore()
    error.mockRestore()
    await manager.shutdown()
  }
})

it('does not dispatch a run aborted while the Host is starting', async () => {
  const child = new FakeChild()
  fork.mockImplementation((_path, _args, options) => {
    child.generation = options.env.SANDBOX_HOST_GENERATION
    return child
  })
  const { SandboxHostManager } = await import('./sandboxHostManager')
  const manager = new SandboxHostManager(1, () => ({ ask }))
  const abortController = new AbortController()
  try {
    const reservation = await manager.reserve(abortController.signal)
    const starting = reservation.start('run-aborted', payload)
    await new Promise(resolve => setImmediate(resolve))
    abortController.abort()
    child.emit('message', {
      type: 'host.ready',
      protocolVersion: 1,
      generation: child.generation,
      pid: 1234,
      startedAt: Date.now(),
    })

    await assert.rejects(starting, { name: 'AbortError' })
    assert.equal(child.send.mock.calls.some(([message]) => message.type === 'run.start'), false)
  }
  finally {
    await manager.shutdown()
  }
})

it('does not drain a recycled Host while a queued reservation owns the next slot', async () => {
  process.env.SANDBOX_HOST_MAX_RUNS = '1'
  const child = installHost()
  const { SandboxHostManager } = await import('./sandboxHostManager')
  const manager = new SandboxHostManager(1, () => ({ ask }))
  try {
    const firstReservation = await manager.reserve()
    const firstStart = firstReservation.start('run-recycle-1', payload)
    await new Promise(resolve => setImmediate(resolve))
    child.emit('message', { type: 'run.started', protocolVersion: 1, generation: child.generation, runId: 'run-recycle-1' })
    const first = await firstStart
    const secondReservationPromise = manager.reserve()

    child.emit('message', {
      type: 'run.finished',
      protocolVersion: 1,
      generation: child.generation,
      runId: 'run-recycle-1',
      result: { status: 'done', exitCode: 0, artifactPaths: [], storageChanges: [] },
    })
    await first.finished
    const secondReservation = await secondReservationPromise
    assert.equal(child.send.mock.calls.some(([message]) => message.type === 'host.drain'), false)

    const secondStart = secondReservation.start('run-recycle-2', payload)
    await new Promise(resolve => setImmediate(resolve))
    child.emit('message', { type: 'run.started', protocolVersion: 1, generation: child.generation, runId: 'run-recycle-2' })
    const second = await secondStart
    child.emit('message', {
      type: 'run.finished',
      protocolVersion: 1,
      generation: child.generation,
      runId: 'run-recycle-2',
      result: { status: 'done', exitCode: 0, artifactPaths: [], storageChanges: [] },
    })
    await second.finished
    assert.equal(child.send.mock.calls.some(([message]) => message.type === 'host.drain'), true)
  }
  finally {
    await manager.shutdown()
  }
})
