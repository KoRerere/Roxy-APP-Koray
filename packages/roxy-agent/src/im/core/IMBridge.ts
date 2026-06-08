import type { AgentInstance } from '../../deepagents/index.js'
import type { ContentBlock } from './attachments.js'
import { HumanMessage } from '@langchain/core/messages'
import { createClawAgent, createScriptAgent } from '../../deepagents/index.js'
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
    agentType: 'claw' | 'script' = 'claw',
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

    let destroy: (() => Promise<void>) | undefined
    try {
      let agentInstance: AgentInstance
      if (agentType === 'script') {
        agentInstance = await createScriptAgent({
          conversationId: threadId,
          turnId: messageId,
        })
      }
      else {
        agentInstance = await createClawAgent({
          workerId: IMBridge.WORKER_ID,
          conversationId: threadId,
          turnId: messageId,
        })
      }
      const { agent, destroy: _destroy } = agentInstance
      destroy = _destroy
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

          if (text) {
            fullText += text
          }

          if (text && onChunk) {
            await onChunk(text)
          }
        }
      }

      return fullText
    }
    finally {
      if (destroy) {
        await destroy()
      }
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

  getSessionLength(_channelId: string): number {
    return 0
  }

  isBusy(): boolean {
    return Array.from(this.sessions.values()).some(session => session.isProcessing)
  }
}
