import { z } from 'zod'
import { AgentChannelMessageIdSchema } from './common'

export const AgentConversationRunAttachmentSchema = z.strictObject({
  fileId: z.string().min(1),
})

export const AgentConversationRunStartCommandSchema = z.strictObject({
  conversationId: z.string().min(1),
  message: z.string(),
  attachments: z.array(AgentConversationRunAttachmentSchema).optional(),
  fullAccess: z.boolean().optional(),
}).refine(data => Boolean(data.message.trim()) || Boolean(data.attachments?.length))

export type AgentConversationRunStartCommand = z.infer<typeof AgentConversationRunStartCommandSchema>

export const AgentConversationRunStopCommandSchema = z.strictObject({
  conversationId: z.string().min(1),
})

export type AgentConversationRunStopCommand = z.infer<typeof AgentConversationRunStopCommandSchema>

export const AgentConversationApprovalSubmitCommandSchema = z.strictObject({
  conversationId: z.string().min(1),
  approvalId: z.string().min(1),
  decisions: z.array(z.unknown()),
})

export type AgentConversationApprovalSubmitCommand = z.infer<typeof AgentConversationApprovalSubmitCommandSchema>

export const AgentConversationRunStartMessageSchema = z.strictObject({
  id: AgentChannelMessageIdSchema,
  type: z.literal('conversation.run.start'),
  data: AgentConversationRunStartCommandSchema,
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

export const AgentChannelClientMessageSchema = z.discriminatedUnion('type', [
  AgentConversationRunStartMessageSchema,
  AgentConversationRunStopMessageSchema,
  AgentConversationApprovalSubmitMessageSchema,
])

export interface AgentChannelClientMessageMap {
  'conversation.run.start': AgentConversationRunStartCommand
  'conversation.run.stop': AgentConversationRunStopCommand
  'conversation.approval.submit': AgentConversationApprovalSubmitCommand
}

export type AgentChannelClientMessageType = keyof AgentChannelClientMessageMap

type InferredAgentChannelClientMessage = z.infer<typeof AgentChannelClientMessageSchema>

export type AgentChannelClientMessage<T extends AgentChannelClientMessageType = AgentChannelClientMessageType>
  = Extract<InferredAgentChannelClientMessage, { type: T }>
