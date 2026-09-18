import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import { UserTaskCreatePlanTypeEnum, UserTaskUpdatePlanTypeEnum } from '@roxy/agent-api'
import {
  buildTaskMetadata,
  findLatestTaskLogForTask,
  formatTaskDateTime,
  formatTaskWindowNumbers,
  getDefaultTaskConcurrency,
  getTaskActivityDetails,
  getTaskDisplayStatus,
  getTaskDurationMs,
  getTaskErrorI18nKey,
  getTaskPlanStatus,
  isTaskWindowSelectionValid,
  readTaskConcurrency,
  resolveActiveTaskLogId,
  toUserTaskCreatePlanType,
  toUserTaskUpdatePlanType,
} from './task-manager'

describe('task concurrency metadata', () => {
  it('defaults to the detected CPU core count plus two', () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency')
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 8 })
    try {
      assert.equal(getDefaultTaskConcurrency(), 10)
    }
    finally {
      if (descriptor) {
        Object.defineProperty(navigator, 'hardwareConcurrency', descriptor)
      }
      else {
        Reflect.deleteProperty(navigator, 'hardwareConcurrency')
      }
    }
  })

  it('reads only positive safe integer concurrency values', () => {
    assert.equal(readTaskConcurrency({ concurrency: 6 }), 6)
    assert.equal(readTaskConcurrency({}), undefined)
    assert.equal(readTaskConcurrency({ concurrency: 0 }), undefined)
    assert.equal(readTaskConcurrency({ concurrency: '6' }), undefined)
  })

  it('builds the optional task execution metadata payload', () => {
    assert.deepEqual(buildTaskMetadata(4), { concurrency: 4 })
    assert.equal(buildTaskMetadata(null), null)
  })
})

describe('task table formatting', () => {
  it('formats created time with date and seconds in local time', () => {
    const localTime = new Date(2026, 6, 3, 4, 5, 6)

    assert.equal(formatTaskDateTime(localTime.toISOString()), '2026-07-03 04:05:06')
    assert.equal(formatTaskDateTime(null), '-')
    assert.equal(formatTaskDateTime('invalid date'), 'invalid date')
  })

  it('formats window ids with the same window-number mapping used by the task list', () => {
    const windowNumbersById = new Map([
      ['window-1', '001'],
      ['window-2', '002'],
    ])

    assert.equal(
      formatTaskWindowNumbers(['window-2', 'missing-window', 'window-1'], windowNumbersById),
      '002, 001',
    )
    assert.equal(formatTaskWindowNumbers([], windowNumbersById), '')
  })

  it('uses the persisted task input instead of the current template', () => {
    assert.equal(getTaskActivityDetails({ input: '  Snapshot prompt  ' }), 'Snapshot prompt')
  })

  it('serializes persisted script parameters', () => {
    assert.equal(getTaskActivityDetails({
      input: { keyword: 'Roxy', count: 3 },
    }), '{"keyword":"Roxy","count":3}')
  })

  it('uses a placeholder for missing task input', () => {
    assert.equal(getTaskActivityDetails({ input: null }), '-')
    assert.equal(getTaskActivityDetails({ input: '  ' }), '-')
  })

  it('keeps active durations moving locally and uses the agent value after completion', () => {
    const startedAt = new Date(1_000).toISOString()

    assert.equal(getTaskDurationMs({
      status: 'running',
      startedAt,
      durationMs: 25,
    }, 6_100), 5_100)
    assert.equal(getTaskDurationMs({
      status: 'success',
      startedAt,
      durationMs: 4_200,
    }, 20_000), 4_200)
  })

  it('rejects invalid task duration values', () => {
    assert.equal(getTaskDurationMs({
      status: 'preparing',
      startedAt: 'invalid date',
      durationMs: 25,
    }), null)
    assert.equal(getTaskDurationMs({
      status: 'failed',
      startedAt: new Date(1_000).toISOString(),
      durationMs: null,
    }), null)
  })
})

describe('task error i18n mapping', () => {
  it('maps agent error codes to Chinese source keys', () => {
    assert.equal(getTaskErrorI18nKey('TASK_DISABLED', 'fallback'), '任务已被禁用')
    assert.equal(getTaskErrorI18nKey('HEARTBEAT_REJECTED', 'fallback'), '任务心跳请求被拒绝')
    assert.equal(getTaskErrorI18nKey('SCRIPT_EXECUTION_FAILED', 'fallback'), '所有脚本执行均失败')
    assert.equal(getTaskErrorI18nKey('TASK_SCHEDULE_FORBIDDEN', 'fallback'), '计划任务仅允许创建者账号执行')
  })

  it('uses the caller fallback for missing or unknown codes', () => {
    assert.equal(getTaskErrorI18nKey(null, 'fallback'), 'fallback')
    assert.equal(getTaskErrorI18nKey('UNKNOWN_TASK_ERROR', 'fallback'), 'fallback')
  })
})

