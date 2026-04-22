import type { ContentBlock, IMBridge } from '../core/IMBridge.js'
import * as lark from '@larksuiteoapi/node-sdk'
import { Buffer } from 'node:buffer'
import { env } from '../../config.js'
import { normalizeImText } from '../core/outputGuard.js'
import { proxyFetch } from '../core/proxy.js'
import { StreamSender } from '../core/StreamSender.js'

/**
 * 支持代理的自定义 HTTP 客户端
 */
class ProxyHttpClient {
  async request(options: any): Promise<any> {
    const headers = new Headers(options.headers)

    const response = await proxyFetch(options.url, {
      method: options.method,
      headers,
      body: options.body,
    })

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    const data = await response.text()

    return {
      status: response.status,
      headers: responseHeaders,
      data,
    }
  }
}

interface FeishuConfig {
  appId: string
  appSecret: string
  allowedUserIds: string
  domain?: string
}

const processedMsgIds = new Map<string, number>()
const DEDUP_TTL_MS = 30_000
const FEISHU_CARD_MAX_CHARS = 3500

function isDuplicate(messageId: string): boolean {
  const now = Date.now()
  // 清理过期条目
  for (const [id, ts] of processedMsgIds) {
    if (now - ts > DEDUP_TTL_MS)
      processedMsgIds.delete(id)
  }
  if (processedMsgIds.has(messageId))
    return true
  processedMsgIds.set(messageId, now)
  return false
}

export async function startFeishuAdapter(
  bridge: IMBridge,
  config: FeishuConfig,
): Promise<void> {
  const { appId, appSecret, domain: rawDomain } = config
  const allowedUserIds = parseList(config.allowedUserIds)

  // 防御性编程：确保 domain 参数有效，过滤掉 "null" 或 "undefined" 字符串
  let domain: string | undefined = rawDomain
  if (domain === 'null' || domain === 'undefined' || domain == null || domain === '') {
    domain = undefined
  }
  const finalDomain = domain ?? 'https://open.feishu.cn'

  const client = new lark.Client({
    appId,
    appSecret,
    domain: finalDomain as any,
    loggerLevel: lark.LoggerLevel.warn,
  })

  // 为所有域名应用代理配置（包括飞书和 Lark）
  ;(client as any).httpclient = new ProxyHttpClient()

  const wsClient = new lark.WSClient({
    appId,
    appSecret,
    domain: finalDomain as any,
  })

  // 为 WSClient 也应用代理（主要用于建立连接前的 API 调用）
  ;(wsClient as any).httpclient = new ProxyHttpClient()

  wsClient.start({
    eventDispatcher: new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: any) => {
        const messageId = data?.message?.message_id
        if (messageId && isDuplicate(messageId)) {
          return
        }
        try {
          await handleFeishuMessage(data, client, bridge, allowedUserIds)
        }
        catch (err) {
          console.error('[Feishu] handleFeishuMessage error:', err)
        }
      },
    }),
  } as any)

  console.log('[Feishu] Adapter started.')
}

async function handleFeishuMessage(
  data: any,
  client: lark.Client,
  bridge: IMBridge,
  allowedUserIds: Set<string>,
) {
  const msg = data.message
  const sender = data.sender
  if (!['text', 'image'].includes(msg.message_type))
    return

  const senderOpenId: string = sender?.sender_id?.open_id ?? ''
  if (allowedUserIds.size > 0 && !allowedUserIds.has(senderOpenId)) {
    await sendText(client, msg.chat_id, '⛔ 未授权访问。')
    return
  }

  const channelId = `fs:${msg.chat_id}`
  const msgContent = JSON.parse(msg.content ?? '{}')
  const text: string = msgContent.text ?? ''

  if (text.trim() === '/clear' || text.trim() === '/new') {
    await bridge.clearSession(channelId)
    const message = text.trim() === '/new' ? '✅ 已创建新对话。' : '✅ 对话历史已清空。'
    await sendText(client, msg.chat_id, message)
    return
  }
  if (text.trim() === '/status') {
    const len = bridge.getSessionLength(channelId)
    await sendText(client, msg.chat_id, `📊 当前对话长度：${len} 条消息`)
    return
  }

  // 单任务互斥：当前已有任务在处理时，拒绝新任务，避免并发执行
  if (bridge.isBusy()) {
    await sendText(
      client,
      msg.chat_id,
      '⏳ 我正在处理上一条请求，请稍等片刻后再发送新消息。',
    )
    return
  }

  const imageBlocks: ContentBlock[] = []
  if (msg.message_type === 'image' && msgContent.image_key) {
    try {
      const block = await downloadFeishuImage(client, msgContent.image_key)
      imageBlocks.push(block)
    }
    catch (e) {
      console.warn('[Feishu] Failed to download image:', e)
    }
  }

  const content: string | ContentBlock[]
    = imageBlocks.length > 0
      ? [...imageBlocks, ...(text ? [{ type: 'text' as const, text }] : [])]
      : text || '（无内容）'

  const cardMsgId = await sendCard(client, msg.chat_id, '⏳ 思考中...')
  const streamer = new StreamSender(800)
  let fullText = ''

  try {
    await bridge.handleMessage(channelId, content, async (chunk) => {
      fullText += chunk
      await streamer.onChunk(
        chunk,
        async () => {
          await updateCard(client, cardMsgId, fullText)
          return cardMsgId
        },
        async () => { await updateCard(client, cardMsgId, fullText) },
      )
    })
    await updateCard(client, cardMsgId, fullText || '（无回复）')
  }
  catch (err) {
    console.error('[Feishu] bridge.handleMessage error:', err)
    await updateCard(client, cardMsgId, formatError(err))
  }
}

async function sendText(client: lark.Client, chatId: string, text: string) {
  await client.im.message.create({
    params: { receive_id_type: 'chat_id' },
    data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text }) },
  })
}

async function sendCard(client: lark.Client, chatId: string, text: string): Promise<string> {
  const safeText = normalizeImText(text, {
    maxChars: FEISHU_CARD_MAX_CHARS,
    fallbackText: '（处理中...）',
  })
  const resp = await client.im.message.create({
    params: { receive_id_type: 'chat_id' },
    data: {
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(buildCard(safeText)),
    },
  })
  return resp.data?.message_id ?? ''
}

async function updateCard(client: lark.Client, messageId: string, text: string) {
  if (!messageId)
    return
  const safeText = normalizeImText(text, {
    maxChars: FEISHU_CARD_MAX_CHARS,
    fallbackText: '（无回复）',
  })
  await client.im.message.patch({
    path: { message_id: messageId },
    data: { content: JSON.stringify(buildCard(safeText)) },
  } as any).catch(() => {})
}

function buildCard(text: string): object {
  return {
    schema: '2.0',
    body: { elements: [{ tag: 'markdown', content: text }] },
  }
}

async function downloadFeishuImage(client: lark.Client, imageKey: string): Promise<ContentBlock> {
  const resp = await (client.im.media as any).download({ path: { file_key: imageKey } })
  const buffer = resp instanceof Buffer
    ? resp
    : await streamToBuffer(resp as NodeJS.ReadableStream)
  return { type: 'image', data: buffer.toString('base64'), mimeType: 'image/jpeg' }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any))
  }
  return Buffer.concat(chunks)
}

function parseList(raw: string): Set<string> {
  if (!raw)
    return new Set()
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean))
}

function formatError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('401'))
    return '❌ API 认证失败，请检查配置。'
  if (msg.includes('529') || msg.includes('overloaded'))
    return '⏳ API 繁忙，请稍后重试。'
  return `❌ 出现错误：${msg.slice(0, 300)}`
}
