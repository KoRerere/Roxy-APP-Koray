import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import { UserTaskCreatePlanTypeEnum, UserTaskUpdatePlanTypeEnum } from '@roxy/agent-api'
import {
  buildTaskMetadata,
  canAccessTask,
  findLatestTaskLogForTask,
  formatTaskDateTime,
  formatTaskWindowNumbers,
  getDefaultTaskConcurrency,
  getTaskActivityDetails,
  getTaskDisplayStatus,
  getTaskDurationMs,
  getTaskErrorMessage,
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

describe('任务错误提示翻译', () => {
  it('每次读取时翻译，切换语言后不能继续返回旧文案', () => {
    // 回归：纯字符串映射配合动态 $t 无法生成语言 key，也不能返回已翻译的文案。
    const original = globalThis.$t
    try {
      globalThis.$t = key => `en:${key}`
      assert.equal(getTaskErrorMessage('TASK_DISABLED'), 'en:任务已被禁用')
      globalThis.$t = key => `ru:${key}`
      assert.equal(getTaskErrorMessage('TASK_DISABLED'), 'ru:任务已被禁用')
      assert.equal(getTaskErrorMessage('UNKNOWN_TASK_ERROR'), 'ru:任务执行失败，请稍后重试')
      assert.equal(getTaskErrorMessage('toString'), 'ru:任务执行失败，请稍后重试')
      assert.equal(getTaskErrorMessage(null), '')
      assert.equal(getTaskErrorMessage(undefined), '')
    }
    finally {
      globalThis.$t = original
    }
  })

  it('所有任务错误码都能在生成的中英俄语言文件中找到非空翻译', () => {
    const codes = [
      'TASK_INTERRUPTED',
      'TASK_WORKSPACE_MISMATCH',
      'TASK_TEMPLATE_MISMATCH',
      'TASK_ALREADY_RUNNING',
      'MISSED_TRIGGER',
      'AGENT_SHUTDOWN',
      'AGENT_RESTARTED',
      'TASK_ASSET_INVALID',
      'WINDOW_STATE_UNAVAILABLE',
      'NO_AVAILABLE_WINDOWS',
      'LEASE_SERVICE_UNAVAILABLE',
      'TASK_DISABLED',
      'TASK_EXECUTED_BY_OTHER_USER',
      'TASK_SCHEDULE_FORBIDDEN',
      'TASK_OCCURRENCE_CLAIMED',
      'TASK_EXECUTION_FAILED',
      'AGENT_EXECUTION_FAILED',
      'SCRIPT_EXECUTION_FAILED',
      'PARTIAL_WINDOW_FAILURE',
      'ARTIFACT_UPLOAD_PARTIAL_FAILURE',
      'LEASE_LOST',
      'HEARTBEAT_REJECTED',
      'HEARTBEAT_FAILED',
    ]
    const original = globalThis.$t
    try {
      for (const language of ['zh-CN', 'en', 'ru']) {
        const messages = JSON.parse(readFileSync(new URL(`../../locales/langs/${language}.json`, import.meta.url), 'utf8'))
        let translationCalls = 0
        globalThis.$t = (key) => {
          translationCalls += 1
          assert.ok(typeof messages[key] === 'string' && messages[key].trim(), `${language}: ${key}`)
          if (language !== 'zh-CN') {
            assert.notEqual(messages[key], key)
          }
          return messages[key]
        }
        for (const code of codes) {
          assert.ok(getTaskErrorMessage(code))
        }
        assert.equal(translationCalls, codes.length)
      }
    }
    finally {
      globalThis.$t = original
    }
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

describe('任务管理可见范围', () => {
  const own = { creatorUserId: 'user-1' }
  const other = { creatorUserId: 'user-2' }

  it('拥有者和管理者可以查看及管理所有人的任务', () => {
    assert.equal(canAccessTask(own, 'user-1', true), true)
    assert.equal(canAccessTask(other, 'user-1', true), true)
  })

  it('其他角色只能查看及管理自己的任务', () => {
    assert.equal(canAccessTask(own, 'user-1', false), true)
    assert.equal(canAccessTask(other, 'user-1', false), false)
    assert.deepEqual([own, other].filter(task => canAccessTask(task, 'user-1', false)), [own])
  })

  it('兼容数字账号 ID，并且缺失账号信息不能视为自己的任务', () => {
    assert.equal(canAccessTask({ creatorUserId: '123' }, 123, false), true)
    assert.equal(canAccessTask({ creatorUserId: undefined }, undefined, false), false)
    assert.equal(canAccessTask({ creatorUserId: '' }, '', false), false)
  })
})
