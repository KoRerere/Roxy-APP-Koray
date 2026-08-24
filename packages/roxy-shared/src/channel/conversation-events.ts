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
  agentPath: z.string().optional(),
  requestId: z.string().optional(),
  source: z.enum(['user', 'scheduled_task']),
  assistantMessageId: z.string(),
  startedAt: z.number(),
})

export const AgentUserMessageDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  messageId: z.string(),
  content: z.string(),
  attachments: z.array(AgentRunAttachmentDTOSchema),
  createdAt: z.number(),
})

export const AgentTitleChangedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  title: z.string(),
})

export const AgentPlanUpdatedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  todos: z.array(z.unknown()),
  workerId: z.string().optional(),
})

export const AgentThinkingDeltaDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  id: z.string().optional(),
  thinkingId: z.string(),
  text: z.string(),
  workerId: z.string().optional(),
})

export const AgentThinkingCompletedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  id: z.string().optional(),
  thinkingId: z.string(),
  startTimestamp: z.number(),
  endTimestamp: z.number(),
  durationMs: z.number(),
  workerId: z.string().optional(),
})

export const AgentContentDeltaDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  id: z.string().optional(),
  contentId: z.string(),
  text: z.string(),
  phase: z.enum(['answer', 'synthesis']).optional(),
  workerId: z.string().optional(),
})

export const AgentToolStartedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  toolName: z.string(),
  input: z.unknown(),
  toolId: z.string().optional(),
  workerId: z.string().optional(),
  patchType: z.enum(['create', 'update', 'delete', 'mixed']).optional(),
  assignmentsCount: z.number().optional(),
  skillName: z.string().optional(),
  skillFilePath: z.string().optional(),
  target: z.string().optional(),
})

export const AgentToolFinishedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  toolName: z.string(),
  output: z.unknown(),
  toolId: z.string().optional(),
  workerId: z.string().optional(),
  durationMs: z.number().optional(),
  status: z.enum(['success', 'failed', 'cancelled']).optional(),
})

export const AgentWorkerDispatchedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  workerId: z.string(),
  title: z.string(),
  dispatchId: z.string().optional(),
})

export const AgentWorkerCompletedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  workerId: z.string(),
  dispatchId: z.string().optional(),
  status: z.enum(['success', 'failed', 'cancelled', 'timeout']),
  exitCode: z.number().nullable().optional(),
  signal: z.string().nullable().optional(),
  error: z.unknown().optional(),
  durationMs: z.number().optional(),
})

export const AgentLifecycleDataSchema = z.strictObject({
  agentPath: z.string(),
  parentAgentPath: z.string().optional(),
  agentName: z.string(),
  agentType: z.string(),
  status: z.enum(['starting', 'running', 'completed', 'failed', 'cancelled']),
  startedAt: z.number().optional(),
  finishedAt: z.number().optional(),
  report: z.string().optional(),
  error: z.string().optional(),
})

export const AgentRunRetryingDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  retryId: z.string().optional(),
  attempt: z.number(),
  maxAttempts: z.number(),
  reason: z.string().optional(),
  workerId: z.string().optional(),
})

export const AgentClarificationOptionSchema = z.strictObject({
  label: z.string().min(1).refine(value => value.trim().split(/\s+/).length <= 5, 'Option label must contain 1 to 5 words.'),
  description: z.string().min(1),
})

export const AgentClarificationQuestionSchema = z.strictObject({
  header: z.string().min(1).max(12),
  id: z.string().min(1),
  question: z.string().min(1),
  options: z.array(AgentClarificationOptionSchema).min(2).max(3),
})

export type AgentClarificationQuestion = z.infer<typeof AgentClarificationQuestionSchema>

export const AgentApprovalRequestedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  approvalId: z.string(),
  actionRequests: z.array(z.unknown()),
  reviewConfigs: z.array(z.unknown()),
  requestKind: z.enum(['approval', 'clarification']).optional(),
  title: z.string().optional(),
  prompt: z.string().optional(),
  description: z.string().optional(),
  subjects: z.array(z.unknown()).optional(),
  controls: z.array(z.unknown()).optional(),
  values: z.record(z.string(), z.unknown()).optional(),
  questions: z.array(AgentClarificationQuestionSchema).min(1).max(3).optional(),
})

