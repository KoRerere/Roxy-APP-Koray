import type { IMBridge } from '../core/IMBridge.js'
import { Buffer } from 'node:buffer'
import { randomInt, randomUUID } from 'node:crypto'
import { normalizeImText } from '../core/outputGuard.js'
import { proxyFetch } from '../core/proxy.js'

const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com'
const CHANNEL_VERSION = '1.0.2'
const ILINK_APP_ID = 'bot'
const ILINK_APP_CLIENT_VERSION = buildClientVersion(CHANNEL_VERSION)
const RETRY_INTERVAL_MS = 3000
const REPLY_MAX_CHARS = 2000

interface WeixinConfig {
  botToken?: string
}

interface WeixinTextItem {
  text?: string
}

interface WeixinMessageItem {
  type?: number
  text_item?: WeixinTextItem
}

interface WeixinMessage {
  from_user_id?: string
  client_id?: string
  to_user_id?: string
  group_id?: string
  message_type?: number
  message_state?: number
  context_token?: string
  item_list?: WeixinMessageItem[]
  msg_id?: string
}

interface GetUpdatesResponse {
  ret?: number
  msgs?: WeixinMessage[]
  get_updates_buf?: string
}

interface ApiErrorResponse {
  ret?: number
  errmsg?: string
  msg?: string
}

export async function startWeixinAdapter(
  bridge: IMBridge,
  config: WeixinConfig,
): Promise<void> {
  if (!config.botToken) {
    throw new Error('Weixin bot token is required. Configure it from the frontend before starting IM mode.')
  }

  const adapter = new WeixinAdapter(bridge, config)
  adapter.start()
  console.log('[Weixin] Adapter started.')
}

class WeixinAdapter {
  private readonly bridge: IMBridge
  private readonly botToken: string
  private emptyPollCount = 0
  private getUpdatesBuf = ''

  constructor(bridge: IMBridge, config: WeixinConfig) {
    this.bridge = bridge
    this.botToken = config.botToken!
  }

  start(): void {
    void this.runLoop()
  }

  private async runLoop(): Promise<void> {
    while (true) {
      try {
        // Don't reset cursor here - keep it across retries
        await this.pollUpdatesLoop()
      }
      catch (err) {
        console.error('[Weixin] Main loop error:', err)
        console.info(`[Weixin] Retrying in ${RETRY_INTERVAL_MS}ms, current cursor: ${truncateForLog(this.getUpdatesBuf, 60)}`)
        await sleep(RETRY_INTERVAL_MS)
      }
    }
  }

  private async pollUpdatesLoop(): Promise<void> {
    while (true) {
      const previousCursor = this.getUpdatesBuf
      console.debug(`[Weixin] getupdates request with cursor: ${truncateForLog(previousCursor, 60)}`)

      const response = await this.apiPost<GetUpdatesResponse>('ilink/bot/getupdates', {
        get_updates_buf: previousCursor,
        base_info: buildBaseInfo(),
      })

      const messages = Array.isArray(response.msgs) ? response.msgs : []
      const responseCursor = response.get_updates_buf || ''

      console.debug(`[Weixin] getupdates response: msgs=${messages.length}, cursor=${truncateForLog(responseCursor, 60)}`)

      if (messages.length > 0) {
        this.emptyPollCount = 0
        console.info(`[Weixin] getupdates returned ${messages.length} message(s)`)
      }
      else {
        this.emptyPollCount++
        if (this.emptyPollCount % 20 === 0) {
          console.info('[Weixin] getupdates heartbeat: no new messages')
        }
      }

      for (const message of messages) {
        await this.handleInboundMessage(message)
      }

      // Always update cursor if server returns a non-empty one
      if (responseCursor && responseCursor.length > 0) {
        this.getUpdatesBuf = responseCursor
        console.debug(`[Weixin] cursor updated to: ${truncateForLog(responseCursor, 60)}`)
      }
    }
  }

