import type { z } from 'zod'
import { describe, expect, it } from 'vitest'
import {
  AgentTaskArtifactDTOSchema,
  AgentTaskConversationMessageDTOSchema,
  AgentTaskExecutionDetailDTOSchema,
  AgentTaskExecutionEventPayloadSchema,
  AgentTaskExecutionEventSchema,
  AgentTaskExecutionReplaySchema,
  AgentTaskLogDTOSchema,
  AgentTaskLogStatusSchema,
  AgentTaskMonitorBrowserEventSchema,
  AgentTaskMonitorBrowserSessionSchema,
  AgentTaskMonitorEventStageSchema,
  AgentTaskMonitorSnapshotSchema,
  AgentTaskMonitorSourceTypeSchema,
  AgentTaskMonitorTaskSchema,
  AgentProfileMonitorProfileSchema,
  AgentProfileMonitorSnapshotSchema,
  AgentTaskScriptRunDTOSchema,
  AgentTaskScriptWindowDTOSchema,
  AgentTaskScriptWindowStatusSchema,
  AgentTaskTriggerTypeSchema,
} from './task-messages'

describe('profile monitor schemas', () => {
  it('validates running and idle profiles strictly', () => {
    const running = {
      dirId: 'dir-1',
      status: 'running',
      endpoint: 'ws://127.0.0.1/devtools/browser/one',
      browserType: 'chromium',
      connectedAt: 1,
      updatedAt: 2,
      owner: {
        taskId: 'task-1',
        title: 'Operate profile',
        sourceType: 'chat',
        conversationId: 'conversation-1',
        runId: 'run-1',
        startedAt: 1,
      },
      events: [],
    }
    const idle = {
      dirId: 'dir-2',
      status: 'idle',
      connectedAt: 1,
      updatedAt: 3,
      idleSince: 2,
      events: [],
    }

    expectStrictModel(AgentProfileMonitorProfileSchema, running)
    expectStrictModel(AgentProfileMonitorProfileSchema, idle)
    expectStrictModel(AgentProfileMonitorSnapshotSchema, {
      type: 'snapshot',
      data: { generatedAt: 3, profiles: [running, idle] },
    })
  })
})

const artifact = {
  fileId: 'file-1',
  fileName: 'report.csv',
  mimeType: 'text/csv',
  size: 10,
}

const conversationMessage = {
  id: 'message-1',
  role: 'assistant',
  content: 'Done',
  createdAt: '2026-07-28T00:00:01.000Z',
}

const scriptRun = {
  dirId: 'window-1',
  slug: 'report',
  runId: 'run-1',
  fileIds: ['file-1'],
}

const taskLog = {
  id: 'log-1',
  taskId: 1,
  taskName: 'Daily report',
  templateId: 2,
  templateName: 'Report',
  templateType: 'script',
  triggerType: 'cron',
  occurrenceId: 'occurrence-1',
  scheduledAt: '2026-07-28T00:00:00.000Z',
  input: { format: 'csv' },
  windowDirIds: ['window-1'],
  scriptRuns: [scriptRun],
  conversationId: null,
  fileIds: ['file-1'],
  status: 'success',
  success: true,
  startedAt: '2026-07-28T00:00:00.000Z',
  endedAt: '2026-07-28T00:00:01.000Z',
  durationMs: 1000,
  endReasonCode: null,
}

const scriptWindow = {
  key: 'window-1',
  dirId: 'window-1',
  runId: 'run-1',
  label: 'Window 1',
  status: 'success',
  log: 'done',
  artifacts: [artifact],
  failedFiles: [],
}

const executionPayloadCases: Array<{
  type: string
  payload: Record<string, unknown>
}> = [
  { type: 'agent.message.upsert', payload: { type: 'agent.message.upsert', conversationId: 'conversation-1', message: conversationMessage } },
  { type: 'agent.message.delta', payload: { type: 'agent.message.delta', conversationId: 'conversation-1', messageId: 'message-1', delta: 'Done', createdAt: '2026-07-28T00:00:01.000Z' } },
  { type: 'script.window.started', payload: { type: 'script.window.started', window: { key: 'window-1', dirId: 'window-1', runId: 'run-1', label: 'Window 1' } } },
  { type: 'script.log.append', payload: { type: 'script.log.append', windowKey: 'window-1', text: 'start\n' } },
  { type: 'script.log.replace', payload: { type: 'script.log.replace', windowKey: 'window-1', text: 'done\n' } },
  { type: 'script.window.finished', payload: { type: 'script.window.finished', windowKey: 'window-1', status: 'success', failedFiles: [] } },
  { type: 'artifacts.updated', payload: { type: 'artifacts.updated', windowKey: 'window-1', artifacts: [artifact] } },
]

