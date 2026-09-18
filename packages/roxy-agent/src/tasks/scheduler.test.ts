import type { TaskSchedulerDeps } from './scheduler'
import type { UserTaskDto } from '@/api/agentApiClient'
import type { TaskLog } from '@/database/tasks'
import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'
import { TaskScheduler } from './scheduler'

vi.mock('./runner', () => ({ taskRunner: {} }))

const START = Date.parse('2026-07-23T01:00:00.000Z')

function task(overrides: Partial<UserTaskDto> = {}): UserTaskDto {
  return {
    id: 1,
    workspaceId: 'workspace-1',
    creatorUserId: 'user-1',
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
    userId: 'user-1',
    listTasks: vi.fn(async (limit, offset) => ({
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    })),
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
  it('registers only the current account schedules and ignores missing ownership', async () => {
    // 回归：此前所有团队成员都会注册定时器并争抢执行其他人创建的任务。
    vi.useFakeTimers()
    vi.setSystemTime(START)
    const missingCreator = task({ id: 4 })
    Reflect.deleteProperty(missingCreator, 'creatorUserId')
    const config = deps([
      task(),
      task({ id: 2, creatorUserId: 'other-user' }),
      task({ id: 3, creatorUserId: 'other-user', planType: 'cron' }),
      missingCreator,
    ], () => Date.now())
    const scheduler = new TaskScheduler(config)

    assert.equal((await scheduler.sync()).registeredCount, 1)
    await vi.advanceTimersByTimeAsync(1_000)
    assert.equal(vi.mocked(config.startTask).mock.calls.length, 1)
    assert.equal(vi.mocked(config.startTask).mock.calls[0]?.[0], 1)
    await scheduler.stop()
  })

  it('does not schedule when the current account is unavailable', async () => {
    const config = deps([task()], () => START)
    config.userId = undefined
    const scheduler = new TaskScheduler(config)
    assert.equal((await scheduler.sync()).registeredCount, 0)
    await scheduler.stop()
  })

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
    await scheduler.stop()
  })

  it('does not overwrite a rescheduled once task when the previous run completes', async () => {
    // 回归：旧任务完成后发送 enabled=false 会关闭团队成员刚修改的新计划。
    vi.useFakeTimers()
    vi.setSystemTime(START)
    let resolveCompletion!: (log: TaskLog) => void
    const completion = new Promise<TaskLog>((resolve) => {
      resolveCompletion = resolve
    })
    const items = [task()]
    const setEnabled = vi.fn()
    const config = { ...deps(items, () => Date.now()), setEnabled }
    vi.mocked(config.startTask).mockResolvedValue({
      log: { status: 'preparing' } as TaskLog,
      completion,
    })
    const scheduler = new TaskScheduler(config)
    await scheduler.sync()

    await vi.advanceTimersByTimeAsync(1_000)
    assert.equal(setEnabled.mock.calls.length, 0)

    items[0] = task({ nextExecuteAt: '2026-07-23T02:00:00.000Z' })
    await scheduler.sync()

    resolveCompletion(terminalLog())
    await vi.advanceTimersByTimeAsync(0)
    assert.equal(setEnabled.mock.calls.length, 0)
    assert.equal(scheduler.getRegisteredCount(), 1)
    await scheduler.stop()
  })

  it('does not disable a once plan when its trigger is rejected', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    const setEnabled = vi.fn()
    const config = { ...deps([task()], () => Date.now()), setEnabled }
    vi.mocked(config.startTask).mockRejectedValue(new Error('not_task_creator'))
    const scheduler = new TaskScheduler(config)
    await scheduler.sync()
    await vi.advanceTimersByTimeAsync(1_000)
    assert.equal(setEnabled.mock.calls.length, 0)
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
