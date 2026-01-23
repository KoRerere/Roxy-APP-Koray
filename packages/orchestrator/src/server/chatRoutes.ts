import type { StreamMode } from '@langchain/langgraph'
import type { Request, Response } from 'express'
import { HumanMessage } from '@langchain/core/messages'
import { Router } from 'express'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { orchestratorGraph, simpleGraph } from '../agent'
import { AbortError, abortRun, createAbort } from '../agent/utils/abortRegistry'
import { env } from '../config'
import { ChatContextAPI } from '../database/conversations'
import { SummaryManager } from '../database/summary'
import { sseLoggerManager } from './sseLogger'
import { streamAdapter } from './streamAdapter'

// sse 原始数据存储目录
if (!fs.existsSync(path.join(env.CHECKPOINT_DIR!, 'sse'))) {
  fs.mkdirSync(path.join(env.CHECKPOINT_DIR!, 'sse'), { recursive: true })
}

const router: Router = Router()

// 创建新对话
router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const finalThreadId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const conversation = ChatContextAPI.createConversation({
      id: conversationId,
      title: 'New Chat',
      thread_id: finalThreadId,
      // model: model || 'gpt-4',
    })

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
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const conversations = ChatContextAPI.getConversations()

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

// 获取当前活跃的对话
router.get('/conversations/active', async (req: Request, res: Response) => {
  try {
    const activeConversation = ChatContextAPI.getActiveConversation()

    res.json({
      code: 0,
      msg: 'Active conversation fetched successfully',
      data: activeConversation,
    })
  }
  catch (error: any) {
    console.error('Error getting active conversation:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to get active conversation',
    })
  }
})

