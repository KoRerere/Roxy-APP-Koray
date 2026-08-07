import type { Server } from 'node:http'
import express from 'express'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteTaskLog: vi.fn(),
  replayTaskExecution: vi.fn(),
  runTaskNow: vi.fn(),
  stopTaskLog: vi.fn(),
  syncTasks: vi.fn(),
}))

vi.mock('@/services/taskService', () => mocks)

let server: Server | undefined
let baseUrl = ''

beforeEach(async () => {
  vi.clearAllMocks()
  const { default: taskRoutes } = await import('./taskRoutes')
  const app = express()
  app.use(express.json())
  app.use('/api/tasks', taskRoutes)
  await new Promise<void>((resolve, reject) => {
    const listeningServer = app.listen(0, '127.0.0.1')
    server = listeningServer
    listeningServer.once('listening', () => {
      const address = listeningServer.address()
      if (!address || typeof address === 'string') {
        reject(new Error('failed to allocate test server port'))
        return
      }
      baseUrl = `http://127.0.0.1:${address.port}`
      resolve()
    })
    listeningServer.once('error', reject)
  })
})

afterEach(async () => {
  if (!server?.listening) {
    server = undefined
    return
  }
  await new Promise<void>((resolve, reject) => {
    server!.close(error => error ? reject(error) : resolve())
  })
  server = undefined
})

describe('task routes', () => {
  it('starts a manual task after its preparing log exists', async () => {
    mocks.runTaskNow.mockResolvedValue({ id: 'log-1', status: 'preparing' })
    const response = await fetch(`${baseUrl}/api/tasks/12/run`, { method: 'POST' })

    assert.equal(response.status, 202)
    assert.deepEqual(mocks.runTaskNow.mock.calls[0], [12])
    assert.deepEqual(await response.json(), {
      code: 0,
      data: { logId: 'log-1', status: 'preparing' },
    })
  })

  it('replays the complete execution stream after frontend state is lost', async () => {
    mocks.replayTaskExecution.mockReturnValue({
      taskLogId: 'log-1',
      revision: 2,
      events: [
        { taskLogId: 'log-1', sequence: 1, createdAt: '2026-07-24T01:00:00.000Z', payload: { type: 'script.window.started', window: { key: 'window-1', dirId: 'window-1', runId: 'run-1', label: '1' } } },
        { taskLogId: 'log-1', sequence: 2, createdAt: '2026-07-24T01:00:01.000Z', payload: { type: 'script.log.append', windowKey: 'window-1', text: 'running\n' } },
      ],
    })

    const response = await fetch(`${baseUrl}/api/tasks/logs/log-1/replay`)

    assert.equal(response.status, 200)
    assert.deepEqual(mocks.replayTaskExecution.mock.calls[0], ['log-1'])
    assert.equal((await response.json()).data.revision, 2)
  })

  it('waits for an explicit scheduler sync', async () => {
    mocks.syncTasks.mockResolvedValue({
      registeredCount: 3,
      syncedAt: '2026-07-23T01:00:00.000Z',
    })
    const response = await fetch(`${baseUrl}/api/tasks/sync`, { method: 'POST' })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      code: 0,
      data: {
        registeredCount: 3,
        syncedAt: '2026-07-23T01:00:00.000Z',
      },
    })
  })

  it('stops an active task by log ID', async () => {
    mocks.stopTaskLog.mockReturnValue('stopping')
    const response = await fetch(`${baseUrl}/api/tasks/logs/log-1/stop`, { method: 'POST' })

    assert.equal(response.status, 202)
    assert.deepEqual(mocks.stopTaskLog.mock.calls[0], ['log-1'])
    assert.deepEqual(await response.json(), {
      code: 0,
      data: { stopping: true },
    })
  })

  it('deletes a terminal task log and protects active logs', async () => {
    mocks.deleteTaskLog.mockReturnValueOnce('active').mockReturnValueOnce('deleted')

    let response = await fetch(`${baseUrl}/api/tasks/logs/log-1`, { method: 'DELETE' })
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), {
      code: 1,
      msg: '请先停止正在执行的任务',
    })

    response = await fetch(`${baseUrl}/api/tasks/logs/log-1`, { method: 'DELETE' })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      code: 0,
      data: { deleted: true },
    })
  })

  it('returns stable Chinese i18n messages without leaking internal errors', async () => {
    let response = await fetch(`${baseUrl}/api/tasks/not-a-task/run`, { method: 'POST' })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      code: 1,
      msg: '任务 ID 不正确',
    })

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mocks.syncTasks.mockRejectedValue(new Error('internal English detail'))
      response = await fetch(`${baseUrl}/api/tasks/sync`, { method: 'POST' })
      assert.equal(response.status, 500)
      assert.deepEqual(await response.json(), {
        code: 1,
        msg: '同步任务失败，请稍后重试',
      })
    }
    finally {
      consoleError.mockRestore()
    }
  })
})
