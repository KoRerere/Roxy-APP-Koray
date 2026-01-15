import type { Request, Response } from 'express'
import { HumanMessage } from '@langchain/core/messages'
import cors from 'cors'
// Load environment variables
// import dotenv, { config } from 'dotenv'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { v4 as uuidv4 } from 'uuid'
import type { ThreadInfo } from '../agent/checkpoint'
import type { StreamEvent } from './types'
import { getGraph } from '../agent'
import { deleteThreadCheckpoints, listThreads } from '../agent/checkpoint'
import { AIMessageLogger } from './aiMessageStorage'
import { ChatLogger } from './chatLogger'
import { StreamEventHandler } from './handlers/StreamEventHandler'
import { MessageCollector } from './messageCollector'
import { deleteMessageMappings, loadMessageMappings, saveMessageMapping } from './messageMappingStorage'
import { StreamAdapter } from './streamAdapter'
import { deleteUserMessages, listThreadIds as listUserMessageThreadIds, loadUserMessages, saveUserMessage } from './userMessageStorage'

// ES modules 环境下提供 __filename 和 __dirname polyfill
// 这对于 Electron 环境和其他使用 ES modules 的场景是必需的
// 依赖库（如 @langchain/langgraph-checkpoint-sqlite）可能会使用这些变量
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// 将 __filename 和 __dirname 添加到 globalThis 对象，以便依赖库可以使用
;(globalThis as any).__filename = __filename
;(globalThis as any).__dirname = __dirname

// 在服务器启动时预初始化 checkpoint saver
// 这样可以确保数据库文件被创建
let isInitialized = false

async function initializeCheckpoint() {
  if (!isInitialized) {
    try {
      console.log('🔄 Initializing checkpoint database...')
      await getGraph() // 这会触发 checkpoint saver 的创建
      console.log('✅ Checkpoint database initialized')
      isInitialized = true
    }
    catch (error) {
      console.error('❌ Failed to initialize checkpoint database:', error)
    }
  }
}

// dotenv.config()

const PORT = process.env.PORT || 3000

console.log(process.env)

// const streamAdapter = new StreamAdapter()

// Stream event handler
const streamEventHandler = new StreamEventHandler()

if (!PORT) {
  console.error('❌ Error: PORT not found in environment variables')
  // 不退出进程，只打印错误
}

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Serve static files from root directory
app.use(express.static('.'))

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Create new session
app.post('/api/sessions', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    // 生成新的 thread_id，格式：${userId}_${timestamp}
    // 这样前端可以通过 threadId.startsWith(userId) 来过滤
    const sessionId = Date.now().toString()
    const threadId = `${userId}_${sessionId}`

    // 如果需要，可以在这里初始化一个空的 checkpoint
    // 但实际上 checkpoint 会在第一次发送消息时自动创建
    // 所以这里只需要返回新的 thread_id

    res.json({
      success: true,
      sessionId: threadId,
      threadId, // 兼容字段
      message: 'Session created successfully',
    })
  }
  catch (error: any) {
    console.error('Error creating session:', error)
    res.status(500).json({
      error: 'Failed to create session',
      message: error.message,
    })
  }
})

// Delete session (删除指定 thread_id 的所有数据：checkpoint、用户消息、消息映射)
app.delete('/api/sessions/:threadId', async (req: Request, res: Response) => {
  try {
    const threadId = Array.isArray(req.params.threadId)
      ? req.params.threadId[0]
      : req.params.threadId

    if (!threadId) {
      return res.status(400).json({ error: 'threadId is required' })
    }

    // 删除所有相关数据
    await deleteThreadCheckpoints(threadId)
    await deleteUserMessages(threadId)
    await deleteMessageMappings(threadId)
    await AIMessageLogger.deleteThreadLogs(threadId) // 删除整个threadId目录
    try {
      await ChatLogger.deleteLogFile(threadId)
    }
    catch (error) {
      // 文件不存在，忽略错误
    }

    res.json({
      success: true,
      message: `Thread ${threadId} deleted successfully`,
    })
  }
  catch (error: any) {
    console.error('Error deleting session:', error)
    res.status(500).json({
      error: 'Failed to delete session',
      message: error.message,
    })
  }
})

