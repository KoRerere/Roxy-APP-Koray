import type { z } from 'zod'
import { describe, expect, it } from 'vitest'
import {
  AgentChannelMessageSchema,
  AgentChannelReadyDataSchema,
  AgentChannelReadyMessageSchema,
  AgentConversationRunEventMessageSchema,
  AgentExecutionCenterSnapshotMessageSchema,
  AgentProfileMonitorSnapshotMessageSchema,
  AgentTaskExecutionEventMessageSchema,
  AgentTaskLogChangedMessageSchema,
  AgentTaskLogDeletedDataSchema,
  AgentTaskLogDeletedMessageSchema,
  AgentTaskLogsSnapshotDataSchema,
  AgentTaskLogsSnapshotMessageSchema,
  AgentTaskMonitorSnapshotMessageSchema,
} from './server-messages'

const taskLog = {
  id: 'log-1',
  taskId: 1,
  taskName: 'Daily report',
  templateId: 2,
  templateName: 'Report',
  templateType: 'prompt',
  triggerType: 'manual',
  occurrenceId: null,
  scheduledAt: null,
  input: {},
  windowDirIds: [],
  scriptRuns: [],
  conversationId: 'conversation-1',
  fileIds: [],
  status: 'running',
  success: false,
  startedAt: '2026-07-28T00:00:00.000Z',
  endedAt: null,
  durationMs: null,
  endReasonCode: null,
}

const serverMessageCases: Array<{
  type: string
  schema: z.ZodType
  data: unknown
}> = [
  {
    type: 'channel.ready',
    schema: AgentChannelReadyMessageSchema,
    data: { connectedAt: '2026-07-28T00:00:00.000Z' },
  },
  {
    type: 'task_logs.snapshot',
    schema: AgentTaskLogsSnapshotMessageSchema,
    data: { items: [taskLog] },
  },
  { type: 'task_log.changed', schema: AgentTaskLogChangedMessageSchema, data: taskLog },
  { type: 'task_log.deleted', schema: AgentTaskLogDeletedMessageSchema, data: { logId: 'log-1' } },
  {
    type: 'task_execution.event',
    schema: AgentTaskExecutionEventMessageSchema,
    data: {
      taskLogId: 'log-1',
      sequence: 1,
      createdAt: '2026-07-28T00:00:01.000Z',
      payload: { type: 'script.log.append', windowKey: 'window-1', text: 'started\n' },
    },
  },
  {
    type: 'task_monitor.snapshot',
    schema: AgentTaskMonitorSnapshotMessageSchema,
    data: { type: 'snapshot', data: { generatedAt: 1, tasks: [] } },
  },
  {
    type: 'profile_monitor.snapshot',
    schema: AgentProfileMonitorSnapshotMessageSchema,
    data: {
      type: 'snapshot',
      data: {
        generatedAt: 1,
        profiles: [{
          dirId: 'dir-1',
          status: 'idle',
          endpoint: 'ws://localhost/devtools/browser/1',
          browserType: 'chromium',
          connectedAt: 1,
          updatedAt: 1,
          idleSince: 1,
          events: [],
        }],
      },
    },
  },
  {
    type: 'conversation.run.event',
    schema: AgentConversationRunEventMessageSchema,
    data: {
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      sequence: 1,
      timestamp: 1,
      event: { type: 'user_message', data: { messageId: 'message-1', content: 'hello', attachments: [], createdAt: 1 } },
    },
  },
  {
    type: 'execution_center.snapshot',
    schema: AgentExecutionCenterSnapshotMessageSchema,
    data: {
      type: 'snapshot',
      generatedAt: 1,
      entries: [{
        id: 'run-1',
        source: 'conversation',
        status: 'running',
        conversationId: 'conversation-1',
        createdAt: 1,
        startedAt: 1,
        updatedAt: 1,
      }],
    },
  },
]

describe('server channel message schemas', () => {
  it('validates server message data models strictly', () => {
    expect(AgentChannelReadyDataSchema.safeParse({ connectedAt: '2026-07-28T00:00:00.000Z' }).success).toBe(true)
    expect(AgentChannelReadyDataSchema.safeParse({ connectedAt: 'now', unexpected: true }).success).toBe(false)
    expect(AgentTaskLogsSnapshotDataSchema.safeParse({ items: [taskLog] }).success).toBe(true)
    expect(AgentTaskLogsSnapshotDataSchema.safeParse({ items: 'invalid' }).success).toBe(false)
    expect(AgentTaskLogDeletedDataSchema.safeParse({ logId: 'log-1' }).success).toBe(true)
    expect(AgentTaskLogDeletedDataSchema.safeParse({ logId: 1 }).success).toBe(false)
  })

  it.each(serverMessageCases)('validates $type envelope and union branch', ({ type, schema, data }) => {
    const message = { id: 'message-1', type, data }
    expect(schema.safeParse(message).success).toBe(true)
    expect(AgentChannelMessageSchema.safeParse(message).success).toBe(true)
    expect(schema.safeParse({ ...message, unexpected: true }).success).toBe(false)
  })

  it('rejects unknown message types and malformed nested data', () => {
    expect(AgentChannelMessageSchema.safeParse({ id: 'message-1', type: 'unknown', data: {} }).success).toBe(false)
    expect(AgentChannelMessageSchema.safeParse({ id: 'message-1', type: 'task_logs.snapshot', data: { items: [{}] } }).success).toBe(false)
    expect(AgentChannelMessageSchema.safeParse({ id: '', type: 'channel.ready', data: { connectedAt: 'now' } }).success).toBe(false)
  })
})
