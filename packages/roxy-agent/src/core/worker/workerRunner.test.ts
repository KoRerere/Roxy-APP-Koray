import type { Mock } from 'vitest'
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORKER_TIMEOUT_MS, WorkerRunner } from './workerRunner'

const mocks = vi.hoisted(() => ({
  child: undefined as (EventEmitter & {
    connected: boolean
    killed: boolean
    send: Mock
    kill: Mock
    pid: number
  }) | undefined,
}))

vi.mock('node:child_process', () => ({
  fork: vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & {
      connected: boolean
      killed: boolean
      send: Mock
      kill: Mock
      pid: number
    }
    child.connected = true
    child.killed = false
    child.pid = 12345
    child.send = vi.fn()
    child.kill = vi.fn()
    mocks.child = child
    return child
  }),
}))

describe('workerRunner', () => {
  afterEach(() => {
    vi.clearAllMocks()
    mocks.child = undefined
  })

  it('uses a one-hour default business timeout', () => {
    expect(DEFAULT_WORKER_TIMEOUT_MS).toBe(3_600_000)
  })

  it('starts worker subprocesses with ROXY_MODE=worker for IPC task monitor events', async () => {
    const { fork } = await import('node:child_process')
    const previousMode = process.env.ROXY_MODE
    process.env.ROXY_MODE = 'agent'

    try {
      const runner = new WorkerRunner(
        'worker-1',
        '/tmp/payload.json',
        '/tmp/agent.mjs',
        60_000,
        () => {},
      )

      runner.start()

      expect(fork).toHaveBeenCalledWith(
        '/tmp/agent.mjs',
        ['worker', '--payload-file', '/tmp/payload.json'],
        expect.objectContaining({
          env: expect.objectContaining({
            ROXY_MODE: 'worker',
          }),
        }),
      )
    }
    finally {
      if (previousMode === undefined)
        delete process.env.ROXY_MODE
      else
        process.env.ROXY_MODE = previousMode
    }
  })

  it('forwards canonical script output events from worker IPC with the worker ID', async () => {
    const writer = vi.fn()
    const runner = new WorkerRunner(
      'worker-1',
      '/tmp/payload.json',
      '/tmp/agent.mjs',
      60_000,
      writer,
    )

    runner.start()
    mocks.child!.emit('message', {
      type: 'event',
      protocolVersion: 1,
      workerId: 'worker-1',
      event: {
        type: 'script_output',
        data: {
          scriptName: 'report',
          level: 'info',
          message: 'row 1',
          scriptRunId: 'script-run-1',
        },
      },
    })

    expect(writer).toHaveBeenNthCalledWith(1, {
      type: 'script_output',
      data: {
        scriptName: 'report',
        level: 'info',
        message: 'row 1',
        scriptRunId: 'script-run-1',
        workerId: 'worker-1',
      },
    })

    mocks.child!.emit('message', {
      type: 'result',
      protocolVersion: 1,
      workerId: 'worker-1',
      status: 'success',
      result: 'done',
      error: null,
      durationMs: 10,
    })
    mocks.child!.emit('exit', 0, null)
    await runner.promise
  })

  it('logs parent-to-worker cancel backpressure without retrying', async () => {
    const abortController = new AbortController()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const runner = new WorkerRunner(
      'worker-1',
      '/tmp/payload.json',
      '/tmp/agent.mjs',
      60_000,
      () => {},
      abortController.signal,
    )

    runner.start()
    mocks.child!.send.mockReturnValue(false)
    abortController.abort()

    expect(mocks.child!.send).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '[WorkerRunner:worker-1] IPC send queue is under backpressure for cancel message',
    )

    mocks.child!.emit('exit', 1, null)
    await runner.promise
  })

  it('logs parent-to-worker cancel callback failures', async () => {
    const abortController = new AbortController()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const runner = new WorkerRunner(
      'worker-1',
      '/tmp/payload.json',
      '/tmp/agent.mjs',
      60_000,
      () => {},
      abortController.signal,
    )

    runner.start()
    mocks.child!.send.mockImplementation((_message, callback) => {
      callback?.(new Error('channel closed'))
      return true
    })
    abortController.abort()

    expect(error).toHaveBeenCalledWith(
      '[WorkerRunner:worker-1] Failed to send cancel message: channel closed',
    )

    mocks.child!.emit('exit', 1, null)
    await runner.promise
  })
})
