import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildTaskSchedulePlan,
  createTaskScheduleDraft,
  isValidTaskCron,
} from './task-schedule'

describe('task schedule draft', () => {
  it('defaults manual tasks to the requested one-time frequency', () => {
    const draft = createTaskScheduleDraft({ planType: 'manual', enabled: true }, 'once')

    assert.equal(draft.frequency, 'once')
    assert.equal(draft.enabled, true)
  })

  it('combines a one-time date and time in the local timezone', () => {
    const draft = createTaskScheduleDraft({ planType: 'manual' }, 'once')
    draft.scheduleDate = new Date(2026, 6, 20, 0, 0)
    draft.scheduleTime = new Date(2000, 0, 1, 11, 26)

    assert.deepEqual(buildTaskSchedulePlan(draft), {
      planType: 'once',
      cron: null,
      timezone: null,
      executeAt: new Date(2026, 6, 20, 11, 26, 0, 0).toISOString(),
      enabled: true,
    })
  })

  it('parses and rebuilds standard cron frequencies', () => {
    const cases = [
      { cron: '26 11 * * *', frequency: 'daily' },
      { cron: '26 11 * * 3', frequency: 'weekly' },
      { cron: '26 11 20 * *', frequency: 'monthly' },
    ] as const

    for (const item of cases) {
      const draft = createTaskScheduleDraft({ planType: 'cron', cron: item.cron })
      assert.equal(draft.frequency, item.frequency)
      assert.equal(buildTaskSchedulePlan(draft).cron, item.cron)
      assert.ok(buildTaskSchedulePlan(draft).timezone)
    }
  })

  it('uses nextExecuteAt to localize a cron schedule draft', () => {
    const nextExecuteAt = '2026-07-23T01:26:00.000Z'
    const draft = createTaskScheduleDraft({
      planType: 'cron',
      cron: '26 11 * * 4',
      nextExecuteAt,
    })

    const localOccurrence = new Date(nextExecuteAt)
    assert.equal(draft.frequency, 'weekly')
    assert.equal(draft.weekday, localOccurrence.getDay())
    assert.equal(draft.scheduleTime?.getHours(), localOccurrence.getHours())
    assert.equal(draft.scheduleTime?.getMinutes(), localOccurrence.getMinutes())
  })

  it('keeps paused schedules disabled after editing', () => {
    const draft = createTaskScheduleDraft({
      planType: 'cron',
      cron: '0 9 * * *',
      enabled: false,
    })

    assert.equal(buildTaskSchedulePlan(draft).enabled, false)
  })
})

describe('isValidTaskCron', () => {
  it('accepts supported five-part expressions and rejects malformed values', () => {
    assert.equal(isValidTaskCron('0 9 * * *'), true)
    assert.equal(isValidTaskCron('30 18 * * 5'), true)
    assert.equal(isValidTaskCron('15 7 20 * *'), true)
    assert.equal(isValidTaskCron('*/15 8-18 * * 1-5'), false)
    assert.equal(isValidTaskCron('0 9 * *'), false)
    assert.equal(isValidTaskCron('0 9 * * MON'), false)
  })
})