export const AgentApprovalResolvedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  approvalId: z.string(),
  decisions: z.array(z.unknown()),
})

export const AgentScriptOutputDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  scriptName: z.string().optional(),
  level: z.string(),
  message: z.string(),
  toolId: z.string().optional(),
  scriptRunId: z.string().optional(),
  dirId: z.string().optional(),
  workerId: z.string().optional(),
  unavailableReason: z.enum(['file_missing']).optional(),
})

export const AgentArtifactCreatedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  fileId: z.string(),
  fileName: z.string(),
  size: z.number(),
  mimeType: z.string(),
  operation: z.enum(['create', 'update']),
})

export const AgentTokenUsageDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  current: z.unknown(),
  delta: z.unknown(),
})

/** Emitted when the agent compacts older context into a summary. */
export const AgentContextCompactedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  status: z.enum(['started', 'completed']).optional(),
  compactedCount: z.number().int().nonnegative(),
  summary: z.string().optional(),
  workerId: z.string().optional(),
})

export const AgentRunCompletedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
  finalAnswer: z.string().optional(),
})

export const AgentRunFailedDataSchema = z.strictObject({
  agentPath: z.string().optional(),
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
  agentPath: z.string().optional(),
  reason: z.enum(['user', 'client_shutdown', 'parent_cancelled', 'timeout', 'process_exit']),
  message: z.string().optional(),
})

export const AgentRunEventDataSchemas = {
  run_started: AgentRunStartedDataSchema,
  user_message: AgentUserMessageDataSchema,
  title_changed: AgentTitleChangedDataSchema,
  plan_updated: AgentPlanUpdatedDataSchema,
  thinking_delta: AgentThinkingDeltaDataSchema,
  thinking_completed: AgentThinkingCompletedDataSchema,
  content_delta: AgentContentDeltaDataSchema,
  tool_started: AgentToolStartedDataSchema,
  tool_finished: AgentToolFinishedDataSchema,
  worker_dispatched: AgentWorkerDispatchedDataSchema,
  worker_completed: AgentWorkerCompletedDataSchema,
  agent_lifecycle: AgentLifecycleDataSchema,
  run_retrying: AgentRunRetryingDataSchema,
  approval_requested: AgentApprovalRequestedDataSchema,
  approval_resolved: AgentApprovalResolvedDataSchema,
  script_output: AgentScriptOutputDataSchema,
  artifact_created: AgentArtifactCreatedDataSchema,
  token_usage: AgentTokenUsageDataSchema,
  context_compacted: AgentContextCompactedDataSchema,
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
  z.strictObject({ type: z.literal('plan_updated'), data: AgentPlanUpdatedDataSchema }),
  z.strictObject({ type: z.literal('thinking_delta'), data: AgentThinkingDeltaDataSchema }),
  z.strictObject({ type: z.literal('thinking_completed'), data: AgentThinkingCompletedDataSchema }),
  z.strictObject({ type: z.literal('content_delta'), data: AgentContentDeltaDataSchema }),
  z.strictObject({ type: z.literal('tool_started'), data: AgentToolStartedDataSchema }),
  z.strictObject({ type: z.literal('tool_finished'), data: AgentToolFinishedDataSchema }),
  z.strictObject({ type: z.literal('worker_dispatched'), data: AgentWorkerDispatchedDataSchema }),
  z.strictObject({ type: z.literal('worker_completed'), data: AgentWorkerCompletedDataSchema }),
  z.strictObject({ type: z.literal('agent_lifecycle'), data: AgentLifecycleDataSchema }),
  z.strictObject({ type: z.literal('run_retrying'), data: AgentRunRetryingDataSchema }),
  z.strictObject({ type: z.literal('approval_requested'), data: AgentApprovalRequestedDataSchema }),
  z.strictObject({ type: z.literal('approval_resolved'), data: AgentApprovalResolvedDataSchema }),
  z.strictObject({ type: z.literal('script_output'), data: AgentScriptOutputDataSchema }),
  z.strictObject({ type: z.literal('artifact_created'), data: AgentArtifactCreatedDataSchema }),
  z.strictObject({ type: z.literal('token_usage'), data: AgentTokenUsageDataSchema }),
  z.strictObject({ type: z.literal('context_compacted'), data: AgentContextCompactedDataSchema }),
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
