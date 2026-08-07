import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AgentChannelMessage, AgentTaskLogDTO } from '@roxy/shared/channel'
import {
  applyAgentChannelMessage,
  collectTaskConversationIds,
  createAgentChannelDedupState,
  replaceTaskExecutionReplays,
  type AgentChannelDataState,
} from './agent-channel-state'

function taskLog(id: string, status: AgentTaskLogDTO['status'], startedAt: string): AgentTaskLogDTO {
  return {
    id,
    taskId: 1,
    taskName: 'Task',
    templateId: 2,
    templateName: 'Template',
    templateType: 'script',
    triggerType: 'manual',
    occurrenceId: null,
    scheduledAt: null,
    input: null,
    windowDirIds: [],
    scriptRuns: [],
    conversationId: null,
    fileIds: [],
    status,
    success: status === 'success',
    startedAt,
    endedAt: null,
    durationMs: null,
    endReasonCode: null,
  }
}

function state(): AgentChannelDataState {
  return {
    taskLogs: [],
    taskLogsReady: false,
    taskExecutionDetails: {},
    taskExecutionReady: false,
    taskExecutionGapDetected: false,
  }
}

describe('agent channel state', () => {
  it('collects unique task conversation ids from logs and execution details', () => {
    const dataState = state()
    dataState.taskLogs = [
      { ...taskLog('log-1', 'running', '2026-07-24T01:00:00.000Z'), conversationId: 'conversation-1' },
      { ...taskLog('log-2', 'running', '2026-07-24T02:00:00.000Z'), conversationId: null },
    ]
    dataState.taskExecutionDetails = {
      'log-1': {
        taskLogId: 'log-1',
        revision: 1,
        conversationId: 'conversation-1',
        messages: [],
        artifacts: [],
        scriptWindows: [],
      },
      'log-2': {
        taskLogId: 'log-2',
        revision: 1,
        conversationId: 'conversation-2',
        messages: [],
        artifacts: [],
        scriptWindows: [],
      },
    }

    assert.deepEqual(collectTaskConversationIds(dataState), [
      'conversation-1',
      'conversation-2',
    ])
  })

  it('replaces snapshots, upserts changes, and removes deleted logs', () => {
    const dataState = state()
    const dedupState = createAgentChannelDedupState()
    const older = taskLog('older', 'success', '2026-07-24T01:00:00.000Z')
    const newer = taskLog('newer', 'preparing', '2026-07-24T02:00:00.000Z')

    applyAgentChannelMessage(dataState, dedupState, {
      id: 'message-1',
      type: 'task_logs.snapshot',
      data: { items: [older, newer] },
    })
    assert.equal(dataState.taskLogsReady, true)
    assert.deepEqual(dataState.taskLogs.map(log => log.id), ['newer', 'older'])

    applyAgentChannelMessage(dataState, dedupState, {
      id: 'message-2',
      type: 'task_log.changed',
      data: { ...newer, status: 'running' },
    })
    assert.equal(dataState.taskLogs[0]?.status, 'running')

    applyAgentChannelMessage(dataState, dedupState, {
      id: 'message-3',
      type: 'task_log.deleted',
      data: { logId: 'newer' },
    })
    assert.deepEqual(dataState.taskLogs.map(log => log.id), ['older'])
  })

  it('keeps the complete task log snapshot', () => {
    const dataState = state()
    const items = Array.from({ length: 250 }, (_, index) => taskLog(
      `log-${index}`,
      'success',
      new Date(Date.UTC(2026, 6, 24, 0, index)).toISOString(),
    ))

    applyAgentChannelMessage(dataState, createAgentChannelDedupState(), {
      id: 'message-complete-snapshot',
      type: 'task_logs.snapshot',
      data: { items },
    })

    assert.equal(dataState.taskLogsReady, true)
    assert.equal(dataState.taskLogs.length, 250)
  })

  it('ignores a retried message with the same UUID', () => {
    const dataState = state()
    const dedupState = createAgentChannelDedupState()
    const first = taskLog('log-1', 'preparing', '2026-07-24T01:00:00.000Z')
    const retried: AgentChannelMessage<'task_log.changed'> = {
      id: '019f91e2-5aa3-7a6a-8ef8-a5bdaf71c9ad',
      type: 'task_log.changed',
      data: { ...first, status: 'running' },
    }

    assert.equal(applyAgentChannelMessage(dataState, dedupState, {
      id: retried.id,
      type: retried.type,
      data: first,
    }), true)
    assert.equal(applyAgentChannelMessage(dataState, dedupState, retried), false)
    assert.equal(dataState.taskLogs[0]?.status, 'preparing')
  })

  it('replaces the task-monitor snapshot on reconnect calibration', () => {
    const dataState = state()
    const dedupState = createAgentChannelDedupState()
    const message: AgentChannelMessage = {
      id: 'message-monitor',
      type: 'task_monitor.snapshot',
      data: {
        type: 'snapshot',
        data: { generatedAt: 123, tasks: [] },
      },
    }

    applyAgentChannelMessage(dataState, dedupState, message)
    assert.equal(dataState.taskMonitorSnapshot?.data.generatedAt, 123)
  })

  it('hydrates execution details and applies sequenced live increments', () => {
    const dataState = state()
    const dedupState = createAgentChannelDedupState()
    replaceTaskExecutionReplays(dataState, [{
      taskLogId: 'log-1',
      revision: 1,
      events: [{
        taskLogId: 'log-1',
        sequence: 1,
        createdAt: '2026-07-24T01:00:00.000Z',
        payload: {
          type: 'script.window.started',
          window: { key: 'window-1', dirId: 'window-1', runId: 'run-1', label: '1' },
        },
      }],
    }])
    applyAgentChannelMessage(dataState, dedupState, {
      id: 'detail-increment',
      type: 'task_execution.event',
      data: {
        taskLogId: 'log-1',
        sequence: 2,
        createdAt: '2026-07-24T01:00:01.000Z',
        payload: { type: 'script.log.append', windowKey: 'window-1', text: '执行中\n' },
      },
    })

    assert.equal(dataState.taskExecutionReady, true)
    assert.equal(dataState.taskExecutionDetails['log-1']?.revision, 2)
    assert.equal(dataState.taskExecutionDetails['log-1']?.scriptWindows[0]?.log, '执行中\n')
    assert.equal(dataState.taskExecutionGapDetected, false)
  })

  it('keeps conversation messages in event sequence even when timestamps are equal or earlier', () => {
    const dataState = state()
    replaceTaskExecutionReplays(dataState, [{
      taskLogId: 'log-1',
      revision: 3,
      events: [
        {
          taskLogId: 'log-1',
          sequence: 1,
          createdAt: '2026-07-24T01:00:01.000Z',
          payload: {
            type: 'agent.message.upsert',
            conversationId: 'conversation-1',
            message: {
              id: 'user-1',
              role: 'user',
              content: '开始任务',
              createdAt: '2026-07-24T01:00:01.000Z',
            },
          },
        },
        {
          taskLogId: 'log-1',
          sequence: 2,
          createdAt: '2026-07-24T01:00:00.000Z',
          payload: {
            type: 'agent.message.delta',
            conversationId: 'conversation-1',
            messageId: 'assistant-1',
            delta: '第一条回复',
            createdAt: '2026-07-24T01:00:00.000Z',
          },
        },
        {
          taskLogId: 'log-1',
          sequence: 3,
          createdAt: '2026-07-24T01:00:02.000Z',
          payload: {
            type: 'agent.message.delta',
            conversationId: 'conversation-1',
            messageId: 'assistant-2',
            delta: '第二条回复',
            createdAt: '2026-07-24T01:00:02.000Z',
          },
        },
      ],
    }])

    assert.deepEqual(
      dataState.taskExecutionDetails['log-1']?.messages.map(message => [message.role, message.content]),
      [
        ['user', '开始任务'],
        ['assistant', '第一条回复'],
        ['assistant', '第二条回复'],
      ],
    )
  })

  it('detects a missing sequence so the channel can call the replay API to calibrate', () => {
    const dataState = state()
    applyAgentChannelMessage(dataState, createAgentChannelDedupState(), {
      id: 'detail-gap',
      type: 'task_execution.event',
      data: {
        taskLogId: 'log-1',
        sequence: 2,
        createdAt: '2026-07-24T01:00:01.000Z',
        payload: {
          type: 'agent.message.delta',
          conversationId: 'conversation-1',
          messageId: 'message-1',
          delta: '遗漏首段',
          createdAt: '2026-07-24T01:00:01.000Z',
        },
      },
    })

    assert.equal(dataState.taskExecutionGapDetected, true)
    assert.equal(dataState.taskExecutionDetails['log-1'], undefined)
  })
})