const browserEvent = {
  id: 'event-1',
  stage: 'end',
  toolName: 'browser_click',
  input: { selector: '#save' },
  result: 'clicked',
  success: true,
  durationMs: 10,
  timestamp: 100,
  workerId: 'worker-1',
  conversationId: 'conversation-1',
}

const browserSession = {
  id: 'browser-1',
  dirId: 'window-1',
  label: 'Window 1',
  ws: 'ws://127.0.0.1/devtools/browser/1',
  browserType: 'chromium',
  windowName: 'Main',
  windowSortNum: 1,
  platformUrl: 'https://example.com',
  platformUserName: 'user',
  platformIcon: 'https://example.com/icon.png',
  countryCode: 'JP',
  startedAt: 1,
  updatedAt: 2,
  events: [browserEvent],
}

const monitorTask = {
  id: 'task-1',
  title: 'Daily report',
  sourceType: 'task',
  status: 'running',
  conversationId: 'conversation-1',
  runId: 'run-1',
  startedAt: 1,
  updatedAt: 2,
  browsers: [browserSession],
}

function expectStrictModel(schema: z.ZodType, value: Record<string, unknown>): void {
  expect(schema.safeParse(value).success).toBe(true)
  expect(schema.safeParse({ ...value, unexpected: true }).success).toBe(false)
}

describe('task channel schemas', () => {
  it('validates task enums', () => {
    expect(AgentTaskLogStatusSchema.safeParse('running').success).toBe(true)
    expect(AgentTaskLogStatusSchema.safeParse('pending').success).toBe(false)
    expect(AgentTaskTriggerTypeSchema.safeParse('cron').success).toBe(true)
    expect(AgentTaskTriggerTypeSchema.safeParse('interval').success).toBe(false)
    expect(AgentTaskScriptWindowStatusSchema.safeParse('interrupted').success).toBe(true)
    expect(AgentTaskScriptWindowStatusSchema.safeParse('cancelled').success).toBe(false)
    expect(AgentTaskMonitorSourceTypeSchema.safeParse('worker').success).toBe(true)
    expect(AgentTaskMonitorSourceTypeSchema.safeParse('browser').success).toBe(false)
    expect(AgentTaskMonitorEventStageSchema.safeParse('error').success).toBe(true)
    expect(AgentTaskMonitorEventStageSchema.safeParse('progress').success).toBe(false)
  })

  it('validates task log models strictly', () => {
    expectStrictModel(AgentTaskScriptRunDTOSchema, scriptRun)
    expectStrictModel(AgentTaskLogDTOSchema, taskLog)
    expect(AgentTaskLogDTOSchema.safeParse({ ...taskLog, success: 'true' }).success).toBe(false)
  })

  it('validates task execution detail models strictly', () => {
    expectStrictModel(AgentTaskArtifactDTOSchema, artifact)
    expectStrictModel(AgentTaskConversationMessageDTOSchema, conversationMessage)
    expectStrictModel(AgentTaskScriptWindowDTOSchema, scriptWindow)
    expectStrictModel(AgentTaskExecutionDetailDTOSchema, {
      taskLogId: 'log-1',
      revision: 1,
      conversationId: 'conversation-1',
      messages: [conversationMessage],
      artifacts: [artifact],
      scriptWindows: [scriptWindow],
    })
  })

  it.each(executionPayloadCases)('validates $type execution payload', ({ payload }) => {
    expect(AgentTaskExecutionEventPayloadSchema.safeParse(payload).success).toBe(true)
    expect(AgentTaskExecutionEventPayloadSchema.safeParse({ ...payload, unexpected: true }).success).toBe(false)
  })

  it('validates execution event and replay models strictly', () => {
    const event = {
      taskLogId: 'log-1',
      sequence: 1,
      createdAt: '2026-07-28T00:00:01.000Z',
      payload: executionPayloadCases[3]!.payload,
    }
    expectStrictModel(AgentTaskExecutionEventSchema, event)
    expectStrictModel(AgentTaskExecutionReplaySchema, {
      taskLogId: 'log-1',
      revision: 1,
      events: [event],
    })
  })

  it('validates task monitor models strictly', () => {
    expectStrictModel(AgentTaskMonitorBrowserEventSchema, browserEvent)
    expectStrictModel(AgentTaskMonitorBrowserSessionSchema, browserSession)
    expectStrictModel(AgentTaskMonitorTaskSchema, monitorTask)
    expectStrictModel(AgentTaskMonitorSnapshotSchema, {
      type: 'snapshot',
      data: { generatedAt: 2, tasks: [monitorTask] },
    })
  })
})
