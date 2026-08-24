import type { z } from 'zod'
import { describe, expect, it } from 'vitest'
import {
  AgentApprovalRequestedDataSchema,
  AgentApprovalResolvedDataSchema,
  AgentArtifactCreatedDataSchema,
  AgentContentDeltaDataSchema,
  AgentContextCompactedDataSchema,
  AgentConversationRunEventDTOSchema,
  AgentLifecycleDataSchema,
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
  AgentPlanUpdatedDataSchema,
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
  { type: 'plan_updated', schema: AgentPlanUpdatedDataSchema, data: { todos: [{ content: 'work' }], workerId: 'worker-1' } },
  { type: 'thinking_delta', schema: AgentThinkingDeltaDataSchema, data: { id: 'llm-0', thinkingId: 'thinking-1', text: 'Checking', workerId: 'worker-1' } },
  {
    type: 'thinking_completed',
    schema: AgentThinkingCompletedDataSchema,
    data: { id: 'llm-0', thinkingId: 'thinking-1', startTimestamp: 1, endTimestamp: 2, durationMs: 1, workerId: 'worker-1' },
  },
  { type: 'content_delta', schema: AgentContentDeltaDataSchema, data: { id: 'llm-0', contentId: 'content-1', text: 'Done', phase: 'answer', workerId: 'worker-1' } },
  { type: 'tool_started', schema: AgentToolStartedDataSchema, data: { toolName: 'apply_patch', input: {}, toolId: 'tool-1', workerId: 'worker-1', patchType: 'update', target: '/tmp/report.txt' } },
  { type: 'tool_finished', schema: AgentToolFinishedDataSchema, data: { toolName: 'browser_click', output: { ok: true }, toolId: 'tool-1', status: 'success', durationMs: 10 } },
  { type: 'worker_dispatched', schema: AgentWorkerDispatchedDataSchema, data: { workerId: 'worker-1', title: 'Collect data' } },
  { type: 'worker_completed', schema: AgentWorkerCompletedDataSchema, data: { workerId: 'worker-1', status: 'success', exitCode: 0, signal: null, durationMs: 10 } },
  {
    type: 'agent_lifecycle',
    schema: AgentLifecycleDataSchema,
    data: {
      agentPath: '/root/profile_one',
      parentAgentPath: '/root',
      agentName: 'profile_one',
      agentType: 'browser_worker',
      status: 'completed',
      startedAt: 1,
      finishedAt: 2,
      report: 'Done',
    },
  },
  { type: 'run_retrying', schema: AgentRunRetryingDataSchema, data: { retryId: 'retry-1', attempt: 2, maxAttempts: 3, reason: 'timeout', workerId: 'worker-1' } },
  { type: 'context_compacted', schema: AgentContextCompactedDataSchema, data: { status: 'completed', compactedCount: 3, workerId: 'worker-1' } },
  {
    type: 'approval_requested',
    schema: AgentApprovalRequestedDataSchema,
    data: {
      approvalId: 'approval-1',
      actionRequests: [],
      reviewConfigs: [],
      requestKind: 'clarification',
      title: '需要您的输入',
      prompt: '选择目标地区',
      controls: [{ id: 'answer', kind: 'choice', options: [{ id: 'cn', label: '中国', value: '中国' }] }],
      values: { answer: null },
    },
  },
  { type: 'approval_resolved', schema: AgentApprovalResolvedDataSchema, data: { approvalId: 'approval-1', decisions: [{ type: 'approve' }] } },
  { type: 'script_output', schema: AgentScriptOutputDataSchema, data: { scriptName: 'report', level: 'info', message: 'done', scriptRunId: 'script-1', dirId: 'dir-1', workerId: 'worker-1', unavailableReason: 'file_missing' } },
  { type: 'artifact_created', schema: AgentArtifactCreatedDataSchema, data: { fileId: 'file-1', fileName: 'report.csv', size: 10, mimeType: 'text/csv', operation: 'create' } },
  { type: 'token_usage', schema: AgentTokenUsageDataSchema, data: { current: { input: 10 }, delta: { input: 2 } } },
  { type: 'context_compacted', schema: AgentContextCompactedDataSchema, data: { status: 'completed', compactedCount: 12, summary: 'Older context summarized' } },
  { type: 'run_completed', schema: AgentRunCompletedDataSchema, data: { finalAnswer: 'Complete' } },
  { type: 'run_failed', schema: AgentRunFailedDataSchema, data: { code: 'UPSTREAM_ERROR', message: 'failed', retryable: true, httpStatus: 503 } },
  { type: 'run_cancelled', schema: AgentRunCancelledDataSchema, data: { reason: 'user', message: 'Stopped' } },
]

describe('conversation event schemas', () => {
  it('keeps the legacy approval request shape compatible', () => {
    expect(AgentApprovalRequestedDataSchema.safeParse({
      approvalId: 'approval-1',
      actionRequests: [{ name: 'write' }],
      reviewConfigs: [],
    }).success).toBe(true)
  })

  it('accepts structured clarification questions on approval requests', () => {
    expect(AgentApprovalRequestedDataSchema.safeParse({
      approvalId: 'clarification-1',
      actionRequests: [],
      reviewConfigs: [],
      requestKind: 'clarification',
      prompt: 'Which region should we use?',
      controls: [],
      values: { answer: null },
      questions: [
        {
          header: 'Region',
          id: 'region',
          question: 'Which region should we use?',
          options: [
            { label: 'US', description: 'Use the United States region.' },
            { label: 'EU', description: 'Use the European region.' },
          ],
        },
        {
          header: 'Mode',
          id: 'mode',
          question: 'Which mode should we use?',
          options: [
            { label: 'Safe', description: 'Prefer conservative defaults.' },
            { label: 'Fast', description: 'Prioritize speed.' },
          ],
        },
      ],
    }).success).toBe(true)
  })

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
    expect(AgentContextCompactedDataSchema.safeParse({ compactedCount: 1 }).success).toBe(true)
    expect(AgentContextCompactedDataSchema.safeParse({ compactedCount: -1 }).success).toBe(false)
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