// Get session info (列出所有 thread_id，支持按 userId 过滤)
app.get('/api/sessions', async (req: Request, res: Response) => {
  try {
    const { withMetadata, userId: _queryUserId } = req.query
    const includeMetadata = withMetadata === 'true' || withMetadata === '1'
    // 确保 userId 是 string 类型
    const normalizedUserId: string | undefined = Array.isArray(_queryUserId)
      ? (typeof _queryUserId[0] === 'string' ? _queryUserId[0] : undefined)
      : (typeof _queryUserId === 'string' ? _queryUserId : undefined)

    // 直接在 listThreads 中传入 userId 进行过滤（在遍历 checkpoint 时过滤，更高效）
    if (includeMetadata) {
      const threads = await listThreads(true, normalizedUserId) as ThreadInfo[]
      res.json({
        success: true,
        threads,
        count: threads.length,
      })
    }
    else {
      const threadIds = await listThreads(false, normalizedUserId)
      res.json({
        success: true,
        threads: threadIds,
        count: threadIds.length,
      })
    }
  }
  catch (error: any) {
    console.error('Error listing sessions:', error)
    res.status(500).json({
      error: 'Failed to list sessions',
      message: error.message,
    })
  }
})

// Get user chat history from log file
app.get('/api/history/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    // 获取所有相关的 threadIds
    const userMessageThreadIds = await listUserMessageThreadIds()

    // 合并并去重
    const allThreadsSet = new Set([...userMessageThreadIds])

    // 过滤出属于该用户的 threadIds
    const userThreads = Array.from(allThreadsSet).filter(threadId =>
      threadId.startsWith(userId) || threadId === userId,
    )

    // 加载所有用户的历史记录
    const history = []
    for (const threadId of userThreads) {
      // 从本地文件加载用户消息（按时间戳排序）
      const userMessages = await loadUserMessages(threadId)
      console.log(`[History API] Thread ${threadId}: Loaded ${userMessages.length} user messages from local file`)

      // 从本地文件加载 AI 消息事件日志
      const eventMappings = await AIMessageLogger.loadAllFromThread(threadId)
      console.log(`[History API] Thread ${threadId}: Loaded event mappings for ${Object.keys(eventMappings).length} user messages`)

      // 加载消息映射（格式：{ userMessageId: { aiMessageId, userContent } }）
      const messageMappings = await loadMessageMappings(threadId)
      console.log(`[History API] Thread ${threadId}: Loaded ${Object.keys(messageMappings).length} message mappings`)

      // 转换为 API 格式，并包含消息映射信息
      const formattedUserMessages = userMessages.map((msg) => {
        const mapping = messageMappings[msg.id]
        console.log('mapping: ', msg)
        return {
          id: msg.id,
          type: 'user',
          content: msg.content,
          timestamp: msg.timestamp,
          aiMessageId: mapping?.aiMessageId, // 包含对应的 AI 消息 ID
        }
      })

      // 构建事件映射，保持每个用户消息的事件分组
      const eventMappingsWithUserMessageId: Record<string, any[]> = {}
      for (const [userMessageId, events] of Object.entries(eventMappings)) {
        // 为每个用户消息创建事件数组，包含user_message_id事件
        const userEvents = [
          // 首先添加 user_message_id 事件
          {
            type: 'user_message_id',
            data: {
              userMessageId,
              aiMessageId: messageMappings[userMessageId]?.aiMessageId,
            },
            timestamp: events[0]?.timestamp || Date.now(),
          },
          // 然后添加该用户消息对应的所有事件
          ...events,
        ]

        // 按时间戳排序该用户消息的事件
        userEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))

        eventMappingsWithUserMessageId[userMessageId] = userEvents
      }

      if (formattedUserMessages.length > 0 || Object.keys(eventMappingsWithUserMessageId).length > 0) {
        history.push({
          threadId,
          eventMappings: eventMappingsWithUserMessageId, // 使用分组的事件映射
          eventCount: Object.values(eventMappingsWithUserMessageId).reduce((sum, events) => sum + events.length, 0),
          userMessages: formattedUserMessages,
        })
      }
    }

    res.json({
      success: true,
      userId,
      history,
      totalThreads: userThreads.length,
      totalEvents: history.reduce((sum, h) => sum + h.eventCount, 0),
    })
  }
  catch (error: any) {
    console.error('Error getting user history:', error)
    res.status(500).json({
      error: 'Failed to get user history',
      message: error.message,
    })
  }
})

