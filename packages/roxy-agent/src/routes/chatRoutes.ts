import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { abortRun, createAbort } from '@/core/registry/abortRegistry'
import { cancelInterrupt, resolveInterrupt } from '@/core/registry/interruptRegistry'
import * as chatService from '@/services/chatService'
import * as fileService from '@/services/fileService'
import * as imageService from '@/services/imageService'

const router: Router = Router()

// 附件用宽松 schema：前端仅回传 fileId，其余字段可选，避免过度约束破坏现有传参
const AttachmentInputSchema = z.looseObject({ fileId: z.string() })

const ChatSchema = z.object({
  message: z.string({ error: 'message is required' }),
  conversationId: z.string({ error: 'conversationId is required' }),
  enableThinking: z.boolean().optional(),
  mode: z.string().optional(),
  attachments: z.array(AttachmentInputSchema).optional(),
  multimodalAttachments: z.boolean().optional(),
  /** 完全访问模式（yolo）：开启后本次会话跳过 HITL，所有操作直接执行。 */
  fullAccess: z.boolean().optional(),
})

const ImageGenerationSchema = z.object({
  message: z.string({ error: 'message is required' }),
  conversationId: z.string({ error: 'conversationId is required' }),
  attachments: z.array(AttachmentInputSchema).optional(),
  assetOptions: z.any().optional(),
})

const ResumeSchema = z.object({
  decisions: z.array(z.any(), { error: 'decisions array is required' }),
})

function firstIssue(error: z.ZodError, fallback: string) {
  return error.issues[0]?.message ?? fallback
}

// 生图（流式）
router.post('/images/generations', async (req: Request, res: Response) => {
  const parsed = ImageGenerationSchema.safeParse(req.body)
  if (!parsed.success) {
    const msg = firstIssue(parsed.error, 'message or attachments and conversationId are required')
    return res.json({ code: 1, error: msg, msg })
  }

  const { message, conversationId, attachments, assetOptions } = parsed.data
  const attachmentList = await fileService.hydrateAttachmentFileUrls(Array.isArray(attachments) ? attachments : [])

  if (!message.trim() && attachmentList.length === 0) {
    return res.json({
      code: 1,
      error: 'message or attachments and conversationId are required',
      msg: 'message or attachments and conversationId are required',
    })
  }

  const conversation = chatService.getConversation(conversationId)
  if (!conversation) {
    return res.json({
      code: 1,
      error: 'conversation not found',
      msg: 'conversation not found',
    })
  }

  const abortController = createAbort(conversationId)

  await imageService.runImageStream({
    prompt: message,
    conversationId,
    attachmentList,
    assetOptions,
    conversation,
    signal: abortController.signal,
    res,
  })

  res.end()
})

// 开始对话（流式聊天）
router.post('/chat', async (req: Request, res: Response) => {
  const parsed = ChatSchema.safeParse(req.body)
  if (!parsed.success) {
    const msg = firstIssue(parsed.error, 'message or attachments and conversationId are required')
    return res.json({ code: 1, error: msg, msg })
  }

  const { message, conversationId, mode, attachments, multimodalAttachments, fullAccess } = parsed.data
  const attachmentList = await fileService.hydrateAttachmentFileUrls(Array.isArray(attachments) ? attachments : [])

  const abortController = createAbort(conversationId)

  if (!message && !attachmentList.length) {
    return res.json({
      code: 1,
      error: 'message or attachments and conversationId are required',
      msg: 'message or attachments and conversationId are required',
    })
  }

  // 获取对话信息
  const conversation = chatService.getConversation(conversationId)
  if (!conversation) {
    return res.json({
      code: 1,
      error: 'conversation not found',
      msg: 'conversation not found',
    })
  }

  await chatService.runChatStream({
    message,
    conversationId,
    mode,
    multimodalAttachments,
    attachmentList,
    conversation,
    signal: abortController.signal,
    res,
    fullAccess,
  })

  res.end()
})

// 恢复被 HITL interrupt 暂停的对话
router.post('/conversations/:conversationId/resume', async (req: Request, res: Response) => {
  const parsed = ResumeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({
      code: 1,
      error: 'decisions array is required',
      msg: 'decisions array is required',
    })
  }
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId

    if (resolveInterrupt(conversationId, { decisions: parsed.data.decisions })) {
      return res.json({
        code: 0,
        msg: 'Resume decision submitted successfully',
      })
    }
    else {
      return res.json({
        code: 1,
        error: 'No pending interrupt found for this conversation',
        msg: 'No pending interrupt found for this conversation',
      })
    }
  }
  catch (error: any) {
    console.error('Error resuming conversation:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to resume conversation',
    })
  }
})

// 停止对话（包括 HITL 等待状态）
router.post('/conversations/:conversationId/stop', async (req: Request, res: Response) => {
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId

    // 如果当前处于 HITL 等待状态，先取消 interrupt gate
    cancelInterrupt(conversationId)

    if (abortRun(conversationId)) {
      return res.json({
        code: 0,
        msg: 'Conversation stopped successfully',
      })
    }
    else {
      return res.json({
        code: 1,
        error: 'Conversation not found',
        msg: 'Conversation not found',
      })
    }
  }
  catch (error: any) {
    console.error('Error stopping conversation:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to stop conversation',
    })
  }
})

export default router
