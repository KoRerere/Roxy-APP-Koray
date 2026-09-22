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

  it('computes hourly schedules locally instead of using the server timestamp', async () => {
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
    await vi.advanceTimersByTimeAsync(15 * 60_000)

    assert.deepEqual(vi.mocked(config.startTask).mock.calls[0], [
      1,
      { triggerType: 'cron', scheduledAt: '2026-07-23T01:15:00.000Z' },
    ])
    await scheduler.stop()
  })

  it('computes the next local occurrence after a cron task fires', async () => {
    // 回归：移除云端执行租约后，cron 任务仍停留在旧的 nextExecuteAt，后续不会再次触发。
    vi.useFakeTimers()
    vi.setSystemTime(START)
    const config = deps([
      task({
        planType: 'cron',
        cron: '* * * * *',
        timezone: 'UTC',
        executeAt: null,
        nextExecuteAt: '2026-07-23T01:00:01.000Z',
      }),
    ], () => Date.now())
    const scheduler = new TaskScheduler(config)

    await scheduler.sync()
    await vi.advanceTimersByTimeAsync(120_000)

    assert.equal(vi.mocked(config.startTask).mock.calls.length, 2)
    assert.equal(vi.mocked(config.startTask).mock.calls[1]?.[1].scheduledAt, '2026-07-23T01:02:00.000Z')
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

    items[0] = task({ executeAt: '2026-07-23T02:00:00.000Z' })
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

describe('本地计划计算与恢复', () => {
  it.each([null, '2020-01-01T00:00:00.000Z', '2030-01-01T00:00:00.000Z'])(
    '服务器 nextExecuteAt=%s 不影响首次调度和重启恢复',
    async (nextExecuteAt) => {
      // 回归：之前启动依赖服务器的未来 nextExecuteAt，过期或缺失就不再执行。
      vi.useFakeTimers()
      vi.setSystemTime(START)
      const config = deps([task({ planType: 'cron', cron: '* * * * *', nextExecuteAt })], () => Date.now())
      const first = new TaskScheduler(config)
      await first.sync()
      await vi.advanceTimersByTimeAsync(60_000)
      assert.equal(vi.mocked(config.startTask).mock.calls[0]?.[1].scheduledAt, '2026-07-23T01:01:00.000Z')
      await first.stop()
      const restarted = new TaskScheduler(config)
      await restarted.sync()
      await vi.advanceTimersByTimeAsync(60_000)
      assert.equal(vi.mocked(config.startTask).mock.calls[1]?.[1].scheduledAt, '2026-07-23T01:02:00.000Z')
      await restarted.stop()
    },
  )

  it('单次计划只使用 executeAt，并且重复同步不会重复执行', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    const config = deps([task({ nextExecuteAt: null })], () => Date.now())
    const scheduler = new TaskScheduler(config)
    await scheduler.sync()
    await vi.advanceTimersByTimeAsync(1_000)
    await scheduler.sync()
    await scheduler.sync()
    assert.equal(vi.mocked(config.startTask).mock.calls.length, 1)
    await scheduler.stop()
  })

  it('同步失败不会阻止 Cron 在本地续排', async () => {
    // 回归：下一次 timer 曾经只能在远端 list 成功后注册。
    vi.useFakeTimers()
    vi.setSystemTime(START)
    const config = deps([task({ planType: 'cron', cron: '* * * * *' })], () => Date.now())
    const scheduler = new TaskScheduler(config)
    await scheduler.sync()
    vi.mocked(config.listTasks).mockRejectedValue(new Error('offline'))
    await assert.rejects(scheduler.sync(), /offline/)
    await vi.advanceTimersByTimeAsync(120_000)
    assert.equal(vi.mocked(config.startTask).mock.calls.length, 2)
    await scheduler.stop()
  })

  it('频繁同步不会不断推迟同一个计划', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    const items = [task({ planType: 'cron', cron: '* * * * *' })]
    const config = deps(items, () => Date.now())
    const scheduler = new TaskScheduler(config)
    await scheduler.start()
    await vi.advanceTimersByTimeAsync(30_000)
    items[0]!.nextExecuteAt = '2030-01-01T00:00:00.000Z'
    await scheduler.sync()
    await vi.advanceTimersByTimeAsync(90_000)
    assert.deepEqual(vi.mocked(config.startTask).mock.calls.map(call => call[1].scheduledAt), [
      '2026-07-23T01:01:00.000Z',
      '2026-07-23T01:02:00.000Z',
    ])
    await scheduler.stop()
  })

  it('休眠迟到后记录错过的触发并继续未来的计划', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    let logicalNow = START
    const config = deps([task({ planType: 'cron', cron: '* * * * *' })], () => logicalNow)
    const scheduler = new TaskScheduler(config)
    await scheduler.sync()
    logicalNow = START + 10 * 60_000
    await scheduler.sync()
    await vi.advanceTimersByTimeAsync(60_000)
    assert.equal(vi.mocked(config.recordMissed).mock.calls[0]?.[2], '2026-07-23T01:01:00.000Z')
    assert.equal(vi.mocked(config.startTask).mock.calls.length, 0)
    logicalNow += 60_000
    await vi.advanceTimersByTimeAsync(60_000)
    assert.equal(vi.mocked(config.startTask).mock.calls[0]?.[1].scheduledAt, '2026-07-23T01:11:00.000Z')
    await scheduler.stop()
  })

  it.each([
    ['2026-07-23T00:00:00.000Z', '0 9 * * *', 'Asia/Shanghai', '2026-07-23T01:00:00.000Z'],
    ['2026-03-08T06:59:00.000Z', '30 2 * * *', 'America/New_York', '2026-03-08T07:30:00.000Z'],
    ['2026-07-23T01:00:00.000Z', '0 0 29 2 *', 'UTC', '2028-02-29T00:00:00.000Z'],
    ['2026-07-23T01:00:00.000Z', '0 9 * * MON-FRI', 'UTC', '2026-07-23T09:00:00.000Z'],
  ])('使用成熟库处理时区、夏令时和稀疏计划：%s %s %s', async (now, cron, timezone, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(now))
    const config = deps([task({ planType: 'cron', cron, timezone, nextExecuteAt: null })], () => Date.now())
    const scheduler = new TaskScheduler(config)
    assert.equal((await scheduler.sync()).registeredCount, 1)
    await vi.advanceTimersByTimeAsync(Date.parse(expected) - Date.now())
    assert.equal(vi.mocked(config.startTask).mock.calls[0]?.[1].scheduledAt, expected)
    await scheduler.stop()
  })

  it('修改、停用和删除计划会撤销旧 timer', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    const items = [task({ planType: 'cron', cron: '* * * * *' })]
    const config = deps(items, () => Date.now())
    const scheduler = new TaskScheduler(config)
    await scheduler.sync()
    items[0]!.cron = '*/2 * * * *'
    await scheduler.sync()
    await vi.advanceTimersByTimeAsync(60_000)
    assert.equal(vi.mocked(config.startTask).mock.calls.length, 0)
    await vi.advanceTimersByTimeAsync(60_000)
    assert.equal(vi.mocked(config.startTask).mock.calls.length, 1)
    items[0]!.enabled = false
    await scheduler.sync()
    await vi.advanceTimersByTimeAsync(120_000)
    assert.equal(vi.mocked(config.startTask).mock.calls.length, 1)
    items[0]!.enabled = true
    await scheduler.sync()
    items.splice(0)
    await scheduler.sync()
    await vi.advanceTimersByTimeAsync(120_000)
    assert.equal(vi.mocked(config.startTask).mock.calls.length, 1)
    await scheduler.stop()
  })

  it('任务启动失败仍继续下一次本地计划', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    const config = deps([task({ planType: 'cron', cron: '* * * * *' })], () => Date.now())
    vi.mocked(config.startTask).mockRejectedValueOnce(new Error('prepare failed'))
    const scheduler = new TaskScheduler(config)
    await scheduler.sync()
    await vi.advanceTimersByTimeAsync(120_000)
    assert.equal(vi.mocked(config.startTask).mock.calls.length, 2)
    await scheduler.stop()
  })

  it('错误表达式或时区不会阻止其他任务注册', async () => {
    const config = deps([
      task({ planType: 'cron', cron: 'invalid' }),
      task({ id: 2, planType: 'cron', cron: '* * * * *', timezone: 'invalid/timezone' }),
      task({ id: 3, planType: 'cron', cron: '* * * * *' }),
    ], () => START)
    const scheduler = new TaskScheduler(config)
    assert.equal((await scheduler.sync()).registeredCount, 1)
    await scheduler.stop()
  })
})