// Clear user history (删除用户的所有 thread)
// 注意：这里假设 userId 和 threadId 有某种映射关系
// 如果需要按 userId 删除，需要维护 userId -> threadId 的映射关系
app.delete('/api/history/:userId', async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    // 获取所有 threads
    const allThreads = await listThreads()

    // 如果 threadId 格式是 userId_xxx 或者就是 userId，则删除匹配的
    // 这里可以根据实际业务逻辑调整匹配规则
    const userThreads = allThreads.filter(threadId =>
      threadId.startsWith(userId) || threadId === userId,
    )

    // 删除所有匹配的 threads（包括 checkpoint、用户消息文件和消息映射文件）
    for (const threadId of userThreads) {
      await deleteThreadCheckpoints(threadId)
      await deleteUserMessages(threadId)
      await deleteMessageMappings(threadId)
      await AIMessageLogger.deleteThreadLogs(threadId)
    }

    res.json({
      success: true,
      message: `Deleted ${userThreads.length} threads for user ${userId}`,
      deletedThreads: userThreads,
    })
  }
  catch (error: any) {
    console.error('Error clearing user history:', error)
    res.status(500).json({
      error: 'Failed to clear user history',
      message: error.message,
    })
  }
})

/**
 * 保存 AI 消息事件日志
 */
async function saveAIMessageEventLog(aiMessageLogger: AIMessageLogger): Promise<void> {
  try {
    await aiMessageLogger.saveToFile()
    console.log(`[API] Saved AI message event log with ${aiMessageLogger.getEventCount()} events for user message ${aiMessageLogger.userMessageId}`)
  }
  catch (error) {
    console.error('[API] Failed to save AI message event log:', error)
  }
}