  private async handleInboundMessage(message: WeixinMessage): Promise<void> {
    // Filter: skip group messages and non-text messages
    if (message.message_type !== 1 || message.group_id) {
      console.debug(`[Weixin] skipping message: type=${message.message_type}, group=${message.group_id}`)
      return
    }

    const fromUserId = message.from_user_id
    const contextToken = message.context_token
    const text = extractText(message.item_list)

    console.info(
      `[Weixin] inbound message: from=${fromUserId ?? '-'} msgId=${message.msg_id ?? '-'} type=${message.message_type} context=${truncateForLog(contextToken)} text=${truncateForLog(text)}`,
    )

    if (!fromUserId || !contextToken || !text) {
      return
    }

    const trimmedText = text.trim()
    const channelId = `wx:${fromUserId}`

    if (trimmedText === '/clear' || trimmedText === '/new') {
      await this.bridge.clearSession(channelId)
      await this.sendText(
        fromUserId,
        trimmedText === '/new' ? 'Started a new conversation.' : 'Conversation history cleared.',
        contextToken,
      )
      return
    }

    if (trimmedText === '/status') {
      const len = this.bridge.getSessionLength(channelId)
      await this.sendText(fromUserId, `Current conversation length: ${len} messages`, contextToken)
      return
    }

    if (this.bridge.isBusy()) {
      await this.sendText(fromUserId, 'I am still processing the previous request. Please try again shortly.', contextToken)
      return
    }

    try {
      const reply = await this.bridge.handleMessage(channelId, trimmedText)
      await this.sendText(fromUserId, reply, contextToken)
    }
    catch (err) {
      console.error('[Weixin] handleMessage error:', err)
      await this.sendText(fromUserId, formatError(err), contextToken)
    }
  }

  private async sendText(toUserId: string, text: string, contextToken: string): Promise<void> {
    const normalized = normalizeImText(toPlainWeixinText(text), {
      maxChars: REPLY_MAX_CHARS,
      fallbackText: '(no reply)',
    })

    for (const chunk of splitMessage(normalized, REPLY_MAX_CHARS)) {
      const clientId = buildClientId()
      console.debug(`[Weixin] sending message: to=${toUserId} context=${truncateForLog(contextToken)} text=${truncateForLog(chunk)}`)
      await this.apiPost('ilink/bot/sendmessage', {
        msg: {
          from_user_id: '',
          to_user_id: toUserId,
          client_id: clientId,
          message_type: 2,
          message_state: 2,
          context_token: contextToken,
          item_list: [
            {
              type: 1,
              text_item: {
                text: chunk,
              },
            },
          ],
        },
        base_info: buildBaseInfo(),
      })
    }
  }

  private async apiPost<T>(endpoint: string, body: unknown): Promise<T> {
    const payload = JSON.stringify(body)
    const response = await proxyFetch(`${DEFAULT_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AuthorizationType': 'ilink_bot_token',
        'iLink-App-Id': ILINK_APP_ID,
        'iLink-App-ClientVersion': String(ILINK_APP_CLIENT_VERSION),
        'X-WECHAT-UIN': randomWechatUin(),
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Length': String(Buffer.byteLength(payload, 'utf-8')),
      },
      body: payload,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Weixin API error: ${response.status} ${text}`)
    }

    const data = await response.json() as T & ApiErrorResponse
    if (typeof data.ret === 'number' && data.ret !== 0) {
      const message = data.errmsg || data.msg || 'unknown error'
      throw new Error(`Weixin API returned ret=${data.ret}: ${message}`)
    }
    if (endpoint === 'ilink/bot/sendmessage') {
      console.info('[Weixin] sendmessage accepted by server')
    }
    return data
  }
}

function extractText(items: WeixinMessageItem[] | undefined): string {
  if (!Array.isArray(items)) {
    return ''
  }

  return items
    .filter(item => item.type === 1)
    .map(item => item.text_item?.text || '')
    .join('\n')
    .trim()
}

function splitMessage(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text]
  }

  const chunks: string[] = []
  let remaining = text
  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf('\n', maxChars)
    if (splitAt <= 0) {
      splitAt = maxChars
    }
    chunks.push(remaining.slice(0, splitAt).trim())
    remaining = remaining.slice(splitAt).trim()
  }

  if (remaining) {
    chunks.push(remaining)
  }

  return chunks.filter(Boolean)
}

function toPlainWeixinText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
}

function randomWechatUin(): string {
  return Buffer.from(String(randomInt(0, 2 ** 32 - 1))).toString('base64')
}

function buildBaseInfo(): { channel_version: string } {
  return {
    channel_version: CHANNEL_VERSION,
  }
}

function buildClientVersion(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(part => Number.parseInt(part, 10) || 0)
  return ((major & 0xFF) << 16) | ((minor & 0xFF) << 8) | (patch & 0xFF)
}

function buildClientId(): string {
  return `roxy-weixin-${randomUUID()}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('401') || message.includes('403')) {
    return 'Weixin Bot authentication failed. Please reconnect the bot from settings.'
  }
  if (message.includes('529') || message.includes('overloaded')) {
    return 'The model service is busy. Please try again later.'
  }
  return `Failed to process the message: ${message.slice(0, 200)}`
}

function truncateForLog(value: string | undefined, maxChars = 80): string {
  if (!value) {
    return '-'
  }
  if (value.length <= maxChars) {
    return value
  }
  return `${value.slice(0, maxChars)}...`
}
