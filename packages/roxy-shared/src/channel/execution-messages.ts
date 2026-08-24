import { z } from 'zod'

export const AgentExecutionSourceSchema = z.enum(['conversation', 'scheduled_task', 'im', 'worker'])
export type AgentExecutionSource = z.infer<typeof AgentExecutionSourceSchema>

export const AgentExecutionStatusSchema = z.enum([
  'queued', 'running', 'waiting', 'paused', 'cancelling',
  'completed', 'failed', 'cancelled',
])
export type AgentExecutionStatus = z.infer<typeof AgentExecutionStatusSchema>

export const AgentExecutionEntrySchema = z.strictObject({
  id: z.string(),
  source: AgentExecutionSourceSchema,
  status: AgentExecutionStatusSchema,
  conversationId: z.string().optional(),
  parentId: z.string().optional(),
  title: z.string().optional(),
  createdAt: z.number(),
  startedAt: z.number().optional(),
  endedAt: z.number().optional(),
  updatedAt: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  cancelReason: z.string().optional(),
})
export type AgentExecutionEntry = z.infer<typeof AgentExecutionEntrySchema>

export const AgentExecutionSnapshotSchema = z.strictObject({
  type: z.literal('snapshot'),
  generatedAt: z.number(),
  entries: z.array(AgentExecutionEntrySchema),
})
export type AgentExecutionSnapshot = z.infer<typeof AgentExecutionSnapshotSchema>
