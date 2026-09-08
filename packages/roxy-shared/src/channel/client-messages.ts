import { z } from 'zod'
import { TaskReportTemplateContextSchema } from '../task-report'
import { AgentChannelMessageIdSchema } from './common'
import { AgentRunAttachmentDTOSchema } from './conversation-events'

export const AgentConversationRunAttachmentSchema = z.strictObject({
  fileId: z.string().min(1),
})

export const AgentConversationRunLocalAttachmentSchema = z.strictObject({
  kind: z.enum(['file', 'folder']),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  localPath: z.string().min(1),
})

export const AgentConversationRunStartCommandSchema = z.strictObject({
  conversationId: z.string().min(1),
  turnId: z.string().min(1).optional(),
  message: z.string(),
  attachments: z.array(AgentConversationRunAttachmentSchema).optional(),
  pendingAttachments: z.array(AgentRunAttachmentDTOSchema).optional(),
  localAttachments: z.array(AgentConversationRunLocalAttachmentSchema).optional(),
  attachmentsPending: z.boolean().optional(),
  templateContext: TaskReportTemplateContextSchema.optional(),
  fullAccess: z.boolean().optional(),
}).refine(data => Boolean(data.message.trim()) || Boolean(data.attachments?.length) || Boolean(data.localAttachments?.length) || data.attachmentsPending === true)

export type AgentConversationRunStartCommand = z.infer<typeof AgentConversationRunStartCommandSchema>

export const AgentConversationRunAttachmentsReadyCommandSchema = z.strictObject({
  conversationId: z.string().min(1),
  turnId: z.string().min(1),
  attachments: z.array(AgentConversationRunAttachmentSchema).optional(),
  localAttachments: z.array(AgentConversationRunLocalAttachmentSchema).optional(),
})

export type AgentConversationRunAttachmentsReadyCommand = z.infer<typeof AgentConversationRunAttachmentsReadyCommandSchema>

export const AgentConversationRunStopCommandSchema = z.strictObject({
  conversationId: z.string().min(1),
})

export type AgentConversationRunStopCommand = z.infer<typeof AgentConversationRunStopCommandSchema>

export const AgentConversationApprovalSubmitCommandSchema = z.strictObject({
  conversationId: z.string().min(1),
  approvalId: z.string().min(1),
  decisions: z.array(z.unknown()),
  fullAccess: z.boolean().optional(),
})

export type AgentConversationApprovalSubmitCommand = z.infer<typeof AgentConversationApprovalSubmitCommandSchema>

export const AgentExecutionControlActionSchema = z.enum(['cancel', 'pause', 'resume'])
export type AgentExecutionControlAction = z.infer<typeof AgentExecutionControlActionSchema>

export const AgentExecutionControlCommandSchema = z.strictObject({
  executionId: z.string().min(1),
  action: AgentExecutionControlActionSchema,
})
export type AgentExecutionControlCommand = z.infer<typeof AgentExecutionControlCommandSchema>

export const AgentConversationRunStartMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('conversation.run.start'),
  data: AgentConversationRunStartCommandSchema,
})

export const AgentConversationRunAttachmentsReadyMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('conversation.run.attachments.ready'),
  data: AgentConversationRunAttachmentsReadyCommandSchema,
})

export const AgentConversationRunStopMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('conversation.run.stop'),
  data: AgentConversationRunStopCommandSchema,
})

export const AgentConversationApprovalSubmitMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('conversation.approval.submit'),
  data: AgentConversationApprovalSubmitCommandSchema,
})

export const AgentExecutionControlMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('execution.control'),
  data: AgentExecutionControlCommandSchema,
})

export const AgentChannelClientMessageSchema = z.discriminatedUnion('type', [
  AgentConversationRunStartMessageSchema,
  AgentConversationRunAttachmentsReadyMessageSchema,
  AgentConversationRunStopMessageSchema,
  AgentConversationApprovalSubmitMessageSchema,
  AgentExecutionControlMessageSchema,
])

export interface AgentChannelClientMessageMap {
  'conversation.run.start': AgentConversationRunStartCommand
  'conversation.run.attachments.ready': AgentConversationRunAttachmentsReadyCommand
  'conversation.run.stop': AgentConversationRunStopCommand
  'conversation.approval.submit': AgentConversationApprovalSubmitCommand
  'execution.control': AgentExecutionControlCommand
}

export type AgentChannelClientMessageType = keyof AgentChannelClientMessageMap

type InferredAgentChannelClientMessage = z.infer<typeof AgentChannelClientMessageSchema>

export type AgentChannelClientMessage<T extends AgentChannelClientMessageType = AgentChannelClientMessageType>
  = Extract<InferredAgentChannelClientMessage, { type: T }>