// Chat endpoint with SSE streaming
app.post('/api/chat', async (req: Request, res: Response) => {
  const chatRequest = req.body
  const { message, userId, threadId, enableThinking, mode } = chatRequest

  console.log('/api/chat::chatRequest..', chatRequest)

  if (!message) {
    return res.status(400).json({ error: 'Message is required' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

  res.flushHeaders()

  // 如果没有提供 threadId，生成一个新的
  // 格式：${userId}_${timestamp}，这样前端可以通过 threadId.startsWith(userId) 来过滤
  let currentThreadId = threadId
  if (!currentThreadId) {
    if (userId) {
      const sessionId = Date.now().toString()
      currentThreadId = `${userId}_${sessionId}`
    }
    else {
      // 如果没有 userId，使用 uuid（向后兼容）
      throw new Error('userId is required')
    }
  }
  res.write(StreamAdapter.session(currentThreadId))

  // const sseEventLogger = new EventLogger(`sse-${currentThreadId}`)

  // 生成用户消息 ID（用于绑定 AI 回复）
  const userMessageId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  // 生成 AI 消息 ID（用于绑定到用户消息）
  const aiMessageId = `ai_${userMessageId}`

  // 创建消息收集器
  const messageCollector = new MessageCollector(aiMessageId, userMessageId, currentThreadId, userId || '')

  // 创建 AI 消息日志记录器
  const aiMessageLogger = new AIMessageLogger(currentThreadId, userMessageId)

  const streamCallback = (event: StreamEvent) => {
    // 收集事件用于后续保存
    messageCollector.collectEvent(event)

    // 同时收集到 AI 消息日志记录器
    // 注意：只有在有 userMessageId 的情况下才保存事件
    // 保存完整的事件格式，包含所有顶层字段
    if (userMessageId && event.type !== 'user_message_id' && event.type !== 'session') {
      // 确保事件有时间戳
      const eventWithTimestamp = {
        ...event,
        timestamp: event.timestamp || Date.now(),
      }
      aiMessageLogger.addEvent(eventWithTimestamp)
    }

    // 在事件数据中添加消息 ID
    const eventWithMessageId: StreamEvent = {
      ...event,
      data: {
        ...(event.data || {}),
        messageId: aiMessageId,
        userMessageId,
      },
    }

    const sseMessage = StreamAdapter.formatSSE(eventWithMessageId)
    res.write(sseMessage)
    // Ensure data is flushed immediately for streaming
    if (typeof (res as any).flush === 'function') {
      (res as any).flush()
    }
  }

  try {
    // 使用 sessionId 作为 thread_id 来管理会话上下文
    const threadId = currentThreadId
    console.log('thread_id: ', threadId)
    console.log('user_id: ', userId)

    // 使用 thread_id 来恢复或创建会话状态
    const config = {
      configurable: {
        thread_id: threadId,
        user_id: userId || '',
      },
      version: 'v2',
      streamMode: ['custom'],
    }

    // 保存用户消息到本地文件
    await saveUserMessage({
      id: userMessageId,
      threadId,
      userId: userId || '',
      content: message,
      timestamp: Date.now(),
    })

    // 保存消息映射（格式：{ userMessageId: { aiMessageId, userContent } }）
    await saveMessageMapping(threadId, userMessageId, aiMessageId, message)

    // 通过 streamCallback 发送 userMessageId 事件，让前端知道用户消息 ID
    streamCallback({
      type: 'user_message_id',
      data: {
        userMessageId,
        aiMessageId,
        threadId,
      },
    } as StreamEvent)

    // LangGraph 会自动保存用户消息到 checkpoint
    // 当调用 graph.stream(input, config) 时，input 中的 messages 会被自动追加到状态中
    // 并根据 reducer 函数（x.concat(y)）合并到历史消息中，然后保存到 checkpoint
    const input = {
      messages: [new HumanMessage(message)],
      enableThinking: enableThinking ?? false,
    }

    if (mode === 'orchestrator') {
      await streamEventHandler.handleOrchestratorStream(
        input,
        config,
        streamCallback,
      )

      // 编排模式
      res.write(StreamAdapter.done())
      res.end()

      // 流式输出完成后，保存 AI 消息事件日志
      await saveAIMessageEventLog(aiMessageLogger)
    }

    if (mode === 'simple') {
      await streamEventHandler.handleSimpleStream(input, config, streamCallback)
      res.write(StreamAdapter.done())
      res.end()

      // 流式输出完成后，保存 AI 消息事件日志
      await saveAIMessageEventLog(aiMessageLogger)
    }
  }
  catch (error: any) {
    console.error('Error in /api/chat:', error)
    res.write(StreamAdapter.error(error.message, error.stack))
    res.end()
  }
  // finally {
  //   await sseEventLogger.saveToFile()
  // }
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  process.exit(0)
})

/**
 * Start server
 */
export async function startServer() {
  // 先初始化 checkpoint
  await initializeCheckpoint()
  console.log('Starting server on port:', PORT)
  app.listen(PORT, (error) => {
    if (error) {
      console.error('Error starting server:', error)
    }
    else {
      console.log(`🚀 API Server running on http://localhost:${PORT}`)
      console.log(`📡 SSE endpoint: POST http://localhost:${PORT}/api/chat`)
    }
  })
}
