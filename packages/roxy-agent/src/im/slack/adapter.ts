import type { IMBridge } from '../core/IMBridge.js'
import { App } from '@slack/bolt'
import { buildMessageContent } from '../core/attachments.js'
import { normalizeImText } from '../core/outputGuard.js'
import { proxyFetch } from '../core/proxy.js'
import { StreamSender } from '../core/StreamSender.js'

const SLACK_TEXT_MAX_CHARS = 3500

interface SlackConfig {
  botToken: string
  signingSecret: string
  appToken?: string
  allowedUserIds?: string
  allowedChannelIds?: string
}

export async function startSlackAdapter(
  bridge: IMBridge,
  config: SlackConfig,
): Promise<() => Promise<void>> {
  const { botToken, signingSecret, appToken } = config
  const allowedUserIds = parseIdSet(config.allowedUserIds)
  const allowedChannelIds = parseIdSet(config.allowedChannelIds)

  const app = new App({
    token: botToken,
    signingSecret,
    appToken,
    socketMode: !!appToken,
    clientOptions: {
      /**
       * 用代理包装 fetch
       */
      fetch: async (url: string, init?: RequestInit) => {
        return proxyFetch(url, init)
      },
    },
  })

  // 错误处理
  app.error(async (error) => {
    console.error('[Slack] App error:', error)
  })

  // 监听消息事件
  app.event('app_mention', async ({ event, say, client }) => {
    await handleSlackMessage(event, say, client, bridge, allowedUserIds, allowedChannelIds)
  })

  app.message(async ({ message, say, client }) => {
    if (message.subtype) {
      return // 忽略修改、删除等子类型消息
    }
    await handleSlackMessage(message as any, say, client, bridge, allowedUserIds, allowedChannelIds)
  })

  // 监听斜杠命令
  app.command('/clear', async ({ command, ack, say }) => {
    await ack()
    const channelId = `slack:${command.channel_id}`
    await bridge.clearSession(channelId)
    await say('✅ 对话历史已清空。')
  })

  app.command('/new', async ({ command, ack, say }) => {
    await ack()
    const channelId = `slack:${command.channel_id}`
    await bridge.clearSession(channelId)
    await say('✅ 已创建新对话。')
  })

  app.command('/status', async ({ command, ack, say }) => {
    await ack()
    const channelId = `slack:${command.channel_id}`
    const len = bridge.getSessionLength(channelId)
    await say(`📊 当前对话长度：${len} 条消息`)
  })

  app.command('/script', async ({ command, ack, say, client }) => {
    await ack()
    const channelId = `slack:${command.channel_id}`
    const args = command.text?.trim() ?? ''
    if (!args) {
      await say('❌ 请提供脚本指令。用法：/script <内容>')
      return
    }
    if (bridge.isBusy()) {
      await say('⏳ 我正在处理上一条请求，请稍等片刻后再发送新消息。')
      return
    }
    const streamer = new StreamSender(800)
    let sentTs: string | null = null
    let fullText = ''
    try {
      await bridge.handleMessage(channelId, args, async (chunk) => {
        fullText += chunk
        await streamer.onChunk(
          chunk,
          async (txt) => {
            const safeText = normalizeImText(txt, { maxChars: SLACK_TEXT_MAX_CHARS, fallbackText: '（处理中...）' })
            const result = await client.chat.postMessage({ channel: command.channel_id, text: safeText })
            sentTs = result.ts as string
            return sentTs
          },
          async (_id, _txt) => {
            if (sentTs) {
              const safeText = normalizeImText(streamer.buffer, { maxChars: SLACK_TEXT_MAX_CHARS, fallbackText: '（处理中...）' })
              await client.chat.update({ channel: command.channel_id, ts: sentTs, text: safeText }).catch((e: any) => console.error('[Slack] Update error:', e))
            }
          },
        )
      }, 'script')
      await streamer.flush(
        async (txt) => {
          const safeText = normalizeImText(txt, { maxChars: SLACK_TEXT_MAX_CHARS, fallbackText: '（无回复）' })
          const result = await client.chat.postMessage({ channel: command.channel_id, text: safeText })
          sentTs = result.ts as string
          return sentTs
        },
        async (_id, txt) => {
          if (sentTs) {
            const safeText = normalizeImText(txt, { maxChars: SLACK_TEXT_MAX_CHARS, fallbackText: '（无回复）' })
            await client.chat.update({ channel: command.channel_id, ts: sentTs, text: safeText }).catch((e: any) => console.error('[Slack] Flush update error:', e))
          }
        },
      )
    }
    catch (err) {
      console.error('[Slack] script handleMessage error:', err)
      await say(formatError(err))
    }
  })

  // 启动应用
  await app.start(process.env.PORT || 3001)
  console.log('[Slack] Adapter started.')

  return async () => {
    await (app as any).stop?.()
  }
}

