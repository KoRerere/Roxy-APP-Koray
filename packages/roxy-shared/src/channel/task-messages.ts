import { z } from 'zod'

export const AgentTaskLogStatusSchema = z.enum([
  'preparing',
  'running',
  'success',
  'partial_failed',
  'failed',
  'interrupted',
  'skipped',
])

export type AgentTaskLogStatus = z.infer<typeof AgentTaskLogStatusSchema>

export const AgentTaskTriggerTypeSchema = z.enum(['manual', 'once', 'cron'])

export type AgentTaskTriggerType = z.infer<typeof AgentTaskTriggerTypeSchema>

export const AgentTaskScriptRunDTOSchema = z.strictObject({
  dirId: z.string().nullable(),
  slug: z.string(),
  runId: z.string(),
  fileIds: z.array(z.string()),
})

export type AgentTaskScriptRunDTO = z.infer<typeof AgentTaskScriptRunDTOSchema>

export const AgentTaskLogDTOSchema = z.strictObject({
  id: z.string(),
  taskId: z.number(),
  taskName: z.string(),
  templateId: z.number(),
  templateName: z.string(),
  templateType: z.enum(['script', 'skill', 'prompt']),
  triggerType: AgentTaskTriggerTypeSchema,
  occurrenceId: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  input: z.unknown(),
  windowDirIds: z.array(z.string()),
  scriptRuns: z.array(AgentTaskScriptRunDTOSchema),
  conversationId: z.string().nullable(),
  fileIds: z.array(z.string()),
  status: AgentTaskLogStatusSchema,
  success: z.boolean(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
  endReasonCode: z.string().nullable(),
})

export type AgentTaskLogDTO = z.infer<typeof AgentTaskLogDTOSchema>

export const AgentTaskArtifactDTOSchema = z.strictObject({
  fileId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number().nullable(),
})

export type AgentTaskArtifactDTO = z.infer<typeof AgentTaskArtifactDTOSchema>

export const AgentTaskConversationMessageDTOSchema = z.strictObject({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string(),
})

export type AgentTaskConversationMessageDTO = z.infer<typeof AgentTaskConversationMessageDTOSchema>

export const AgentTaskScriptWindowStatusSchema = z.enum(['running', 'success', 'failed', 'interrupted'])

export type AgentTaskScriptWindowStatus = z.infer<typeof AgentTaskScriptWindowStatusSchema>

export const AgentTaskScriptWindowDTOSchema = z.strictObject({
  key: z.string(),
  dirId: z.string().nullable(),
  runId: z.string(),
  label: z.string(),
  status: AgentTaskScriptWindowStatusSchema,
  log: z.string(),
  artifacts: z.array(AgentTaskArtifactDTOSchema),
  failedFiles: z.array(z.string()),
})

export type AgentTaskScriptWindowDTO = z.infer<typeof AgentTaskScriptWindowDTOSchema>

export const AgentTaskExecutionDetailDTOSchema = z.strictObject({
  taskLogId: z.string(),
  revision: z.number(),
  conversationId: z.string().nullable(),
  messages: z.array(AgentTaskConversationMessageDTOSchema),
  artifacts: z.array(AgentTaskArtifactDTOSchema),
  scriptWindows: z.array(AgentTaskScriptWindowDTOSchema),
})

export type AgentTaskExecutionDetailDTO = z.infer<typeof AgentTaskExecutionDetailDTOSchema>

export const AgentTaskExecutionEventPayloadSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('agent.message.upsert'),
    conversationId: z.string(),
    message: AgentTaskConversationMessageDTOSchema,
  }),
  z.strictObject({
    type: z.literal('agent.message.delta'),
    conversationId: z.string(),
    messageId: z.string(),
    delta: z.string(),
    createdAt: z.string(),
  }),
  z.strictObject({
    type: z.literal('script.window.started'),
    window: z.strictObject({
      key: z.string(),
      dirId: z.string().nullable(),
      runId: z.string(),
      label: z.string(),
    }),
  }),
  z.strictObject({
    type: z.literal('script.log.append'),
    windowKey: z.string(),
    text: z.string(),
  }),
  z.strictObject({
    type: z.literal('script.log.replace'),
    windowKey: z.string(),
    text: z.string(),
  }),
  z.strictObject({
    type: z.literal('script.window.finished'),
    windowKey: z.string(),
    status: z.enum(['success', 'failed', 'interrupted']),
    failedFiles: z.array(z.string()),
  }),
  z.strictObject({
    type: z.literal('artifacts.updated'),
    windowKey: z.string().optional(),
    artifacts: z.array(AgentTaskArtifactDTOSchema),
  }),
])

