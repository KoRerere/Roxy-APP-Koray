import { z } from 'zod'
import { AgentChannelMessageIdSchema } from './common'
import { AgentConversationRunEventDTOSchema } from './conversation-events'
import {
  AgentTaskExecutionEventSchema,
  AgentTaskLogDTOSchema,
  AgentTaskMonitorSnapshotSchema,
} from './task-messages'

export const AgentChannelReadyDataSchema = z.strictObject({
  connectedAt: z.string(),
})

export const AgentTaskLogsSnapshotDataSchema = z.strictObject({
  items: z.array(AgentTaskLogDTOSchema),
})

export const AgentTaskLogDeletedDataSchema = z.strictObject({
  logId: z.string(),
})

export const AgentChannelReadyMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('channel.ready'),
  data: AgentChannelReadyDataSchema,
})

export const AgentTaskLogsSnapshotMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('task_logs.snapshot'),
  data: AgentTaskLogsSnapshotDataSchema,
})

export const AgentTaskLogChangedMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('task_log.changed'),
  data: AgentTaskLogDTOSchema,
})

export const AgentTaskLogDeletedMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('task_log.deleted'),
  data: AgentTaskLogDeletedDataSchema,
})

export const AgentTaskExecutionEventMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('task_execution.event'),
  data: AgentTaskExecutionEventSchema,
})

export const AgentTaskMonitorSnapshotMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('task_monitor.snapshot'),
  data: AgentTaskMonitorSnapshotSchema,
})

export const AgentConversationRunEventMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('conversation.run.event'),
  data: AgentConversationRunEventDTOSchema,
})

export const AgentChannelMessageSchema = z.discriminatedUnion('type', [
  AgentChannelReadyMessageSchema,
  AgentTaskLogsSnapshotMessageSchema,
  AgentTaskLogChangedMessageSchema,
  AgentTaskLogDeletedMessageSchema,
  AgentTaskExecutionEventMessageSchema,
  AgentTaskMonitorSnapshotMessageSchema,
  AgentConversationRunEventMessageSchema,
])

export interface AgentChannelMessageMap {
  'channel.ready': z.infer<typeof AgentChannelReadyDataSchema>
  'task_logs.snapshot': z.infer<typeof AgentTaskLogsSnapshotDataSchema>
  'task_log.changed': z.infer<typeof AgentTaskLogDTOSchema>
  'task_log.deleted': z.infer<typeof AgentTaskLogDeletedDataSchema>
  'task_execution.event': z.infer<typeof AgentTaskExecutionEventSchema>
  'task_monitor.snapshot': z.infer<typeof AgentTaskMonitorSnapshotSchema>
  'conversation.run.event': z.infer<typeof AgentConversationRunEventDTOSchema>
}

export type AgentChannelMessageType = keyof AgentChannelMessageMap

type InferredAgentChannelMessage = z.infer<typeof AgentChannelMessageSchema>

export type AgentChannelMessage<T extends AgentChannelMessageType = AgentChannelMessageType>
  = Extract<InferredAgentChannelMessage, { type: T }>

