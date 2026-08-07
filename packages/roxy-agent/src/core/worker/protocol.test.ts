import type { WorkerReadyMessage } from './protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendWorkerMessage } from './protocol'

function readyMessage(): WorkerReadyMessage {
  return {
    type: 'ready',
    protocolVersion: 1,
    workerId: 'worker-1',
    pid: 123,
    startedAt: 100,
  }
}

describe('worker IPC protocol', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs an error when the parent IPC channel is disconnected', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = vi.fn()

    expect(sendWorkerMessage(readyMessage(), { connected: false, send })).toBe(false)
    expect(send).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(
      '[worker:ipc] Failed to send ready message: IPC channel is disconnected',
    )
  })

  it('logs queue backpressure without retrying the message', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const send = vi.fn(() => false)

    expect(sendWorkerMessage(readyMessage(), { connected: true, send })).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '[worker:ipc] IPC send queue is under backpressure for ready message',
    )
  })

  it('logs asynchronous send failures reported by the IPC callback', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = vi.fn((_message, callback) => {
      callback?.(new Error('channel closed'))
      return true
    })

    expect(sendWorkerMessage(readyMessage(), { connected: true, send })).toBe(true)
    expect(error).toHaveBeenCalledWith(
      '[worker:ipc] Failed to send ready message: channel closed',
    )
  })
})
