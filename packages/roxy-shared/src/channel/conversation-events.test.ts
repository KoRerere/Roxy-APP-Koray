import type { z } from 'zod'
import { describe, expect, it } from 'vitest'
import {
  AgentApprovalRequestedDataSchema,
  AgentApprovalResolvedDataSchema,
  AgentArtifactCreatedDataSchema,
  AgentContentDeltaDataSchema,
  AgentConversationRunEventDTOSchema,
  AgentRunAttachmentDTOSchema,
  AgentRunCancelledDataSchema,
  AgentRunCompletedDataSchema,
  AgentRunEventDataSchemas,
  AgentRunEventSchema,
  AgentRunFailedDataSchema,
  AgentRunRetryingDataSchema,
  AgentRunStartedDataSchema,
  AgentRunTerminalStatusSchema,
  AgentScriptOutputDataSchema,
  AgentThinkingCompletedDataSchema,
  AgentThinkingDeltaDataSchema,
  AgentTitleChangedDataSchema,
  AgentTodoDeltaDataSchema,
  AgentTokenUsageDataSchema,
  AgentToolFinishedDataSchema,
  AgentToolStartedDataSchema,
  AgentUserMessageDataSchema,
  AgentWorkerCompletedDataSchema,
  AgentWorkerDispatchedDataSchema,
} from './conversation-events'

const eventCases: Array<{
  type: keyof typeof AgentRunEventDataSchemas
  schema: z.ZodType
  data: Record<string, unknown>
}> = [
  {
    type: 'run_started',
    schema: AgentRunStartedDataSchema,
    data: { requestId: 'request-1', source: 'user', assistantMessageId: 'assistant-1', startedAt: 1 },
  },
  {
    type: 'user_message',
    schema: AgentUserMessageDataSchema,
    data: { messageId: 'message-1', content: 'hello', attachments: [], createdAt: 2 },
  },
  { type: 'title_changed', schema: AgentTitleChangedDataSchema, data: { title: 'New title' } },
  { type: 'todo_delta', schema: AgentTodoDeltaDataSchema, data: { todos: [{ content: 'work' }], workerId: 'worker-1' } },
  { type: 'thinking_delta', schema: AgentThinkingDeltaDataSchema, data: { thinkingId: 'thinking-1', text: 'Checking', workerId: 'worker-1' } },
  {
    type: 'thinking_completed',
    schema: AgentThinkingCompletedDataSchema,
    data: { thinkingId: 'thinking-1', startTimestamp: 1, endTimestamp: 2, durationMs: 1, workerId: 'worker-1' },
  },
  { type: 'content_delta', schema: AgentContentDeltaDataSchema, data: { contentId: 'content-1', text: 'Done', phase: 'answer', workerId: 'worker-1' } },
  { type: 'tool_started', schema: AgentToolStartedDataSchema, data: { toolName: 'browser_click', input: { selector: '#save' }, toolId: 'tool-1', workerId: 'worker-1' } },
  { type: 'tool_finished', schema: AgentToolFinishedDataSchema, data: { toolName: 'browser_click', output: { ok: true }, toolId: 'tool-1', status: 'success', durationMs: 10 } },
  { type: 'worker_dispatched', schema: AgentWorkerDispatchedDataSchema, data: { workerId: 'worker-1', title: 'Collect data' } },
  { type: 'worker_completed', schema: AgentWorkerCompletedDataSchema, data: { workerId: 'worker-1', status: 'success', exitCode: 0, signal: null, durationMs: 10 } },
  { type: 'run_retrying', schema: AgentRunRetryingDataSchema, data: { retryId: 'retry-1', attempt: 2, maxAttempts: 3, reason: 'timeout', workerId: 'worker-1' } },
  { type: 'approval_requested', schema: AgentApprovalRequestedDataSchema, data: { approvalId: 'approval-1', actionRequests: [{ name: 'write' }], reviewConfigs: [] } },
  { type: 'approval_resolved', schema: AgentApprovalResolvedDataSchema, data: { approvalId: 'approval-1', decisions: [{ type: 'approve' }] } },
  { type: 'script_output', schema: AgentScriptOutputDataSchema, data: { scriptName: 'report', level: 'info', message: 'done', scriptRunId: 'script-1', workerId: 'worker-1' } },
  { type: 'artifact_created', schema: AgentArtifactCreatedDataSchema, data: { fileId: 'file-1', fileName: 'report.csv', size: 10, mimeType: 'text/csv', operation: 'create' } },
  { type: 'token_usage', schema: AgentTokenUsageDataSchema, data: { current: { input: 10 }, delta: { input: 2 } } },
  { type: 'run_completed', schema: AgentRunCompletedDataSchema, data: { finalAnswer: 'Complete' } },
  { type: 'run_failed', schema: AgentRunFailedDataSchema, data: { code: 'UPSTREAM_ERROR', message: 'failed', retryable: true, httpStatus: 503 } },
  { type: 'run_cancelled', schema: AgentRunCancelledDataSchema, data: { reason: 'user', message: 'Stopped' } },
]

describe('conversation event schemas', () => {
  it('validates attachment and terminal status models', () => {
    expect(AgentRunAttachmentDTOSchema.safeParse({ fileId: 'file-1', size: 10 }).success).toBe(true)
    expect(AgentRunAttachmentDTOSchema.safeParse({ fileId: 'file-1', unexpected: true }).success).toBe(false)
    expect(AgentRunTerminalStatusSchema.safeParse('completed').success).toBe(true)
    expect(AgentRunTerminalStatusSchema.safeParse('running').success).toBe(false)
  })

  it.each(eventCases)('validates $type data and its canonical event branch', ({ type, schema, data }) => {
    expect(schema.safeParse(data).success).toBe(true)
    expect(schema.safeParse({ ...data, unexpected: true }).success).toBe(false)
    expect(AgentRunEventDataSchemas[type].safeParse(data).success).toBe(true)
    expect(AgentRunEventSchema.safeParse({ type, data }).success).toBe(true)
  })

  it('rejects unknown canonical event types and invalid nested data', () => {
    expect(AgentRunEventSchema.safeParse({ type: 'unknown', data: {} }).success).toBe(false)
    expect(AgentRunEventSchema.safeParse({ type: 'run_failed', data: { code: 'FAILED' } }).success).toBe(false)
    expect(AgentRunEventSchema.safeParse({
      type: 'run_completed',
      data: {},
      unexpected: true,
    }).success).toBe(false)
  })

  it('validates the conversation run event DTO strictly', () => {
    const event = {
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      sequence: 1,
      timestamp: 100,
      event: { type: 'run_completed', data: { finalAnswer: 'Done' } },
    }
    expect(AgentConversationRunEventDTOSchema.safeParse(event).success).toBe(true)
    expect(AgentConversationRunEventDTOSchema.safeParse({ ...event, startSequence: 1 }).success).toBe(true)
    expect(AgentConversationRunEventDTOSchema.safeParse({ ...event, startSequence: 0 }).success).toBe(false)
    expect(AgentConversationRunEventDTOSchema.safeParse({ ...event, startSequence: 1.5 }).success).toBe(false)
    expect(AgentConversationRunEventDTOSchema.safeParse({ ...event, sequence: '1' }).success).toBe(false)
    expect(AgentConversationRunEventDTOSchema.safeParse({ ...event, unexpected: true }).success).toBe(false)
  })
})