describe('getTaskPlanStatus', () => {
  it('shows an unclaimed past once plan as expired without disabling it', () => {
    const task = { planType: 'once' as const, enabled: true, executeAt: '2026-09-18T01:00:00Z' }
    assert.equal(getTaskPlanStatus(task, Date.parse('2026-09-18T01:00:01Z')), 'expired')
    assert.equal(task.enabled, true)
    assert.equal(getTaskPlanStatus(task, Date.parse('2026-09-18T00:59:59Z')), 'scheduled')
    assert.equal(getTaskPlanStatus({ ...task, enabled: false }), 'paused')
    assert.equal(getTaskDisplayStatus('expired', 'running'), 'running')
  })

  it('keeps manual tasks outside the scheduling state', () => {
    assert.equal(getTaskPlanStatus({ planType: 'manual', enabled: true }), 'manual')
    assert.equal(getTaskPlanStatus({ planType: 'manual', enabled: false }), 'manual')
  })

  it('shares enabled and paused states between once and cron schedules', () => {
    assert.equal(getTaskPlanStatus({ planType: 'once', enabled: true }), 'scheduled')
    assert.equal(getTaskPlanStatus({ planType: 'once', enabled: false }), 'paused')
    assert.equal(getTaskPlanStatus({ planType: 'cron', enabled: true }), 'scheduled')
    assert.equal(getTaskPlanStatus({ planType: 'cron', enabled: false }), 'paused')
  })

  it('uses active execution status and restores plan status after completion', () => {
    assert.equal(getTaskDisplayStatus('scheduled', 'preparing'), 'preparing')
    assert.equal(getTaskDisplayStatus('scheduled', 'running'), 'running')
    assert.equal(getTaskDisplayStatus('scheduled', 'success'), 'scheduled')
    assert.equal(getTaskDisplayStatus('paused', 'failed'), 'paused')
    assert.equal(getTaskDisplayStatus('scheduled', undefined, 'running'), 'running')
    assert.equal(getTaskDisplayStatus('paused', undefined, 'idle'), 'paused')
  })
})

describe('task plan API enum mapping', () => {
  it('maps form plan types to generated create and update enums', () => {
    assert.equal(toUserTaskCreatePlanType('manual'), UserTaskCreatePlanTypeEnum.Manual)
    assert.equal(toUserTaskCreatePlanType('once'), UserTaskCreatePlanTypeEnum.Once)
    assert.equal(toUserTaskCreatePlanType('cron'), UserTaskCreatePlanTypeEnum.Cron)
    assert.equal(toUserTaskUpdatePlanType('manual'), UserTaskUpdatePlanTypeEnum.Manual)
    assert.equal(toUserTaskUpdatePlanType('once'), UserTaskUpdatePlanTypeEnum.Once)
    assert.equal(toUserTaskUpdatePlanType('cron'), UserTaskUpdatePlanTypeEnum.Cron)
  })
})

describe('task window selection requirement', () => {
  it('requires at least one window for script tasks', () => {
    assert.equal(isTaskWindowSelectionValid('script', 0), false)
    assert.equal(isTaskWindowSelectionValid('script', 1), true)
  })

  it('keeps windows optional for skill and prompt tasks', () => {
    assert.equal(isTaskWindowSelectionValid('skill', 0), true)
    assert.equal(isTaskWindowSelectionValid('prompt', 0), true)
    assert.equal(isTaskWindowSelectionValid(undefined, 0), true)
  })
})

describe('resolveActiveTaskLogId', () => {
  it('prefers the active channel log and falls back to the task runtime log id', () => {
    assert.equal(
      resolveActiveTaskLogId({ runtimeTaskLogId: 'runtime-log' }, { id: 'channel-log' }),
      'channel-log',
    )
    assert.equal(resolveActiveTaskLogId({ runtimeTaskLogId: 'runtime-log' }), 'runtime-log')
    assert.equal(resolveActiveTaskLogId({ runtimeTaskLogId: null }), undefined)
  })
})

describe('findLatestTaskLogForTask', () => {
  it('returns the newest log for the selected task', () => {
    const logs = [
      { id: 'other', taskId: 2, startedAt: '2026-07-31T10:00:00.000Z' },
      { id: 'older', taskId: 1, startedAt: '2026-07-31T08:00:00.000Z' },
      { id: 'newest', taskId: 1, startedAt: '2026-07-31T09:00:00.000Z' },
    ]

    assert.equal(findLatestTaskLogForTask(logs, 1)?.id, 'newest')
    assert.equal(findLatestTaskLogForTask(logs, 3), undefined)
  })
})
