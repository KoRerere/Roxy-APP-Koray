import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import * as chatService from '@/services/chatService'

const router: Router = Router()

const CreateConversationSchema = z.object({
  conversationType: z.enum(['asset', 'automation']).optional(),
})

const UpdateConversationSchema = z.object({
  title: z.string().optional(),
  model: z.string().optional(),
  conversationType: z.enum(['asset', 'automation']).optional(),
})

// 创建新对话
router.post('/conversations', async (req: Request, res: Response) => {
  const parsed = CreateConversationSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.json({ code: 1, msg: parsed.error.issues[0]?.message ?? 'Invalid params' })
  }
  try {
    const conversation = chatService.createConversation(parsed.data.conversationType)
    res.json({
      code: 0,
      msg: 'Conversation created successfully',
      data: conversation,
    })
  }
  catch (error: any) {
    console.error('Error creating conversation:', error)
    res.json({
      code: 1,
      msg: 'Failed to create conversation',
      error: error.message,
    })
  }
})

// 获取对话列表
router.get('/conversations', async (_req: Request, res: Response) => {
  try {
    const conversations = chatService.listConversations()

    res.json({
      code: 0,
      msg: 'Conversations fetched successfully',
      data: conversations,
    })
  }
  catch (error: any) {
    console.error('Error getting conversations:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to get conversations',
    })
  }
})

// 读取文件内容（必须在 /:conversationId 之前注册，避免被动态段匹配）
router.get('/conversations/readFileContent', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.query
    if (!filePath) {
      return res.json({
        code: 1,
        error: 'FilePath is required',
        msg: 'FilePath is required',
      })
    }
    const content = await chatService.readFileContent(filePath as string)
    res.json({
      code: 0,
      msg: 'File content fetched successfully',
      data: content,
    })
  }
  catch (error: any) {
    console.error('Error getting messages:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to get messages',
    })
  }
})

// 获取对话详情
router.get('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params

    if (!conversationId || typeof conversationId !== 'string') {
      return res.json({
        code: 1,
        error: 'Conversation ID is required',
        msg: 'Conversation ID is required',
      })
    }

    const data = chatService.getConversationDetail(conversationId)

    res.json({
      code: 0,
      msg: 'Conversation detail fetched successfully',
      data,
    })
  }
  catch (error: any) {
    console.error('Error getting conversation detail:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to get conversation detail',
    })
  }
})

// 更新对话信息
router.put('/conversations/:conversationId', async (req: Request, res: Response) => {
  const parsed = UpdateConversationSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.json({ code: 1, msg: parsed.error.issues[0]?.message ?? 'Invalid params' })
  }
  try {
    const { conversationId } = req.params

    const success = chatService.updateConversation(conversationId as string, parsed.data)

    if (!success) {
      return res.json({
        code: 1,
        error: 'Conversation not found',
        msg: 'Conversation not found',
      })
    }

    res.json({
      code: 0,
      msg: 'Conversation updated successfully',
    })
  }
  catch (error: any) {
    console.error('Error updating conversation:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to update conversation',
    })
  }
})

// 删除对话
router.delete('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params as { conversationId: string }

    const success = chatService.deleteConversation(conversationId)
    if (!success) {
      return res.json({
        code: 1,
        error: 'Conversation not found',
        msg: 'Conversation not found',
      })
    }

    res.json({
      code: 0,
      msg: 'Conversation deleted successfully',
    })
  }
  catch (error: any) {
    console.error('Error deleting conversation:', error)
    res.json({
      code: 1,
      msg: 'Failed to delete conversation',
      error: error.message,
    })
  }
})

export default router
