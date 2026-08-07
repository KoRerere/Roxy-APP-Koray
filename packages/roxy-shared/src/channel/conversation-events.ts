import { z } from 'zod'

export const AgentRunAttachmentDTOSchema = z.strictObject({
  fileId: z.string(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  url: z.string().optional(),
  localUrl: z.string().optional(),
  remoteUrl: z.string().optional(),
  fileUrl: z.string().optional(),
})

export type AgentRunAttachmentDTO = z.infer<typeof AgentRunAttachmentDTOSchema>

export const AgentRunTerminalStatusSchema = z.enum(['completed', 'failed', 'cancelled'])

export type AgentRunTerminalStatus = z.infer<typeof AgentRunTerminalStatusSchema>

export const AgentRunStartedDataSchema = z.strictObject({
  requestId: z.string().optional(),
  source: z.enum(['user', 'scheduled_task']),
  assistantMessageId: z.string(),
  startedAt: z.number(),
})

export const AgentUserMessageDataSchema = z.strictObject({
  messageId: z.string(),
  content: z.string(),
  attachments: z.array(AgentRunAttachmentDTOSchema),
  createdAt: z.number(),
})

export const AgentTitleChangedDataSchema = z.strictObject({
  title: z.string(),
})

export const AgentTodoDeltaDataSchema = z.strictObject({
  todos: z.array(z.unknown()),
  workerId: z.string().optional(),
})

export const AgentThinkingDeltaDataSchema = z.strictObject({
  thinkingId: z.string(),
  text: z.string(),
  workerId: z.string().optional(),
})

export const AgentThinkingCompletedDataSchema = z.strictObject({
  thinkingId: z.string(),
  startTimestamp: z.number(),
  endTimestamp: z.number(),
  durationMs: z.number(),
  workerId: z.string().optional(),
})

export const AgentContentDeltaDataSchema = z.strictObject({
  contentId: z.string(),
  text: z.string(),
  phase: z.enum(['answer', 'synthesis']).optional(),
  workerId: z.string().optional(),
})

export const AgentToolStartedDataSchema = z.strictObject({
  toolName: z.string(),
  input: z.unknown(),
  toolId: z.string().optional(),
  workerId: z.string().optional(),
  assignmentsCount: z.number().optional(),
  skillName: z.string().optional(),
  skillFilePath: z.string().optional(),
  target: z.string().optional(),
})

export const AgentToolFinishedDataSchema = z.strictObject({
  toolName: z.string(),
  output: z.unknown(),
  toolId: z.string().optional(),
  workerId: z.string().optional(),
  durationMs: z.number().optional(),
  status: z.enum(['success', 'failed', 'cancelled']).optional(),
})

export const AgentWorkerDispatchedDataSchema = z.strictObject({
  workerId: z.string(),
  title: z.string(),
})

export const AgentWorkerCompletedDataSchema = z.strictObject({
  workerId: z.string(),
  status: z.enum(['success', 'failed', 'cancelled', 'timeout']),
  exitCode: z.number().nullable().optional(),
  signal: z.string().nullable().optional(),
  error: z.unknown().optional(),
  durationMs: z.number().optional(),
})

export const AgentRunRetryingDataSchema = z.strictObject({
  retryId: z.string().optional(),
  attempt: z.number(),
  maxAttempts: z.number(),
  reason: z.string().optional(),
  workerId: z.string().optional(),
})

export const AgentApprovalRequestedDataSchema = z.strictObject({
  approvalId: z.string(),
  actionRequests: z.array(z.unknown()),
  reviewConfigs: z.array(z.unknown()),
})

export const AgentApprovalResolvedDataSchema = z.strictObject({
  approvalId: z.string(),
  decisions: z.array(z.unknown()),
})

export const AgentScriptOutputDataSchema = z.strictObject({
  scriptName: z.string().optional(),
  level: z.string(),
  message: z.string(),
  toolId: z.string().optional(),
  scriptRunId: z.string().optional(),
  workerId: z.string().optional(),
})

export const AgentArtifactCreatedDataSchema = z.strictObject({
  fileId: z.string(),
  fileName: z.string(),
  size: z.number(),
  mimeType: z.string(),
  operation: z.enum(['create', 'update']),
})

export const AgentTokenUsageDataSchema = z.strictObject({
  current: z.unknown(),
  delta: z.unknown(),
})

export const AgentRunCompletedDataSchema = z.strictObject({
  finalAnswer: z.string().optional(),
})

export const AgentRunFailedDataSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  category: z.string().optional(),
  retryable: z.boolean(),
  source: z.string().optional(),
  requestId: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  httpStatus: z.number().optional(),
})

