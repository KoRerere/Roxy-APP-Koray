import type { TaskSchedulerDeps } from './scheduler'
import type { UserTaskDto } from '@/api/agentApiClient'
import type { TaskLog } from '@/database/tasks'
import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'
import { TaskScheduler } from './scheduler'

const START = Date.parse('2026-07-23T01:00:00.000Z')

function task(overrides: Partial<UserTaskDto> = {}): UserTaskDto {
  return {
    id: 1,
    workspaceId: 'workspace-1',
    name: 'Scheduled task',
    userTemplateId: 2,
    windowIds: [],
    metadata: { prompt: 'run' },
    planType: 'once',
    cron: null,
    timezone: null,
    executeAt: '2026-07-23T01:00:01.000Z',
    nextExecuteAt: '2026-07-23T01:00:01.000Z',
    enabled: true,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  }
}

function terminalLog(): TaskLog {
  return { status: 'success' } as TaskLog
}

function deps(items: UserTaskDto[], now: () => number): TaskSchedulerDeps {
  return {
    listTasks: vi.fn(async (limit, offset) => ({
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    })),
    setEnabled: vi.fn(async (taskId, enabled) => task({ id: taskId, enabled })),
    startTask: vi.fn(async () => ({ log: terminalLog(), completion: Promise.resolve(terminalLog()) })),
    recordMissed: vi.fn(async () => terminalLog()),
    stopTasks: vi.fn(async () => {}),
    now,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('taskScheduler', () => {
  it('registers only future enabled scheduled tasks and fires once in UTC', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    const config = deps([
      task(),
      task({ id: 2, planType: 'manual', nextExecuteAt: null }),
      task({ id: 3, enabled: false }),
    ], () => Date.now())
    const scheduler = new TaskScheduler(config)

    const sync = await scheduler.sync()
    assert.equal(sync.registeredCount, 1)
    await vi.advanceTimersByTimeAsync(1_000)

    assert.equal(vi.mocked(config.startTask).mock.calls.length, 1)
    assert.deepEqual(vi.mocked(config.startTask).mock.calls[0], [
      1,
      { triggerType: 'once', scheduledAt: '2026-07-23T01:00:01.000Z' },
    ])
    assert.deepEqual(vi.mocked(config.setEnabled).mock.calls[0], [1, false])
    await scheduler.stop()
  })

  it('records a delayed trigger as missed without starting the task', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    let logicalNow = START
    const config = deps([task()], () => logicalNow)
    const scheduler = new TaskScheduler(config)
    await scheduler.sync()

    logicalNow = START + 1_000 + 6 * 60_000
    await vi.advanceTimersByTimeAsync(1_000)

    assert.equal(vi.mocked(config.startTask).mock.calls.length, 0)
    assert.deepEqual(vi.mocked(config.recordMissed).mock.calls[0], [
      1,
      'once',
      '2026-07-23T01:00:01.000Z',
    ])
    assert.deepEqual(vi.mocked(config.setEnabled).mock.calls[0], [1, false])
    await scheduler.stop()
  })

  it('fires hourly schedules through the existing cron trigger', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    const config = deps([
      task({
        planType: 'cron',
        cron: '15 * * * *',
        timezone: 'UTC',
        executeAt: null,
        nextExecuteAt: '2026-07-23T01:00:01.000Z',
      }),
    ], () => Date.now())
    const scheduler = new TaskScheduler(config)

    await scheduler.sync()
    await vi.advanceTimersByTimeAsync(1_000)

    assert.deepEqual(vi.mocked(config.startTask).mock.calls[0], [
      1,
      { triggerType: 'cron', scheduledAt: '2026-07-23T01:00:01.000Z' },
    ])
    assert.equal(vi.mocked(config.setEnabled).mock.calls.length, 0)
    await scheduler.stop()
  })

  it('does not disable a once task before its runner completes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    let resolveCompletion!: (log: TaskLog) => void
    const completion = new Promise<TaskLog>((resolve) => {
      resolveCompletion = resolve
    })
    const config = deps([task()], () => Date.now())
    vi.mocked(config.startTask).mockResolvedValue({
      log: { status: 'preparing' } as TaskLog,
      completion,
    })
    const scheduler = new TaskScheduler(config)
    await scheduler.sync()

    await vi.advanceTimersByTimeAsync(1_000)
    assert.equal(vi.mocked(config.setEnabled).mock.calls.length, 0)

    resolveCompletion(terminalLog())
    await vi.advanceTimersByTimeAsync(0)
    assert.deepEqual(vi.mocked(config.setEnabled).mock.calls[0], [1, false])
    await scheduler.stop()
  })

  it('keeps existing timers when a sync request fails', async () => {
    const config = deps([task()], () => START)
    const scheduler = new TaskScheduler(config)
    await scheduler.sync()
    assert.equal(scheduler.getRegisteredCount(), 1)
    vi.mocked(config.listTasks).mockRejectedValueOnce(new Error('offline'))

    await assert.rejects(scheduler.sync(), /offline/)
    assert.equal(scheduler.getRegisteredCount(), 1)
    await scheduler.stop()
  })
})