export type AgentTaskExecutionEventPayload = z.infer<typeof AgentTaskExecutionEventPayloadSchema>

export const AgentTaskExecutionEventSchema = z.strictObject({
  taskLogId: z.string(),
  sequence: z.number(),
  createdAt: z.string(),
  payload: AgentTaskExecutionEventPayloadSchema,
})

export type AgentTaskExecutionEvent = z.infer<typeof AgentTaskExecutionEventSchema>

export const AgentTaskExecutionReplaySchema = z.strictObject({
  taskLogId: z.string(),
  revision: z.number(),
  events: z.array(AgentTaskExecutionEventSchema),
})

export type AgentTaskExecutionReplay = z.infer<typeof AgentTaskExecutionReplaySchema>

export const AgentTaskMonitorSourceTypeSchema = z.enum(['chat', 'task', 'worker', 'script', 'im', 'other'])

export type AgentTaskMonitorSourceType = z.infer<typeof AgentTaskMonitorSourceTypeSchema>

export const AgentTaskMonitorEventStageSchema = z.enum(['start', 'end', 'error'])

export type AgentTaskMonitorEventStage = z.infer<typeof AgentTaskMonitorEventStageSchema>

export const AgentTaskMonitorBrowserEventSchema = z.strictObject({
  id: z.string(),
  stage: AgentTaskMonitorEventStageSchema,
  toolName: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
  result: z.string().optional(),
  success: z.boolean(),
  errorMessage: z.string().optional(),
  durationMs: z.number().optional(),
  timestamp: z.number(),
  workerId: z.string().optional(),
  conversationId: z.string().optional(),
})

export type AgentTaskMonitorBrowserEvent = z.infer<typeof AgentTaskMonitorBrowserEventSchema>

export const AgentTaskMonitorBrowserSessionSchema = z.strictObject({
  id: z.string(),
  dirId: z.string().optional(),
  label: z.string(),
  ws: z.string().optional(),
  browserType: z.string().optional(),
  windowName: z.string().optional(),
  windowSortNum: z.number().optional(),
  platformUrl: z.string().optional(),
  platformUserName: z.string().optional(),
  platformIcon: z.string().optional(),
  countryCode: z.string().optional(),
  startedAt: z.number(),
  updatedAt: z.number(),
  events: z.array(AgentTaskMonitorBrowserEventSchema),
})

export type AgentTaskMonitorBrowserSession = z.infer<typeof AgentTaskMonitorBrowserSessionSchema>

export const AgentTaskMonitorTaskSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  sourceType: AgentTaskMonitorSourceTypeSchema,
  status: z.literal('running'),
  conversationId: z.string().optional(),
  runId: z.string().optional(),
  startedAt: z.number(),
  updatedAt: z.number(),
  browsers: z.array(AgentTaskMonitorBrowserSessionSchema),
})

export type AgentTaskMonitorTask = z.infer<typeof AgentTaskMonitorTaskSchema>

export const AgentTaskMonitorSnapshotSchema = z.strictObject({
  type: z.literal('snapshot'),
  data: z.strictObject({
    generatedAt: z.number(),
    tasks: z.array(AgentTaskMonitorTaskSchema),
  }),
})

export type AgentTaskMonitorSnapshot = z.infer<typeof AgentTaskMonitorSnapshotSchema>

