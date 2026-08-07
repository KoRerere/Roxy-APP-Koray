import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  closeIpcAndExit: vi.fn(),
  createChatAgent: vi.fn(),
  destroy: vi.fn(async () => {}),
  loadWorkerPayload: vi.fn(),
  sendEvent: vi.fn(),
  sendHeartbeat: vi.fn(),
  sendReady: vi.fn(),
  sendResult: vi.fn(async () => true),
  streamConfig: undefined as Record<string, unknown> | undefined,
}))

vi.mock('../core/worker/payload', () => ({
  loadWorkerPayload: mocks.loadWorkerPayload,
}))

vi.mock('../core/worker/protocol', () => ({
  closeIpcAndExit: mocks.closeIpcAndExit,
  sendEvent: mocks.sendEvent,
  sendHeartbeat: mocks.sendHeartbeat,
  sendReady: mocks.sendReady,
  sendResult: mocks.sendResult,
  WORKER_HEARTBEAT_INTERVAL_MS: 15_000,
}))

vi.mock('../deepagents/agent/chat', () => ({
  createChatAgent: mocks.createChatAgent,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.streamConfig = undefined
  mocks.loadWorkerPayload.mockResolvedValue({
    workerId: 'worker-1',
    parentRunId: 'run-parent',
    conversationId: 'conversation-1',
    task: 'Run the report script',
    timeoutMs: 60_000,
    turnId: 'turn-1',
    dispatchTaskId: 'dispatch-1',
  })
  mocks.createChatAgent.mockResolvedValue({
    agent: {
      stream: vi.fn(async (_input, config) => {
        mocks.streamConfig = config
        config.writer({
          type: 'script_output',
          data: {
            scriptName: 'report',
            level: 'info',
            message: 'processing row 1',
            scriptRunId: 'script-run-1',
          },
        })
        return (async function* emptyStream() {})()
      }),
    },
    destroy: mocks.destroy,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

it('injects the canonical IPC writer into worker tools', async () => {
  vi.spyOn(process, 'on').mockImplementation(() => process)
  const { runWorkerMode } = await import('./worker')

  await runWorkerMode()

  expect(mocks.streamConfig?.writer).toBeTypeOf('function')
  expect(mocks.sendEvent).toHaveBeenCalledWith('worker-1', {
    type: 'script_output',
    data: {
      scriptName: 'report',
      level: 'info',
      message: 'processing row 1',
      scriptRunId: 'script-run-1',
    },
  })
  expect(mocks.sendResult).toHaveBeenCalledWith(expect.objectContaining({
    workerId: 'worker-1',
    status: 'success',
  }))
  expect(mocks.closeIpcAndExit).toHaveBeenCalledWith(0)
})
