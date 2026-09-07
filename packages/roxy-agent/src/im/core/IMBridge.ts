import type { ContentBlock } from './attachments.js'
import { extractAgentProfileDirIds } from '@roxy/shared'
import { executionCenter } from '../../core/registry/executionCenter.js'
import { publishTaskMonitorTaskFinished, publishTaskMonitorTaskStarted } from '../../core/task-monitor/index.js'
import { createRuntimeChatAgent, RuntimeEventPublisher } from '../../runtime/index.js'
import { ThreadManager } from './threadManager.js'

export type { ContentBlock }

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

interface SessionState {
  conversationId: string
  lastActivity: number
  isProcessing: boolean
  activeRunId?: string
  abortController?: AbortController
}

export class IMBridge {
  private readonly imName: string
  private sessions: Map<string, SessionState> = new Map()
  private threadManager: ThreadManager

  constructor(imName: string) {
    this.imName = imName
    this.threadManager = ThreadManager.getInstance()
  }

  private getSession(channelId: string): SessionState {
    let session = this.sessions.get(channelId)
    if (!session) {
      session = {
        conversationId: this.imName,
        lastActivity: Date.now(),
        isProcessing: false,
      }
      this.sessions.set(channelId, session)
    }
    return session
  }

  async handleMessage(
    channelId: string,
    content: string | ContentBlock[],
    onChunk?: (text: string) => Promise<void>,
  ): Promise<string> {
    const session = this.getSession(channelId)
    const threadId = this.threadManager.getThreadId(this.imName, channelId)
    const messageId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    if (session.isProcessing) {
      return '⚠️ 上一条消息还在处理中，请稍候...'
    }

    session.isProcessing = true
    session.lastActivity = Date.now()

    let fullText = ''
    const taskTitle = typeof content === 'string' && content.trim()
      ? content.trim().slice(0, 64)
      : `${this.imName} message`
    publishTaskMonitorTaskStarted({
      taskId: messageId,
      title: taskTitle,
      sourceType: 'im',
      conversationId: threadId,
      runId: messageId,
    })

    const abortController = new AbortController()
    session.activeRunId = messageId
    session.abortController = abortController
    executionCenter.register({
      id: messageId,
      source: 'im',
      conversationId: threadId,
      title: taskTitle,
      metadata: { channelId, imName: this.imName },
      cancel: () => {
        abortController.abort('User cancelled')
        return true
      },
    })
    executionCenter.start(messageId)

    let destroy: (() => Promise<void>) | undefined
    let outcome: 'completed' | 'failed' | 'cancelled' = 'completed'
    try {
      const input = Array.isArray(content)
        ? content.filter(block => block.type === 'text').map(block => block.text ?? '').join(' ')
        : content || ''
      const agentInstance = await createRuntimeChatAgent({
        conversationId: threadId,
        executionId: messageId,
        runId: messageId,
        turnId: messageId,
        fullAccess: true,
        taskMonitorTaskId: messageId,
        reportAllowedDirIds: extractAgentProfileDirIds(input),
      })
      const { agent, createInput, destroy: _destroy } = agentInstance
      destroy = _destroy
      const publisher = new RuntimeEventPublisher(() => {}, { emitDone: false, agentPath: '/root' })
      for await (const event of agent.stream(createInput(input), abortController.signal)) {
        publisher.handle(event)
        if (event.type === 'text' && onChunk) {
          await onChunk(event.delta)
        }
      }
      fullText = publisher.getFinalAnswer()

      return fullText
    }
    catch (error) {
      outcome = abortController.signal.aborted ? 'cancelled' : 'failed'
      throw error
    }
    finally {
      executionCenter.finish(messageId, abortController.signal.aborted ? 'cancelled' : outcome)
      publishTaskMonitorTaskFinished(messageId)
      if (destroy) {
        await destroy()
      }
      session.isProcessing = false
      session.activeRunId = undefined
      session.abortController = undefined
    }
  }

  async clearSession(channelId: string): Promise<void> {
    const session = this.getSession(channelId)
    const oldThreadId = this.threadManager.getThreadId(this.imName, channelId)
    const newThreadId = this.threadManager.regenerateThreadId(this.imName, channelId)

    // 注意：不删除整个 checkpoint 数据库，因为多个 channel 共享同一个 conversationId（IM名称）
    // 只需要生成新的 threadId 即可实现会话隔离

    session.lastActivity = Date.now()
    console.log(`[IMBridge] Cleared session for channel: ${channelId}, oldThread: ${oldThreadId}, newThread: ${newThreadId}`)
  }

  getSessionLength(_channelId: string): number {
    return 0
  }

  isBusy(): boolean {
    return Array.from(this.sessions.values()).some(session => session.isProcessing)
  }
}