async function handleSlackMessage(
  message: {
    user: string
    channel: string
    text?: string
    thread_ts?: string
    files?: any[]
  },
  say: (text: string) => Promise<any>,
  client: any,
  bridge: IMBridge,
  allowedUserIds: Set<string>,
  allowedChannelIds: Set<string>,
) {
  const userId = message.user
  const channelId = `slack:${message.channel}`

  // 鉴权
  if (allowedUserIds.size > 0 && !allowedUserIds.has(userId)) {
    await say('⛔ 未授权访问。')
    return
  }
  if (allowedChannelIds.size > 0 && !allowedChannelIds.has(message.channel)) {
    await say('⛔ 未授权访问此频道。')
    return
  }

  // 检查命令
  const text = message.text || ''
  if (text.trim() === '/clear' || text.trim() === '/new') {
    await bridge.clearSession(channelId)
    const replyText = text.trim() === '/new' ? '✅ 已创建新对话。' : '✅ 对话历史已清空。'
    await say(replyText)
    return
  }
  if (text.trim() === '/status') {
    const len = bridge.getSessionLength(channelId)
    await say(`📊 当前对话长度：${len} 条消息`)
    return
  }

  // 检查忙闲状态
  if (bridge.isBusy()) {
    await say('⏳ 我正在处理上一条请求，请稍等片刻后再发送新消息。')
    return
  }

  // 处理图片附件
  const imageUrls: string[] = []
  if (message.files) {
    for (const file of message.files) {
      if (file.mimetype?.startsWith('image/')) {
        imageUrls.push(file.url_private)
      }
    }
  }

  // 构建消息内容
  const content = await buildMessageContent(text, imageUrls).catch((err) => {
    console.error('[Slack] Build message content error:', err)
    return text
  })

  const streamer = new StreamSender(800)
  let sentTs: string | null = null
  let fullText = ''

  try {
    await bridge.handleMessage(channelId, content, async (chunk) => {
      fullText += chunk
      await streamer.onChunk(
        chunk,
        async (txt) => {
          const safeText = normalizeImText(txt, {
            maxChars: SLACK_TEXT_MAX_CHARS,
            fallbackText: '（处理中...）',
          })
          const result = await client.chat.postMessage({
            channel: message.channel,
            text: safeText,
            thread_ts: message.thread_ts,
          })
          sentTs = result.ts
          return sentTs
        },
        async (_id, _txt) => {
          if (sentTs) {
            const safeText = normalizeImText(streamer.buffer, {
              maxChars: SLACK_TEXT_MAX_CHARS,
              fallbackText: '（处理中...）',
            })
            await client.chat.update({
              channel: message.channel,
              ts: sentTs,
              text: safeText,
            }).catch((err: any) => console.error('[Slack] Update message error:', err))
          }
        },
      )
    })

    await streamer.flush(
      async (txt) => {
        const safeText = normalizeImText(txt, {
          maxChars: SLACK_TEXT_MAX_CHARS,
          fallbackText: '（无回复）',
        })
        const result = await client.chat.postMessage({
          channel: message.channel,
          text: safeText,
          thread_ts: message.thread_ts,
        })
        sentTs = result.ts
        return sentTs
      },
      async (_id, txt) => {
        if (sentTs) {
          const safeText = normalizeImText(txt, {
            maxChars: SLACK_TEXT_MAX_CHARS,
            fallbackText: '（无回复）',
          })
          await client.chat.update({
            channel: message.channel,
            ts: sentTs,
            text: safeText,
          }).catch((err: any) => console.error('[Slack] Flush update error:', err))
        }
      },
    )
  }
  catch (err) {
    console.error('[Slack] handleMessage error:', err)
    const errMsg = formatError(err)
    if (sentTs) {
      await client.chat.update({
        channel: message.channel,
        ts: sentTs,
        text: errMsg,
      }).catch((e: any) => console.error('[Slack] Error update failed:', e))
    }
    else {
      await say(errMsg)
    }
  }
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
  if (msg.includes('invalid_auth'))
    return '❌ API 认证失败，请检查 BOT_TOKEN 和 SIGNING_SECRET。'
  if (msg.includes('rate_limited'))
    return '⏳ API 限流，请稍后重试。'
  return `❌ 出现错误：${msg.slice(0, 300)}`
}