// 设置指定对话为活跃状态
router.put('/conversations/:conversationId/active', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params

    if (!conversationId || typeof conversationId !== 'string') {
      return res.json({
        code: 1,
        error: 'Conversation ID is required',
        msg: 'Conversation ID is required',
      })
    }

    const success = ChatContextAPI.setActiveConversation(conversationId)

    if (!success) {
      return res.json({
        code: 1,
        error: 'Conversation not found',
        msg: 'Conversation not found',
      })
    }

    res.json({
      code: 0,
      msg: 'Conversation set as active successfully',
    })
  }
  catch (error: any) {
    console.error('Error setting active conversation:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to set active conversation',
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

    const conversationDetail = ChatContextAPI.getConversation(conversationId)

    const messages = ChatContextAPI.getMessagesByConversation(conversationId)

    res.json({
      code: 0,
      msg: 'Conversation detail fetched successfully',
      data: {
        ...conversationDetail,
        messages,
      },
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
  try {
    const { conversationId } = req.params
    const { title, model } = req.body

    const success = ChatContextAPI.updateConversation(conversationId as string, { title, model })

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
    const { conversationId } = req.params

    // 获取对话信息，找到对应的thread_id
    const conversation = ChatContextAPI.getConversation(conversationId as string)
    if (!conversation) {
      return res.json({
        code: 1,
        error: 'Conversation not found',
        msg: 'Conversation not found',
      })
    }

    // 删除对话相关的消息
    ChatContextAPI.deleteMessagesByConversation(conversationId as string)

    // 删除对话记录
    ChatContextAPI.deleteConversation(conversationId as string)

    // 删除对话摘要（记忆信息）
    SummaryManager.deleteSummary(conversation.thread_id)

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

// 读取文件内容
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
    const content = await fsPromises.readFile(filePath as string, 'utf-8')
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

// 获取对话统计信息
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const conversations = ChatContextAPI.getConversations()
    const context = ChatContextAPI.getCurrentContext()

    const stats = {
      userId: context.userId,
      workspaceId: context.workspaceId,
      totalConversations: conversations.length,
      totalMessages: conversations.reduce((sum, conv) => sum + (conv.message_count || 0), 0),
    }

    res.json({
      code: 0,
      msg: 'Stats fetched successfully',
      data: stats,
    })
  }
  catch (error: any) {
    console.error('Error getting stats:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to get stats',
    })
  }
})

// 开始对话（流式聊天）
router.post('/chat', async (req: Request, res: Response) => {
  if (env.LLM_BALANCE <= 0) {
    res.write(streamAdapter.error('Balance is not enough'))
    res.end()
    return
  }

  const abortController = createAbort(req.body.conversationId)
  const { message, conversationId, enableThinking, mode } = req.body

  if (!message || !conversationId) {
    return res.json({
      code: 1,
      error: 'message and conversationId are required',
      msg: 'message and conversationId are required',
    })
  }

  // 获取对话信息
  const conversation = ChatContextAPI.getConversation(conversationId)
  if (!conversation) {
    return res.json({
      code: 1,
      error: 'conversation not found',
      msg: 'conversation not found',
    })
  }

  // 如果是第一条消息且标题还没有被设置过，则使用消息的前15个字符更新标题
  if (conversation.is_title_set === 0 || conversation.is_title_set === undefined) {
    const messages = ChatContextAPI.getMessagesByConversation(conversationId)
    // 检查是否只有系统消息或没有消息（用户消息是第一条）
    const userMessages = messages.filter(msg => msg.role === 'user')
    if (userMessages.length === 0) {
      // 这是第一条用户消息，更新标题
      const titlePreview = message.trim().substring(0, 15) || 'New Chat'
      ChatContextAPI.updateConversation(conversationId, { title: titlePreview })
    }
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  res.flushHeaders()

  // 添加用户消息到对话历史
  const agentMode = (mode === 'orchestrator' ? 'orchestrator' : 'simple') as 'orchestrator' | 'simple'
  ChatContextAPI.addMessage({
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    conversation_id: conversationId,
    role: 'user',
    content: message,
    content_type: 'text',
    storage_type: 'inline',
    agent_mode: agentMode,
    metadata: {
      timestamp: Date.now(),
      source: 'api_chat',
    },
  })

  const fileName = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const sseFilePath = path.join(env.CHECKPOINT_DIR!, 'sse', `${fileName}.sse`)

  ChatContextAPI.addMessage({
    id: fileName,
    conversation_id: conversationId,
    role: 'assistant',
    content: '',
    content_type: 'file',
    storage_type: 'file',
    file_path: sseFilePath,
    agent_mode: agentMode,
    metadata: {
      timestamp: Date.now(),
      source: 'sse_stream',
    },
  })

  const sseLogger = sseLoggerManager.createLogger(sseFilePath)

  const streamCallback = (event: any) => {
    res.write(event)
    sseLogger.log(event)

    if (typeof (res as any).flush === 'function') {
      (res as any).flush()
    }
  }

  // 先把会话开始标识写入
  streamCallback(streamAdapter.session(conversation.thread_id))

  try {
    const config = {
      configurable: {
        thread_id: conversation.thread_id,
      },
      version: 'v2',
      streamMode: ['custom'] as StreamMode[],
      signal: abortController.signal,
    }

    const input = {
      messages: [new HumanMessage(message)],
      enableThinking: enableThinking ?? false,
    }

    const graph = agentMode === 'orchestrator' ? orchestratorGraph : simpleGraph

    const stream = await graph.stream(input, config)
    // @ts-ignore
    for await (const [mode, event] of stream) {
      if (mode === 'custom') {
        streamCallback(event)
      }
    }

    streamCallback(streamAdapter.done())
  }
  catch (error: any) {
    // 检查是否是中断错误（用户取消或客户端断开连接）
    if (AbortError.isAbortError(error) || error.message.includes('User cancelled')) {
      // 中断错误，静默处理，不发送错误消息给客户端
      console.log('Chat interrupted by user')
      streamCallback(streamAdapter.interrupt(error.message))
    }
    else {
      // 其他错误，正常处理
      console.error('Error in chat:', error)
      streamCallback(streamAdapter.error(error.message, error.stack))
    }
  }

  process.parentPort?.postMessage({ event: 'save_chat_message', data: { conversationId, file: sseFilePath, message } })
  sseLoggerManager.closeLogger(sseFilePath)
  res.end()
})

// 中断对话
router.post('/chat/:conversationId/interrupt', async (req: Request, res: Response) => {
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId
    if (abortRun(conversationId)) {
      return res.json({
        code: 0,
        msg: 'Conversation interrupted successfully',
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
    console.error('Error interrupting conversation:', error)
    res.json({
      code: 1,
      error: error.message,
      msg: 'Failed to interrupt conversation',
    })
  }
})

export default router
