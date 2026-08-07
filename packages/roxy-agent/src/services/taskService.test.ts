import assert from 'node:assert/strict'
import { beforeEach, describe, it, vi } from 'vitest'
import { replayTaskExecution } from './taskService'

const mocks = vi.hoisted(() => ({
  getTaskLog: vi.fn(),
  replayLive: vi.fn(),
  replayLocal: vi.fn(),
  restore: vi.fn(),
}))

vi.mock('@/config', () => ({
  env: {
    ROXY_USER_ID: 'user-1',
    ROXY_WORKSPACE_ID: 'workspace-1',
  },
}))

vi.mock('@/database/tasks', () => ({
  taskLogStore: {
    getById: mocks.getTaskLog,
  },
}))

vi.mock('@/tasks/runner', () => ({
  taskRunner: {},
}))

vi.mock('@/tasks/scheduler', () => ({
  taskScheduler: {},
}))

vi.mock('./taskExecutionDetails', () => ({
  replayTaskExecutionFromLocalStorage: mocks.replayLocal,
  taskExecutionDetailHub: {
    replay: mocks.replayLive,
    restore: mocks.restore,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('replayTaskExecution', () => {
  it('uses the current in-memory stream while it is available', () => {
    const log = { id: 'log-1' }
    const liveReplay = {
      taskLogId: 'log-1',
      revision: 1,
      events: [{ taskLogId: 'log-1', sequence: 1 }],
    }
    mocks.getTaskLog.mockReturnValue(log)
    mocks.replayLive.mockReturnValue(liveReplay)

    assert.equal(replayTaskExecution('log-1'), liveReplay)
    assert.deepEqual(mocks.getTaskLog.mock.calls[0], ['log-1', 'user-1', 'workspace-1'])
    assert.equal(mocks.replayLocal.mock.calls.length, 0)
  })

  it('rebuilds from local files and restores the sequence when memory was lost', () => {
    const log = { id: 'log-1' }
    const localReplay = {
      taskLogId: 'log-1',
      revision: 4,
      events: [{ taskLogId: 'log-1', sequence: 1 }],
    }
    const restoredReplay = { ...localReplay, restored: true }
    mocks.getTaskLog.mockReturnValue(log)
    mocks.replayLive.mockReturnValue({ taskLogId: 'log-1', revision: 0, events: [] })
    mocks.replayLocal.mockReturnValue(localReplay)
    mocks.restore.mockReturnValue(restoredReplay)

    assert.equal(replayTaskExecution('log-1'), restoredReplay)
    assert.deepEqual(mocks.replayLocal.mock.calls[0], [log])
    assert.deepEqual(mocks.restore.mock.calls[0], [localReplay])
  })

  it('does not read another workspace task', () => {
    mocks.getTaskLog.mockReturnValue(null)

    assert.equal(replayTaskExecution('missing-log'), null)
    assert.equal(mocks.replayLive.mock.calls.length, 0)
    assert.equal(mocks.replayLocal.mock.calls.length, 0)
  })
})
