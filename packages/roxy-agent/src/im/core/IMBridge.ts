import type { ContentBlock } from './attachments.js'
import { HumanMessage } from '@langchain/core/messages'
import { createAgent, deleteCheckpoint } from '../../deepagents/index.js'
import { mcpManager } from '../../mcpManager.js'
import { ThreadManager } from './threadManager.js'

export type { ContentBlock }

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface BridgeConfig {
  maxHistory?: number
}

interface SessionState {
  conversationId: string
  lastActivity: number
  isProcessing: boolean
}

export class IMBridge {
  private static readonly WORKER_ID = 'im-single-worker'

  private readonly imName: string
  private config: Required<BridgeConfig>
  private sessions: Map<string, SessionState> = new Map()
  private threadManager: ThreadManager

  constructor(imName: string, config: BridgeConfig = {}) {
    this.imName = imName
    this.config = {
      maxHistory: 20,
      ...config,
    }
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

    if (session.isProcessing) {
      return '⚠️ 上一条消息还在处理中，请稍候...'
    }

    session.isProcessing = true
    session.lastActivity = Date.now()

    let fullText = ''

    try {
      // 单 worker 模式：固定 worker id
      await mcpManager.createPlaywrightClientForWorker(IMBridge.WORKER_ID)
      const simpleTools = await mcpManager.getToolsForWorker(IMBridge.WORKER_ID)

      // 创建 agent
      const agent = await createAgent({
        mode: 'simple',
        tools: simpleTools,
        name: 'simple',
        conversationId: session.conversationId,
        promptVariant: 'im-compact',
      })

      const input = {
        messages: [
          Array.isArray(content)
            ? new HumanMessage({ content })
            : new HumanMessage(content || ''),
        ],
      }

      const stream = await agent.stream(input, {
        configurable: {
          thread_id: threadId,
        },
        streamMode: ['messages'],
      } as any)

      for await (const rawChunk of stream as any) {
        const [namespace, chunks] = rawChunk

        // 从消息 chunk 中提取文本
        if (namespace === 'messages' && chunks?.[0]) {
          const chunk = chunks?.[0]

          if ((chunk as any)?.type === 'tool') {
            continue
          }

          const msg = chunk
          let text = ''
          if (typeof msg.content === 'string') {
            text = msg.content
          }
          else if (Array.isArray(msg.content)) {
            text = msg.content
              .filter((b: any) => b.type === 'text')
              .map((b: any) => b.text)
              .join('')
          }

          if (text && onChunk) {
            fullText += text
            await onChunk(text)
          }
        }
      }

      await mcpManager.destroyPlaywrightClientForWorker(IMBridge.WORKER_ID)
      return fullText
    }
    catch (err) {
      await mcpManager.destroyPlaywrightClientForWorker(IMBridge.WORKER_ID).catch(() => {})
      throw err
    }
    finally {
      session.isProcessing = false
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

  getSessionLength(channelId: string): number {
    return 0
  }

  isBusy(): boolean {
    return Array.from(this.sessions.values()).some(session => session.isProcessing)
  }
}
