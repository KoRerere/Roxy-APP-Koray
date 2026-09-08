import type { Conversation, Message } from '@/database/conversations'
import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import * as chatService from '@/services/chatService'

const router: Router = Router()

const FixedCreateConversationSchema = z.strictObject({
  title: z.string().trim().min(1).max(200).optional(),
})

const FixedListConversationsSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const FixedConversationIdSchema = z.strictObject({
  conversationId: z.string().trim().min(1).max(128),
})

const FixedConversationDetailSchema = FixedConversationIdSchema.extend({
  cursor: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

const FixedUpdateConversationSchema = FixedConversationIdSchema.extend({
  title: z.string().trim().min(1).max(200),
})

const FixedMarkConversationReadSchema = FixedConversationIdSchema.extend({
  runId: z.string().trim().min(1).max(128),
})

const terminalRunStatuses = new Set(['completed', 'failed', 'cancelled'])

function timestamp(value: string | undefined): number {
  if (!value) {
    return 0
  }
  const parsed = new Date(value.replace(' ', 'T')).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function presentConversation(conversation: Conversation) {
  const latestRunId = conversation.latest_run_id ?? undefined
  const latestRunStatus = conversation.latest_run_status ?? undefined
  const unread = Boolean(
    latestRunId
    && latestRunStatus
    && terminalRunStatuses.has(latestRunStatus)
    && conversation.last_read_run_id !== latestRunId,
  )
  return {
    id: conversation.id,
    ...(conversation.title ? { title: conversation.title } : {}),
    ...(conversation.model ? { model: conversation.model } : {}),
    status: 'active' as const,
    ...(latestRunId ? { latestRunId } : {}),
    ...(latestRunStatus ? { latestRunStatus } : {}),
    unread,
    createdAt: timestamp(conversation.created_at),
    updatedAt: timestamp(conversation.updated_at),
  }
}

function presentMessage(message: Message) {
  return {
    id: message.id,
    role: message.role,
    ...(message.content === undefined ? {} : { content: message.content }),
    ...(message.metadata === undefined ? {} : { metadata: message.metadata }),
    ...(message.events === undefined ? {} : { events: message.events }),
    createdAt: timestamp(message.created_at),
  }
}

function invalidRequest(res: Response, message: string) {
  return res.status(400).json({
    code: 1,
    message,
    error: { code: 'INVALID_REQUEST', retryable: false },
  })
}

function conversationNotFound(res: Response) {
  return res.status(404).json({
    code: 1,
    message: 'Conversation not found',
    error: { code: 'NOT_FOUND', retryable: false },
  })
}

function internalError(res: Response, action: string, error: unknown) {
  console.error(`Error ${action} conversation:`, error)
  return res.status(500).json({
    code: 1,
    message: `Failed to ${action} conversation`,
    error: { code: 'INTERNAL_ERROR', retryable: false },
  })
}

// Fixed GET/POST protocol shared with roxy-agent-app.
router.post('/conversations/create', async (req: Request, res: Response) => {
  const parsed = FixedCreateConversationSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return invalidRequest(res, 'Invalid request body')
  }

  try {
    const conversation = chatService.createConversation()
    if (parsed.data.title) {
      chatService.updateConversation(conversation.id, { title: parsed.data.title, isTitleSet: true })
    }
    const saved = chatService.getConversation(conversation.id) ?? conversation
    return res.status(201).json({ code: 0, data: presentConversation(saved) })
  }
  catch (error) {
    return internalError(res, 'create', error)
  }
})

router.get('/conversations/list', async (req: Request, res: Response) => {
  const parsed = FixedListConversationsSchema.safeParse(req.query)
  if (!parsed.success) {
    return invalidRequest(res, 'Invalid request query')
  }

  try {
    const offset = parsed.data.offset ?? 0
    const limit = parsed.data.limit ?? 100
    const data = chatService.listConversations({ limit, offset })
      .map(presentConversation)
    return res.json({ code: 0, data })
  }
  catch (error) {
    return internalError(res, 'list', error)
  }
})

router.get('/conversations/detail', async (req: Request, res: Response) => {
  const parsed = FixedConversationDetailSchema.safeParse(req.query)
  if (!parsed.success) {
    return invalidRequest(res, 'Invalid request query')
  }

  try {
    const conversation = chatService.getConversation(parsed.data.conversationId)
    if (!conversation) {
      return conversationNotFound(res)
    }
    const detail = chatService.getConversationDetail(parsed.data.conversationId, {
      cursor: parsed.data.cursor,
      limit: parsed.data.limit ?? 5,
    })
    const messages = Array.isArray(detail.messages) ? detail.messages : []
    return res.json({
      code: 0,
      data: {
        conversation: presentConversation(conversation),
        messages: messages.map(presentMessage),
        artifacts: [],
        hasMore: detail.hasMore,
        nextCursor: detail.nextCursor,
      },
    })
  }
  catch (error) {
    return internalError(res, 'read', error)
  }
})

router.post('/conversations/update', async (req: Request, res: Response) => {
  const parsed = FixedUpdateConversationSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return invalidRequest(res, 'Invalid request body')
  }

  try {
    if (!chatService.updateConversation(parsed.data.conversationId, { title: parsed.data.title })) {
      return conversationNotFound(res)
    }
    const conversation = chatService.getConversation(parsed.data.conversationId)
    if (!conversation) {
      return conversationNotFound(res)
    }
    return res.json({ code: 0, data: presentConversation(conversation) })
  }
  catch (error) {
    return internalError(res, 'update', error)
  }
})

router.post('/conversations/mark-read', async (req: Request, res: Response) => {
  const parsed = FixedMarkConversationReadSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return invalidRequest(res, 'Invalid request body')
  }

  try {
    const conversation = chatService.markConversationRead(parsed.data.conversationId, parsed.data.runId)
    if (!conversation) {
      return conversationNotFound(res)
    }
    return res.json({ code: 0, data: presentConversation(conversation) })
  }
  catch (error) {
    return internalError(res, 'mark read', error)
  }
})

router.post('/conversations/delete', async (req: Request, res: Response) => {
  const parsed = FixedConversationIdSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return invalidRequest(res, 'Invalid request body')
  }

  try {
    if (!await chatService.deleteConversation(parsed.data.conversationId)) {
      return conversationNotFound(res)
    }
    return res.json({ code: 0, data: { deleted: true } })
  }
  catch (error) {
    return internalError(res, 'delete', error)
  }
})

export default router
