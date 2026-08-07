import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'
import { AiAgentHttpError } from '@/api/errors'
import { TaskLeaseHeartbeat } from './heartbeat'

const heartbeatMock = vi.hoisted(() => vi.fn())

vi.mock('@/api/agentApiClient', () => ({
  agentUserTasksApi: {
    heartbeat: heartbeatMock,
  },
}))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('taskLeaseHeartbeat', () => {
  it('sends only lease fields in the heartbeat body', async () => {
    vi.useFakeTimers()
    heartbeatMock.mockResolvedValue({ renewed: true })
    const abortController = new AbortController()
    const heartbeat = new TaskLeaseHeartbeat(
      1,
      'task-log',
      'lease-token',
      abortController,
    )

    heartbeat.start()
    await vi.advanceTimersByTimeAsync(15_000)
    heartbeat.stop()

    assert.deepEqual(heartbeatMock.mock.calls, [[
      1,
      { taskLogId: 'task-log', leaseToken: 'lease-token' },
    ]])
  })

  it('aborts immediately when the backend confirms lease loss', async () => {
    vi.useFakeTimers()
    const abortController = new AbortController()
    const heartbeat = new TaskLeaseHeartbeat(
      1,
      'task-log',
      'lease-token',
      abortController,
      async () => ({ renewed: false, reason: 'lease_not_found' }),
    )

    heartbeat.start()
    await vi.advanceTimersByTimeAsync(15_000)
    heartbeat.stop()

    assert.equal(abortController.signal.aborted, true)
    assert.equal((abortController.signal.reason as { code?: string }).code, 'LEASE_LOST')
    assert.equal((abortController.signal.reason as Error).message, 'Task execution lease was lost')
  })

  it('uses a distinct code when the backend rejects a heartbeat request', async () => {
    vi.useFakeTimers()
    const abortController = new AbortController()
    const heartbeat = new TaskLeaseHeartbeat(
      1,
      'task-log',
      'lease-token',
      abortController,
      async () => {
        throw new AiAgentHttpError(409, 'lease conflict')
      },
    )

    heartbeat.start()
    await vi.advanceTimersByTimeAsync(15_000)
    heartbeat.stop()

    assert.equal(abortController.signal.aborted, true)
    assert.equal((abortController.signal.reason as { code?: string }).code, 'HEARTBEAT_REJECTED')
    assert.equal((abortController.signal.reason as Error).message, 'Task heartbeat request was rejected')
  })

  it('aborts after three consecutive transient heartbeat failures', async () => {
    vi.useFakeTimers()
    const abortController = new AbortController()
    const renew = vi.fn(async () => {
      throw new Error('network unavailable')
    })
    const heartbeat = new TaskLeaseHeartbeat(
      1,
      'task-log',
      'lease-token',
      abortController,
      renew,
    )

    heartbeat.start()
    await vi.advanceTimersByTimeAsync(45_000)
    heartbeat.stop()

    assert.equal(renew.mock.calls.length, 3)
    assert.equal(abortController.signal.aborted, true)
    assert.equal((abortController.signal.reason as { code?: string }).code, 'HEARTBEAT_FAILED')
    assert.equal((abortController.signal.reason as Error).message, 'Task heartbeat failed repeatedly')
  })

  it('resets the failure counter after a successful renewal', async () => {
    vi.useFakeTimers()
    const abortController = new AbortController()
    const results = [
      new Error('network unavailable'),
      { renewed: true },
      new Error('network unavailable'),
      new Error('network unavailable'),
    ]
    const heartbeat = new TaskLeaseHeartbeat(
      1,
      'task-log',
      'lease-token',
      abortController,
      async () => {
        const result = results.shift()
        if (result instanceof Error)
          throw result
        return result ?? { renewed: true }
      },
    )

    heartbeat.start()
    await vi.advanceTimersByTimeAsync(60_000)
    heartbeat.stop()

    assert.equal(abortController.signal.aborted, false)
  })
})
