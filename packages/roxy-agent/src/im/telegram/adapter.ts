import type { IMBridge } from '../core/IMBridge.js'
import type { ApiClientOptions } from 'grammy'
import { Bot } from 'grammy'
import { env } from '../../config.js'
import { buildMessageContent } from '../core/attachments.js'
import { normalizeImText } from '../core/outputGuard.js'
import { proxyFetch } from '../core/proxy.js'
import { StreamSender } from '../core/StreamSender.js'

/**
 * 自定义 fetch 适配器，确保 grammy 使用代理支持
 */
const customFetchAdapter: ApiClientOptions['fetch'] = async (url, options, _signal) => {
  const controller = new AbortController()
  const combinedSignal = _signal
    ? (() => {
        const combined = new AbortController()
        _signal.addEventListener('abort', () => combined.abort())
        return combined
      })()
    : controller.signal

  try {
    const response = await proxyFetch(url, {
      ...options,
      signal: combinedSignal,
    })
    return response
  }
  catch (err) {
    console.error('[Telegram] Fetch error:', err)
    throw err
  }
}

const TELEGRAM_TEXT_MAX_CHARS = 3500

interface TelegramConfig {
  botToken: string
  /**
   * 可选参数
   */
  allowedChatIds?: string
}

export async function startTelegramAdapter(
  bridge: IMBridge,
  config: TelegramConfig,
): Promise<void> {
  const { botToken } = config
  const allowedChatIds = parseIdSet(config.allowedChatIds)

  if (allowedChatIds.size === 0) {
    return
  }

  const bot = new Bot(botToken, {
    client: {
      fetch: customFetchAdapter,
    },
  })

  try {
    // 创建一个超时机制
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), 30000),
    )

    const botInfoPromise = bot.api.getMe()
    const botInfo = await Promise.race([botInfoPromise, timeoutPromise])

    if (env.DEBUG) {
      console.debug('[Telegram] Bot info:', JSON.stringify(botInfo, null, 2))
    }
    console.log('[Telegram] Bot connectivity test PASSED!')
  }
  catch (err) {
    console.error('[Telegram] Bot connectivity test FAILED!')
    console.error('[Telegram] Error message:', err)
  }

  // 添加全局错误处理
  bot.catch((err) => {
    console.error('[Telegram] Bot error:', err)
  })

  // 鉴权中间件
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id

    if (!chatId) {
      return
    }

    // 鉴权逻辑
    const isWhiteListEnabled = allowedChatIds.size > 0
    const isChatIdAllowed = allowedChatIds.has(chatId)

    if (isWhiteListEnabled && !isChatIdAllowed) {
      console.warn('[Telegram] Unauthorized chatId:', chatId)
      await ctx.reply(`⛔ 未授权访问。你的 Chat ID 是: ${chatId}`).catch(err => console.error('[Telegram] Reply error:', err))
      return
    }

    await next()
  })

  bot.command('start', async (ctx) => {
    await ctx.reply('👋 你好！直接发消息开始对话。\n/new — 新开对话\n/clear — 清空历史\n/status — 查看状态').catch(err => console.error('[Telegram] Reply error:', err))
  })

  bot.command('clear', async (ctx) => {
    await bridge.clearSession(`tg:${ctx.chat.id}`)
    await ctx.reply('✅ 对话历史已清空。').catch(err => console.error('[Telegram] Reply error:', err))
  })

  bot.command('new', async (ctx) => {
    await bridge.clearSession(`tg:${ctx.chat.id}`)
    await ctx.reply('✅ 已创建新对话。').catch(err => console.error('[Telegram] Reply error:', err))
  })

  bot.command('status', async (ctx) => {
    const len = bridge.getSessionLength(`tg:${ctx.chat.id}`)
    await ctx.reply(`📊 当前对话长度：${len} 条消息`).catch(err => console.error('[Telegram] Reply error:', err))
  })

  bot.on('message', async (ctx) => {
    const channelId = `tg:${ctx.chat.id}`
    const text = ctx.message.text ?? ctx.message.caption ?? ''
    const messageId = ctx.message.message_id

    const imageUrls: string[] = []
    if (ctx.message.photo) {
      const largest = ctx.message.photo.at(-1)!
      const file = await ctx.api.getFile(largest.file_id)
      if (file.file_path) {
        const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`
        imageUrls.push(url)
      }
    }

    const content = await buildMessageContent(text, imageUrls).catch((err) => {
      console.error('[Telegram] Build message content error:', err)
      return text
    })

    await ctx.replyWithChatAction('typing').catch(err => console.error('[Telegram] Chat action error:', err))

    const streamer = new StreamSender(500)
    let sentMsgId: number | null = null

    try {
      await bridge.handleMessage(channelId, content, async (chunk) => {
        await streamer.onChunk(
          chunk,
          async (txt) => {
            const safeText = normalizeImText(txt, {
              maxChars: TELEGRAM_TEXT_MAX_CHARS,
              fallbackText: '（处理中...）',
            })
            const m = await ctx.reply(safeText)
            sentMsgId = m.message_id
            return String(m.message_id)
          },
          async (_id, _txt) => {
            if (sentMsgId) {
              const safeText = normalizeImText(streamer.buffer, {
                maxChars: TELEGRAM_TEXT_MAX_CHARS,
                fallbackText: '（处理中...）',
              })
              await ctx.api
                .editMessageText(ctx.chat.id, sentMsgId, safeText)
                .catch(err => console.error('[Telegram] Edit message error:', err))
            }
          },
        )
      })

      await streamer.flush(
        async (txt) => {
          const safeText = normalizeImText(txt, {
            maxChars: TELEGRAM_TEXT_MAX_CHARS,
            fallbackText: '（无回复）',
          })
          const m = await ctx.reply(safeText)
          sentMsgId = m.message_id
          return String(m.message_id)
        },
        async (_id, txt) => {
          if (sentMsgId) {
            const safeText = normalizeImText(txt, {
              maxChars: TELEGRAM_TEXT_MAX_CHARS,
              fallbackText: '（无回复）',
            })
            await ctx.api.editMessageText(ctx.chat.id, sentMsgId, safeText).catch(err => console.error('[Telegram] Edit message error:', err))
          }
        },
      )
    }
    catch (err) {
      console.error('[Telegram] Bridge handle message failed:', err)
      const errMsg = formatError(err)
      if (sentMsgId) {
        await ctx.api.editMessageText(ctx.chat.id, sentMsgId, errMsg).catch(err => console.error('[Telegram] Edit message error:', err))
      }
      else {
        await ctx.reply(errMsg).catch(err => console.error('[Telegram] Reply error:', err))
      }
    }
  })

  bot.start({
    onStart: info => console.log(`[Telegram] @${info.username} running`),
  })

  console.log('[Telegram] Adapter started successfully')
}

/**
 * 解析配置的 Chat ID 白名单
 */
function parseIdSet(raw: string | undefined): Set<number> {
  if (!raw) {
    return new Set()
  }
  return new Set(
    raw.split(',')
      .map(s => Number.parseInt(s.trim()))
      .filter(n => !Number.isNaN(n)),
  )
}

function formatError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('401'))
    return '❌ API 认证失败，请检查配置。'
  if (msg.includes('529') || msg.includes('overloaded'))
    return '⏳ API 繁忙，请稍后重试。'
  const userMsg = `❌ 出现错误：${msg.slice(0, 200)}`
  return userMsg
}
