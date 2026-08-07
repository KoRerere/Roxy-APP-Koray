import type { IMBridge } from '../core/IMBridge.js'
import { Buffer } from 'node:buffer'
import { randomInt, randomUUID } from 'node:crypto'
import { normalizeImText } from '../core/outputGuard.js'

const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com'
const CHANNEL_VERSION = '1.0.2'
const ILINK_APP_ID = 'bot'
const ILINK_APP_CLIENT_VERSION = buildClientVersion(CHANNEL_VERSION)
const RETRY_INTERVAL_MS = 3000
const REPLY_MAX_CHARS = 2000
const TYPING_KEEPALIVE_INTERVAL_MS = 5000
const TYPING_STATUS_TYPING = 1
const TYPING_STATUS_CANCEL = 2

interface WeixinConfig {
  botToken?: string
  baseUrl?: string
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

interface GetConfigResponse {
  ret?: number
  typing_ticket?: string
}

interface ApiErrorResponse {
  ret?: number
  errmsg?: string
  msg?: string
}

export async function startWeixinAdapter(
  bridge: IMBridge,
  config: WeixinConfig,
): Promise<() => void> {
  if (!config.botToken) {
    throw new Error('Weixin bot token is required. Configure it from the frontend before starting IM mode.')
  }

  const adapter = new WeixinAdapter(bridge, config)
  adapter.start()
  console.log('[Weixin] Adapter started.')

  return () => {
    adapter.stop()
  }
}

class WeixinAdapter {
  private readonly bridge: IMBridge
  private readonly botToken: string
  private readonly baseUrl: string
  private readonly typingTickets = new Map<string, string>()
  private getUpdatesBuf = ''
  private stopped = false

  constructor(bridge: IMBridge, config: WeixinConfig) {
    this.bridge = bridge
    this.botToken = config.botToken!
    this.baseUrl = normalizeBaseUrl(config.baseUrl)
  }

  start(): void {
    void this.runLoop()
  }

  stop(): void {
    this.stopped = true
  }

  private async runLoop(): Promise<void> {
    while (!this.stopped) {
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
    while (!this.stopped) {
      const previousCursor = this.getUpdatesBuf

      const response = await this.apiPost<GetUpdatesResponse>('ilink/bot/getupdates', {
        get_updates_buf: previousCursor,
        base_info: buildBaseInfo(),
      })

      const messages = Array.isArray(response.msgs) ? response.msgs : []
      const responseCursor = response.get_updates_buf || ''

      for (const message of messages) {
        await this.handleInboundMessage(message)
      }

      // Always update cursor if server returns a non-empty one
      if (responseCursor && responseCursor.length > 0) {
        this.getUpdatesBuf = responseCursor
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

    const scriptMatch = trimmedText.match(/^\/script\s+(\S[\s\S]*)$/i)
    if (scriptMatch) {
      const typing = await this.startTypingIndicator(fromUserId, contextToken)
      try {
        const reply = await this.bridge.handleMessage(channelId, scriptMatch[1].trim(), undefined)
        await this.sendText(fromUserId, reply, contextToken)
      }
      catch (err) {
        console.error('[Weixin] script handleMessage error:', err)
        await this.sendText(fromUserId, formatError(err), contextToken)
      }
      finally {
        await typing.stop()
      }
      return
    }

    const typing = await this.startTypingIndicator(fromUserId, contextToken)
    try {
      const reply = await this.bridge.handleMessage(channelId, trimmedText)
      await this.sendText(fromUserId, reply, contextToken)
    }
    catch (err) {
      console.error('[Weixin] handleMessage error:', err)
      await this.sendText(fromUserId, formatError(err), contextToken)
    }
    finally {
      await typing.stop()
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
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
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
    else if (endpoint === 'ilink/bot/sendtyping') {
      console.debug('[Weixin] sendtyping accepted by server')
    }
    return data
  }

  private async startTypingIndicator(toUserId: string, contextToken: string): Promise<{ stop: () => Promise<void> }> {
    let stopped = false
    let active = false
    let timer: ReturnType<typeof setInterval> | undefined

    const send = async (status: number): Promise<boolean> => {
      try {
        return await this.sendTyping(toUserId, contextToken, status)
      }
      catch (err) {
        const action = status === TYPING_STATUS_CANCEL ? 'cancel' : 'send'
        console.warn(`[Weixin] typing ${action} failed:`, err)
        return false
      }
    }

    active = await send(TYPING_STATUS_TYPING)

    if (active && !stopped) {
      timer = setInterval(() => {
        void send(TYPING_STATUS_TYPING).then((ok) => {
          if (!ok && timer) {
            active = false
            clearInterval(timer)
            timer = undefined
          }
        })
      }, TYPING_KEEPALIVE_INTERVAL_MS)
    }

    return {
      stop: async () => {
        if (stopped) {
          return
        }
        stopped = true
        if (timer) {
          clearInterval(timer)
        }
        if (active) {
          await send(TYPING_STATUS_CANCEL)
        }
      },
    }
  }

  private async sendTyping(toUserId: string, contextToken: string, status: number): Promise<boolean> {
    const typingTicket = await this.getTypingTicket(toUserId, contextToken)
    if (!typingTicket) {
      console.debug(`[Weixin] typing ticket is empty for user=${toUserId}`)
      return false
    }

    try {
      await this.apiPost('ilink/bot/sendtyping', {
        ilink_user_id: toUserId,
        typing_ticket: typingTicket,
        status,
        base_info: buildBaseInfo(),
      })
    }
    catch (err) {
      this.typingTickets.delete(toUserId)
      throw err
    }
    return true
  }

  private async getTypingTicket(toUserId: string, contextToken: string): Promise<string> {
    const cached = this.typingTickets.get(toUserId)
    if (cached) {
      return cached
    }

    const response = await this.apiPost<GetConfigResponse>('ilink/bot/getconfig', {
      ilink_user_id: toUserId,
      context_token: contextToken,
      base_info: buildBaseInfo(),
    })
    const ticket = response.typing_ticket?.trim() || ''
    if (ticket) {
      this.typingTickets.set(toUserId, ticket)
    }
    return ticket
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

function normalizeBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
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
