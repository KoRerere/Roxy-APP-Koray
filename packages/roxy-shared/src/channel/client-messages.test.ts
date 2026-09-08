import type { z } from 'zod'
import { describe, expect, it } from 'vitest'
import {
  AgentChannelClientMessageSchema,
  AgentConversationApprovalSubmitCommandSchema,
  AgentConversationApprovalSubmitMessageSchema,
  AgentConversationRunAttachmentSchema,
  AgentConversationRunAttachmentsReadyCommandSchema,
  AgentConversationRunAttachmentsReadyMessageSchema,
  AgentConversationRunLocalAttachmentSchema,
  AgentConversationRunStartCommandSchema,
  AgentConversationRunStartMessageSchema,
  AgentConversationRunStopCommandSchema,
  AgentConversationRunStopMessageSchema,
  AgentExecutionControlCommandSchema,
  AgentExecutionControlMessageSchema,
} from './client-messages'

const commandCases: Array<{
  type: 'conversation.run.start' | 'conversation.run.attachments.ready' | 'conversation.run.stop' | 'conversation.approval.submit' | 'execution.control'
  commandSchema: z.ZodType
  messageSchema: z.ZodType
  data: Record<string, unknown>
}> = [
  {
    type: 'conversation.run.start',
    commandSchema: AgentConversationRunStartCommandSchema,
    messageSchema: AgentConversationRunStartMessageSchema,
    data: { conversationId: 'conversation-1', turnId: 'message-1', message: 'Run it', fullAccess: true },
  },
  {
    type: 'conversation.run.attachments.ready',
    commandSchema: AgentConversationRunAttachmentsReadyCommandSchema,
    messageSchema: AgentConversationRunAttachmentsReadyMessageSchema,
    data: { conversationId: 'conversation-1', turnId: 'message-1', attachments: [{ fileId: 'file-1' }] },
  },
  {
    type: 'conversation.run.stop',
    commandSchema: AgentConversationRunStopCommandSchema,
    messageSchema: AgentConversationRunStopMessageSchema,
    data: { conversationId: 'conversation-1' },
  },
  {
    type: 'conversation.approval.submit',
    commandSchema: AgentConversationApprovalSubmitCommandSchema,
    messageSchema: AgentConversationApprovalSubmitMessageSchema,
    data: { conversationId: 'conversation-1', approvalId: 'approval-1', decisions: [{ type: 'approve' }], fullAccess: true },
  },
  {
    type: 'execution.control',
    commandSchema: AgentExecutionControlCommandSchema,
    messageSchema: AgentExecutionControlMessageSchema,
    data: { executionId: 'run-1', action: 'pause' },
  },
]

describe('client channel message schemas', () => {
  it('validates run attachments strictly', () => {
    expect(AgentConversationRunAttachmentSchema.safeParse({ fileId: 'file-1' }).success).toBe(true)
    expect(AgentConversationRunAttachmentSchema.safeParse({ fileId: '' }).success).toBe(false)
    expect(AgentConversationRunAttachmentSchema.safeParse({ fileId: 'file-1', name: 'extra' }).success).toBe(false)
  })

  it('validates local run attachments strictly', () => {
    const attachment = {
      kind: 'file',
      fileName: 'screen.png',
      mimeType: 'image/png',
      localPath: '/tmp/screen.png',
    }
    expect(AgentConversationRunLocalAttachmentSchema.safeParse(attachment).success).toBe(true)
    expect(AgentConversationRunLocalAttachmentSchema.safeParse({ ...attachment, unexpected: true }).success).toBe(false)
  })

  it.each(commandCases)('validates $type command and envelope', ({ type, commandSchema, messageSchema, data }) => {
    const message = { id: 'message-1', type, data }
    expect(commandSchema.safeParse(data).success).toBe(true)
    expect(commandSchema.safeParse({ ...data, unexpected: true }).success).toBe(false)
    expect(messageSchema.safeParse(message).success).toBe(true)
    expect(AgentChannelClientMessageSchema.safeParse(message).success).toBe(true)
  })

  it('accepts an attachment-only run and rejects an empty run', () => {
    expect(AgentConversationRunStartCommandSchema.safeParse({
      conversationId: 'conversation-1',
      message: '   ',
      attachments: [{ fileId: 'file-1' }],
    }).success).toBe(true)
    expect(AgentConversationRunStartCommandSchema.safeParse({
      conversationId: 'conversation-1',
      message: '   ',
      localAttachments: [{
        kind: 'folder',
        fileName: 'work',
        mimeType: 'inode/directory',
        localPath: '/tmp/work',
      }],
    }).success).toBe(true)
    expect(AgentConversationRunStartCommandSchema.safeParse({
      conversationId: 'conversation-1',
      turnId: 'message-1',
      message: '   ',
      attachmentsPending: true,
    }).success).toBe(true)
    expect(AgentConversationRunStartCommandSchema.safeParse({
      conversationId: 'conversation-1',
      message: '   ',
    }).success).toBe(false)
  })

  it('accepts a strict hidden template context without changing the visible message', () => {
    const result = AgentConversationRunStartCommandSchema.safeParse({
      conversationId: 'conversation-1',
      message: '请你使用 roxy-template-creator Skill，将刚才的任务总结为模板',
      templateContext: {
        sourceReportId: 'report-tool-1',
        report: {
          taskName: '批量养号',
          params: [{
            key: 'browseDuration',
            name: '每个窗口的浏览时长',
            value: 15,
          }],
          windows: [{ dirId: 'profile-1', success: true, failureReason: '' }],
        },
      },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.message).toBe('请你使用 roxy-template-creator Skill，将刚才的任务总结为模板')
      expect(result.data.templateContext?.sourceReportId).toBe('report-tool-1')
    }
  })

  it('rejects the removed multimodal attachment mode', () => {
    expect(AgentConversationRunStartCommandSchema.safeParse({
      conversationId: 'conversation-1',
      message: 'Inspect the image',
      multimodalAttachments: true,
    }).success).toBe(false)
  })

  it('rejects unknown message types, empty IDs, and extra envelope fields', () => {
    const validData = { conversationId: 'conversation-1' }
    expect(AgentChannelClientMessageSchema.safeParse({ id: 'message-1', type: 'unknown', data: validData }).success).toBe(false)
    expect(AgentChannelClientMessageSchema.safeParse({ id: '', type: 'conversation.run.stop', data: validData }).success).toBe(false)
    expect(AgentChannelClientMessageSchema.safeParse({ id: 'message-1', type: 'conversation.run.stop', data: validData, extra: true }).success).toBe(false)
  })
})
