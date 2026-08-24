import type { SandboxRunPayload } from '@/core/sandbox/host-protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SANDBOX_HOST_PROTOCOL_VERSION } from '@/core/sandbox/host-protocol'
import { runSandboxMode } from './sandbox'

const mocks = vi.hoisted(() => ({
  installProcessFaultGuards: vi.fn(),
  uninstallProcessFaultGuards: vi.fn(),
  sessions: [] as Array<{
    runId: string
    abort: ReturnType<typeof vi.fn>
    complete: (status?: 'done' | 'failed') => void
  }>,
  capturedFaultHandler: undefined as undefined | ((fault: { kind: 'uncaughtException' | 'unhandledRejection', error: unknown }) => void),
}))

vi.mock('@/core/processFaultGuard', () => ({
  installProcessFaultGuards: mocks.installProcessFaultGuards,
}))

vi.mock('@/core/sandbox/sandbox-run-session', () => ({
  SandboxRunSession: class {
    readonly runId: string
    private resolveRun: ((value: unknown) => void) | undefined

    readonly abort = vi.fn((reason?: unknown) => {
      this.complete('failed')
      return reason
    })

    constructor(options: { runId: string }) {
      this.runId = options.runId
      mocks.sessions.push(this)
    }

    run(): Promise<unknown> {
      return new Promise((resolve) => {
        this.resolveRun = resolve
      })
    }

    handleLlmResponse(): boolean {
      return false
    }

    complete(status: 'done' | 'failed' = 'done'): void {
      this.resolveRun?.({
        status,
        exitCode: status === 'done' ? 0 : 1,
        artifactPaths: [],
        storageChanges: [],
        ...(status === 'failed' ? { error: 'aborted' } : {}),
      })
    }
  },
}))

const originalSend = (process as typeof process & { send?: unknown }).send
const originalConnectedDescriptor = Object.getOwnPropertyDescriptor(process, 'connected')
const originalGeneration = process.env.SANDBOX_HOST_GENERATION

function payload(): SandboxRunPayload {
  return {
    scriptPath: '/tmp/script.ts',
    assetSlug: 'script',
    profile: 'release',
    browserUrl: 'ws://127.0.0.1:9222/devtools/browser/test',
    browserType: 'chromium',
    options: {},
    permissions: { version: 1, fs: { read: [] }, fetch: { allow: [] } },
    outputDir: '/tmp/out',
    browserOutputDir: '/tmp/browser',
    logsDir: '/tmp/logs',
    logFilePath: '/tmp/logs/run.log',
  }
}

function startRun(runId: string): void {
  const hostProcess = process as NodeJS.Process & { emit: (event: 'message', message: unknown) => boolean }
  hostProcess.emit('message', {
    type: 'run.start',
    protocolVersion: SANDBOX_HOST_PROTOCOL_VERSION,
    generation: 'gen-test',
    runId,
    payload: payload(),
  })
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('sandbox mode process fault guard', () => {
  let send: ReturnType<typeof vi.fn>
  let exitSpy: ReturnType<typeof vi.spyOn>
  let shutdown: (() => Promise<void>) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sessions.length = 0
    mocks.capturedFaultHandler = undefined
    mocks.installProcessFaultGuards.mockImplementation((options) => {
      mocks.capturedFaultHandler = options.onFault
      return mocks.uninstallProcessFaultGuards
    })

    send = vi.fn()
    Object.defineProperty(process, 'send', { configurable: true, writable: true, value: send })
    Object.defineProperty(process, 'connected', { configurable: true, value: true })
    process.env.SANDBOX_HOST_GENERATION = 'gen-test'
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
  })

  afterEach(async () => {
    for (const session of mocks.sessions) {
      session.complete()
    }
    await flushPromises()
    await shutdown?.()
    shutdown = undefined
    exitSpy.mockRestore()
    Object.defineProperty(process, 'send', { configurable: true, writable: true, value: originalSend })
    if (originalConnectedDescriptor) {
      Object.defineProperty(process, 'connected', originalConnectedDescriptor)
    }
    else {
      Reflect.deleteProperty(process, 'connected')
    }
    if (originalGeneration === undefined) {
      delete process.env.SANDBOX_HOST_GENERATION
    }
    else {
      process.env.SANDBOX_HOST_GENERATION = originalGeneration
    }
  })

  it('keeps the host alive after an unexpected process fault', async () => {
    shutdown = await runSandboxMode()

    expect(mocks.installProcessFaultGuards).toHaveBeenCalledWith({
      label: 'sandbox:gen-test',
      onFault: expect.any(Function),
    })

    mocks.capturedFaultHandler?.({ kind: 'uncaughtException', error: new Error('timer exploded') })
    await flushPromises()

    expect(exitSpy).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'run.diagnostic',
      generation: 'gen-test',
      message: expect.stringContaining('timer exploded'),
    }))

    startRun('run-after-fault')

    expect(mocks.sessions).toHaveLength(1)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'run.started',
      runId: 'run-after-fault',
      generation: 'gen-test',
    }))
  })

  it('aborts active runs without stopping the shared host', async () => {
    shutdown = await runSandboxMode()
    startRun('run-active')

    const activeSession = mocks.sessions[0]!
    mocks.capturedFaultHandler?.({ kind: 'unhandledRejection', error: new Error('async escaped') })
    await flushPromises()

    expect(activeSession.abort).toHaveBeenCalledWith(expect.any(Error))
    expect(exitSpy).not.toHaveBeenCalled()

    startRun('run-next')

    expect(mocks.sessions.map(session => session.runId)).toEqual(['run-active', 'run-next'])
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'run.started',
      runId: 'run-next',
      generation: 'gen-test',
    }))
  })
})
