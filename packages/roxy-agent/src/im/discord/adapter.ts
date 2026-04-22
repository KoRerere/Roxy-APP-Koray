import type { IMBridge } from '../core/IMBridge.js'
import type { APIMessage, Snowflake } from 'discord-api-types/v10'
import type { Buffer } from 'node:buffer'
import { WebSocket } from 'ws'
import { buildMessageContent } from '../core/attachments.js'
import { normalizeImText } from '../core/outputGuard.js'
import { proxyFetch } from '../core/proxy.js'
import { StreamSender } from '../core/StreamSender.js'

const DISCORD_TEXT_MAX_CHARS = 2000
const DISCORD_API_BASE = 'https://discord.com/api/v10'

interface DiscordConfig {
  botToken: string
  allowedUserIds?: string
}

/**
 * 轻量级 Discord 客户端，不依赖 discord.js
 */
class SimpleDiscordClient {
  private token: string
  private gatewayUrl?: string
  private ws?: WebSocket
  private heartbeatInterval?: NodeJS.Timeout
  private lastSequenceNumber?: number

  constructor(token: string) {
    this.token = token
  }

  private get headers() {
    return {
      'Authorization': `Bot ${this.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordBot (https://github.com/roxybrowser, 1.0.0)',
    }
  }

  async request<T = any>(method: string, path: string, data?: any): Promise<T> {
    const url = `${DISCORD_API_BASE}${path}`
    const options: RequestInit = {
      method,
      headers: this.headers,
    }
    if (data) {
      options.body = JSON.stringify(data)
    }
    const response = await proxyFetch(url, options)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Discord API error: ${response.status} ${text}`)
    }
    if (response.status === 204) {
      return undefined as T
    }
    return response.json()
  }

  async getGateway(): Promise<string> {
    if (this.gatewayUrl) {
      return this.gatewayUrl
    }
    const data = await this.request<{ url: string }>('GET', '/gateway/bot')
    this.gatewayUrl = data.url
    return this.gatewayUrl
  }

  /**
   * 测试连接是否正常
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getGateway()
      return true
    }
    catch {
      return false
    }
  }

  async sendMessage(channelId: string, content: string): Promise<APIMessage> {
    return this.request('POST', `/channels/${channelId}/messages`, { content })
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<APIMessage> {
    return this.request('PATCH', `/channels/${channelId}/messages/${messageId}`, { content })
  }

  async triggerTyping(channelId: string): Promise<void> {
    return this.request('POST', `/channels/${channelId}/typing`)
  }

  async connect(handleEvent: (event: any) => Promise<void>) {
    const gatewayUrl = await this.getGateway()
    const wsUrl = `${gatewayUrl}?v=10&encoding=json`

    this.ws = new WebSocket(wsUrl)

    this.ws.on('open', () => {
      console.debug('[Discord] WebSocket connected')
    })

    this.ws.on('message', async (data: any) => {
      try {
        const parsed = JSON.parse(data.toString())
        await this.handleGatewayMessage(parsed, handleEvent)
      }
      catch (err) {
        console.error('[Discord] Failed to parse message:', err)
      }
    })

    this.ws.on('error', (error: any) => {
      console.error('[Discord] WebSocket error:', error)
    })

    this.ws.on('close', (code: number, reason: Buffer) => {
      console.debug('[Discord] WebSocket closed:', code, reason?.toString?.() || '')
      this.cleanup()
    })
  }

  private async handleGatewayMessage(data: any, handleEvent: (event: any) => Promise<void>) {
    const { op, d, s, t } = data

    this.lastSequenceNumber = s ?? this.lastSequenceNumber

    switch (op) {
      case 10: // Hello
        this.startHeartbeat(d.heartbeat_interval)
        await this.identify()
        break

      case 11: // Heartbeat ACK
        break

      case 0: // Dispatch
        if (t === 'READY') {
          this.sessionId = d.session_id
          this.resumeGatewayUrl = d.resume_gateway_url
          console.log('[Discord] Ready!')
        }
        else if (t === 'RESUMED') {
          console.debug('[Discord] Resumed')
        }
        await handleEvent(data)
        break
    }
  }

  private startHeartbeat(intervalMs: number) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat()
    }, intervalMs)
    // 立即发送第一次心跳
    this.sendHeartbeat()
  }

  private sendHeartbeat() {
    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(JSON.stringify({
          op: 1,
          d: this.lastSequenceNumber ?? null,
        }))
      }
      catch (e) {
        console.warn('[Discord] Failed to send heartbeat:', e)
      }
    }
  }

  private async identify() {
    if (!this.ws || this.ws.readyState !== 1) {
      return
    }

    try {
      this.ws.send(JSON.stringify({
        op: 2,
        d: {
          token: this.token,
          intents: 1 << 9 | 1 << 11 | 1 << 15, // GuildMessages, MessageContent, DirectMessages
          properties: {
            os: process.platform,
            browser: 'roxy-agent',
            device: 'roxy-agent',
          },
        },
      }))
    }
    catch (e) {
      console.error('[Discord] Failed to send identify:', e)
    }
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = undefined
    }
  }

  async disconnect() {
    this.cleanup()
    if (this.ws) {
      try {
        this.ws.close()
      }
      catch (e) {
        // ignore
      }
      this.ws = undefined
    }
  }
}

export async function startDiscordAdapter(
  bridge: IMBridge,
  config: DiscordConfig,
): Promise<void> {
  const { botToken } = config
  const allowedUserIds = parseIdSet(config.allowedUserIds)

  const client = new SimpleDiscordClient(botToken)

  // 先测试 API 连接
  console.log('[Discord] Testing connection...')
  const connectionOk = await client.testConnection()
  if (!connectionOk) {
    throw new Error('Discord API connection failed')
  }
  console.log('[Discord] Connection test passed')

  async function handleEvent(data: any) {
    const { t, d } = data

    if (t === 'MESSAGE_CREATE') {
      const message = d as APIMessage & { guild_id?: Snowflake }
      if (message.author?.bot) {
        return
      }

      const userId = message.author?.id
      const channelId = message.channel_id

      // 鉴权
      if (allowedUserIds.size > 0 && userId && !allowedUserIds.has(userId)) {
        await client.sendMessage(channelId, '⛔ 未授权访问。')
        return
      }

      const channelKey = `discord:${channelId}`
      const text = message.content || ''

      // 检查命令
      if (text.trim() === '/clear' || text.trim() === '/new') {
        await bridge.clearSession(channelKey)
        const replyText = text.trim() === '/new' ? '✅ 已创建新对话。' : '✅ 对话历史已清空。'
        await client.sendMessage(channelId, replyText)
        return
      }
      if (text.trim() === '/status') {
        const len = bridge.getSessionLength(channelKey)
        await client.sendMessage(channelId, `📊 当前对话长度：${len} 条消息`)
        return
      }

      // 检查忙闲状态
      if (bridge.isBusy()) {
        await client.sendMessage(channelId, '⏳ 我正在处理上一条请求，请稍等片刻后再发送新消息。')
        return
      }

      // 处理附件
      const imageUrls: string[] = []
      if (message.attachments) {
        for (const att of message.attachments as any[]) {
          if (att.content_type?.startsWith('image/')) {
            imageUrls.push(att.url)
          }
        }
      }

      const content = await buildMessageContent(text, imageUrls).catch((err) => {
        console.error('[Discord] Build message content error:', err)
        return text
      })

      await client.triggerTyping(channelId)

      const streamer = new StreamSender(800)
      let sentMsgId: string | null = null

      try {
        await bridge.handleMessage(channelKey, content, async (chunk) => {
          await streamer.onChunk(
            chunk,
            async (txt) => {
              const safeText = normalizeImText(txt, {
                maxChars: DISCORD_TEXT_MAX_CHARS,
                fallbackText: '（处理中...）',
              })
              const msg = await client.sendMessage(channelId, safeText)
              sentMsgId = msg.id
              return sentMsgId
            },
            async (_id, _txt) => {
              if (sentMsgId) {
                const safeText = normalizeImText(streamer.buffer, {
                  maxChars: DISCORD_TEXT_MAX_CHARS,
                  fallbackText: '（处理中...）',
                })
                await client.editMessage(channelId, sentMsgId, safeText)
                  .catch(err => console.error('[Discord] Edit message error:', err))
              }
            },
          )
        })

        await streamer.flush(
          async (txt) => {
            const safeText = normalizeImText(txt, {
              maxChars: DISCORD_TEXT_MAX_CHARS,
              fallbackText: '（无回复）',
            })
            const msg = await client.sendMessage(channelId, safeText)
            sentMsgId = msg.id
            return sentMsgId
          },
          async (_id, txt) => {
            if (sentMsgId) {
              const safeText = normalizeImText(txt, {
                maxChars: DISCORD_TEXT_MAX_CHARS,
                fallbackText: '（无回复）',
              })
              await client.editMessage(channelId, sentMsgId, safeText)
                .catch(err => console.error('[Discord] Flush update error:', err))
            }
          },
        )
      }
      catch (err) {
        console.error('[Discord] handleMessage error:', err)
        const errMsg = formatError(err)
        if (sentMsgId) {
          await client.editMessage(channelId, sentMsgId, errMsg)
            .catch(e => console.error('[Discord] Error update failed:', e))
        }
        else {
          await client.sendMessage(channelId, errMsg)
        }
      }
    }
  }

  await client.connect(handleEvent)
  console.log('[Discord] Adapter started.')
}

function parseIdSet(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set()
  }
  return new Set(
    raw.split(',')
      .map(s => s.trim())
      .filter(Boolean),
  )
}

function formatError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('401') || msg.includes('Unauthorized')) {
    return '❌ API 认证失败，请检查 BOT_TOKEN。'
  }
  if (msg.includes('429')) {
    return '⏳ API 限流，请稍后重试。'
  }
  return `❌ 出现错误：${msg.slice(0, 300)}`
}