export const AgentRunCancelledDataSchema = z.strictObject({
  reason: z.enum(['user', 'client_shutdown', 'parent_cancelled', 'timeout', 'process_exit']),
  message: z.string().optional(),
})

export const AgentRunEventDataSchemas = {
  run_started: AgentRunStartedDataSchema,
  user_message: AgentUserMessageDataSchema,
  title_changed: AgentTitleChangedDataSchema,
  todo_delta: AgentTodoDeltaDataSchema,
  thinking_delta: AgentThinkingDeltaDataSchema,
  thinking_completed: AgentThinkingCompletedDataSchema,
  content_delta: AgentContentDeltaDataSchema,
  tool_started: AgentToolStartedDataSchema,
  tool_finished: AgentToolFinishedDataSchema,
  worker_dispatched: AgentWorkerDispatchedDataSchema,
  worker_completed: AgentWorkerCompletedDataSchema,
  run_retrying: AgentRunRetryingDataSchema,
  approval_requested: AgentApprovalRequestedDataSchema,
  approval_resolved: AgentApprovalResolvedDataSchema,
  script_output: AgentScriptOutputDataSchema,
  artifact_created: AgentArtifactCreatedDataSchema,
  token_usage: AgentTokenUsageDataSchema,
  run_completed: AgentRunCompletedDataSchema,
  run_failed: AgentRunFailedDataSchema,
  run_cancelled: AgentRunCancelledDataSchema,
} as const

export type AgentRunEventMap = {
  [K in keyof typeof AgentRunEventDataSchemas]: z.infer<(typeof AgentRunEventDataSchemas)[K]>
}

export type AgentRunEventType = keyof AgentRunEventMap

export const AgentRunEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('run_started'), data: AgentRunStartedDataSchema }),
  z.strictObject({ type: z.literal('user_message'), data: AgentUserMessageDataSchema }),
  z.strictObject({ type: z.literal('title_changed'), data: AgentTitleChangedDataSchema }),
  z.strictObject({ type: z.literal('todo_delta'), data: AgentTodoDeltaDataSchema }),
  z.strictObject({ type: z.literal('thinking_delta'), data: AgentThinkingDeltaDataSchema }),
  z.strictObject({ type: z.literal('thinking_completed'), data: AgentThinkingCompletedDataSchema }),
  z.strictObject({ type: z.literal('content_delta'), data: AgentContentDeltaDataSchema }),
  z.strictObject({ type: z.literal('tool_started'), data: AgentToolStartedDataSchema }),
  z.strictObject({ type: z.literal('tool_finished'), data: AgentToolFinishedDataSchema }),
  z.strictObject({ type: z.literal('worker_dispatched'), data: AgentWorkerDispatchedDataSchema }),
  z.strictObject({ type: z.literal('worker_completed'), data: AgentWorkerCompletedDataSchema }),
  z.strictObject({ type: z.literal('run_retrying'), data: AgentRunRetryingDataSchema }),
  z.strictObject({ type: z.literal('approval_requested'), data: AgentApprovalRequestedDataSchema }),
  z.strictObject({ type: z.literal('approval_resolved'), data: AgentApprovalResolvedDataSchema }),
  z.strictObject({ type: z.literal('script_output'), data: AgentScriptOutputDataSchema }),
  z.strictObject({ type: z.literal('artifact_created'), data: AgentArtifactCreatedDataSchema }),
  z.strictObject({ type: z.literal('token_usage'), data: AgentTokenUsageDataSchema }),
  z.strictObject({ type: z.literal('run_completed'), data: AgentRunCompletedDataSchema }),
  z.strictObject({ type: z.literal('run_failed'), data: AgentRunFailedDataSchema }),
  z.strictObject({ type: z.literal('run_cancelled'), data: AgentRunCancelledDataSchema }),
])

type InferredAgentRunEvent = z.infer<typeof AgentRunEventSchema>

export type AgentRunEvent<T extends AgentRunEventType = AgentRunEventType>
  = Extract<InferredAgentRunEvent, { type: T }>

export const AgentConversationRunEventDTOSchema = z.strictObject({
  conversationId: z.string(),
  runId: z.string(),
  turnId: z.string(),
  assistantMessageId: z.string(),
  startSequence: z.number().int().positive().optional(),
  sequence: z.number(),
  timestamp: z.number(),
  event: AgentRunEventSchema,
})

export type AgentConversationRunEventDTO = z.infer<typeof AgentConversationRunEventDTOSchema>
