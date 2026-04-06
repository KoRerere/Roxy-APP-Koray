import type { IMBridge } from '../core/IMBridge.js'
import type { ApiClientOptions } from 'grammy'
import { Bot } from 'grammy'
import { buildMessageContent } from '../core/attachments.js'
import { normalizeImText } from '../core/outputGuard.js'
import { StreamSender } from '../core/StreamSender.js'
// import { createProxyAgent, proxyFetch } from '../core/proxy.js'

/**
 * 自定义 fetch 适配器，确保 grammy 使用代理支持
 */
const customFetchAdapter: ApiClientOptions['fetch'] = async (url, options, _signal) => {
  console.log('[Telegram] Custom fetch adapter called for:', url.replace(/bot[^/]+/, 'bot<TOKEN>'))
  const controller = new AbortController()
  const combinedSignal = _signal
    ? (() => {
        const combined = new AbortController()
        _signal.addEventListener('abort', () => combined.abort())
        return combined
      })()
    : controller.signal

  try {
    const response = await fetch(url, {
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

  console.log('[Telegram] ===== Environment =====')
  console.log('[Telegram] Process ID:', process.pid)
  console.log('[Telegram] Platform:', process.platform)
  console.log('[Telegram] Node version:', process.version)
  console.log('[Telegram] Bot token set:', !!botToken)

  if (allowedChatIds.size === 0) {
    return
  }

  console.log('[Telegram] Creating bot instance...')
  const bot = new Bot(botToken, {
    client: {
      fetch: customFetchAdapter,
    },
  })

  try {
    console.log('[Telegram] Testing bot connectivity...')

    // 创建一个超时机制
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), 30000),
    )

    const botInfoPromise = bot.api.getMe()
    const botInfo = await Promise.race([botInfoPromise, timeoutPromise])

    console.log('[Telegram] Bot info:', JSON.stringify(botInfo, null, 2))
    console.log('[Telegram] Bot connectivity test PASSED!')
  }
  catch (err) {
    console.error('[Telegram] Bot connectivity test FAILED!')
    console.error('[Telegram] Error message:', err)
  }

  console.log('')

  // 添加全局错误处理
  bot.catch((err) => {
    console.error('[Telegram] Bot error:', err)
  })

  // 最原始的更新监听器（在任何中间件之前）
  // 这样我们能看到任何传入的 Telegram 更新，不管鉴权是否通过
  bot.use(async (ctx, next) => {
    console.log('[Telegram] ===== RAW UPDATE RECEIVED =====')
    console.log('[Telegram] Update ID:', ctx.update.update_id)
    console.log('[Telegram] Update type:', Object.keys(ctx.update).filter(k => k !== 'update_id')[0])
    console.log('[Telegram] Full update:', JSON.stringify(ctx.update, null, 2))
    await next()
  })

  // 鉴权中间件
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id
    console.log('[Telegram] ===== Received update from chatId:', chatId, '=====')

    if (!chatId) {
      console.log('[Telegram] No chatId in update, skipping')
      return
    }

    console.log('[Telegram] Chat ID received:', chatId)
    console.log('[Telegram] Allowed chat IDs:', allowedChatIds.size > 0 ? Array.from(allowedChatIds) : 'UNRESTRICTED (allow all)')

    // 鉴权逻辑：
    // - 如果没有配置白名单（allowedChatIds.size === 0）：允许所有
    // - 如果配置了白名单：只允许白名单内的
    const isWhiteListEnabled = allowedChatIds.size > 0
    const isChatIdAllowed = allowedChatIds.has(chatId)

    if (isWhiteListEnabled && !isChatIdAllowed) {
      console.log('[Telegram] Unauthorized chatId:', chatId, 'Allowed:', Array.from(allowedChatIds))
      await ctx.reply(`⛔ 未授权访问。你的 Chat ID 是: ${chatId}`).catch(err => console.error('[Telegram] Reply error:', err))
      return
    }

    console.log('[Telegram] ChatId authorized:', chatId, '(Whitelist:', isWhiteListEnabled ? 'enabled' : 'disabled', ')')
    await next()
  })

  bot.command('start', async (ctx) => {
    console.log('[Telegram] Received /start command from chatId:', ctx.chat?.id)
    await ctx.reply('👋 你好！直接发消息开始对话。\n/new — 新开对话\n/clear — 清空历史\n/status — 查看状态').catch(err => console.error('[Telegram] Reply error:', err))
  })

  bot.command('clear', async (ctx) => {
    console.log('[Telegram] Received /clear command from chatId:', ctx.chat?.id)
    await bridge.clearSession(`tg:${ctx.chat.id}`)
    await ctx.reply('✅ 对话历史已清空。').catch(err => console.error('[Telegram] Reply error:', err))
  })

  bot.command('new', async (ctx) => {
    console.log('[Telegram] Received /new command from chatId:', ctx.chat?.id)
    await bridge.clearSession(`tg:${ctx.chat.id}`)
    await ctx.reply('✅ 已创建新对话。').catch(err => console.error('[Telegram] Reply error:', err))
  })

  bot.command('status', async (ctx) => {
    console.log('[Telegram] Received /status command from chatId:', ctx.chat?.id)
    const len = bridge.getSessionLength(`tg:${ctx.chat.id}`)
    await ctx.reply(`📊 当前对话长度：${len} 条消息`).catch(err => console.error('[Telegram] Reply error:', err))
  })

  bot.on('message', async (ctx) => {
    console.log('[Telegram] ===== Received message event =====')
    console.log('[Telegram] Received message update:', JSON.stringify(ctx.update, null, 2))

    const channelId = `tg:${ctx.chat.id}`
    const text = ctx.message.text ?? ctx.message.caption ?? ''
    const messageId = ctx.message.message_id

    console.log('[Telegram] Message details:')
    console.log('  - channelId:', channelId)
    console.log('  - messageId:', messageId)
    console.log('  - text length:', text?.length || 0)
    console.log('  - has photo:', !!ctx.message.photo)
    console.log('  - has caption:', !!ctx.message.caption)
    console.log('[Telegram] Message text:', text)

    const imageUrls: string[] = []
    if (ctx.message.photo) {
      console.log('[Telegram] Processing photo attachment...')
      const largest = ctx.message.photo.at(-1)!
      console.log('[Telegram] Photo sizes available:', ctx.message.photo.length, 'using largest:', largest.file_size, 'bytes')

      const file = await ctx.api.getFile(largest.file_id)
      console.log('[Telegram] Got file info:', { fileId: largest.file_id, filePath: file.file_path })

      if (file.file_path) {
        const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`
        imageUrls.push(url)
        console.log('[Telegram] Image URL constructed:', url)
      }
      else {
        console.warn('[Telegram] No file_path in file response, skipping image')
      }
    }

    console.log('[Telegram] Building message content with', imageUrls.length, 'images')
    const content = await buildMessageContent(text, imageUrls).catch((err) => {
      console.error('[Telegram] Build message content error:', err)
      return text
    })
    console.log('[Telegram] Final content type:', Array.isArray(content) ? 'ContentBlock[]' : 'string')

    console.log('[Telegram] Sending "typing" chat action...')
    await ctx.replyWithChatAction('typing').catch(err => console.error('[Telegram] Chat action error:', err))

    console.log('[Telegram] Initializing StreamSender with 500ms throttle')
    const streamer = new StreamSender(500)
    let sentMsgId: number | null = null
    let totalChars = 0
    let chunkCount = 0

    try {
      console.log('[Telegram] Calling bridge.handleMessage...')
      await bridge.handleMessage(channelId, content, async (chunk) => {
        totalChars += chunk.length
        chunkCount++
        console.log(`[Telegram] Received chunk #${chunkCount}: ${chunk.length} chars, total: ${totalChars} chars`)

        await streamer.onChunk(
          chunk,
          async (txt) => {
            const safeText = normalizeImText(txt, {
              maxChars: TELEGRAM_TEXT_MAX_CHARS,
              fallbackText: '（处理中...）',
            })
            console.log('[Telegram] Sending new message with normalized text length:', safeText.length)
            const m = await ctx.reply(safeText)
            sentMsgId = m.message_id
            console.log('[Telegram] Message sent, msgId:', sentMsgId)
            return String(m.message_id)
          },
          async (_id, _txt) => {
            if (sentMsgId) {
              const safeText = normalizeImText(streamer.buffer, {
                maxChars: TELEGRAM_TEXT_MAX_CHARS,
                fallbackText: '（处理中...）',
              })
              console.log('[Telegram] Editing message (msgId:', sentMsgId, ') with buffer length:', safeText.length)
              await ctx.api
                .editMessageText(ctx.chat.id, sentMsgId, safeText)
                .catch(err => console.error('[Telegram] Edit message error:', err))
            }
            else {
              console.log('[Telegram] No sentMsgId to edit')
            }
          },
        )
      })

      console.log('[Telegram] Message handling complete, flushing final buffer')
      await streamer.flush(
        async (txt) => {
          const safeText = normalizeImText(txt, {
            maxChars: TELEGRAM_TEXT_MAX_CHARS,
            fallbackText: '（无回复）',
          })
          console.log('[Telegram] Flushing final new message, length:', safeText.length)
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
            console.log('[Telegram] Flushing edit to msgId:', sentMsgId, ', length:', safeText.length)
            await ctx.api.editMessageText(ctx.chat.id, sentMsgId, safeText).catch(err => console.error('[Telegram] Edit message error:', err))
          }
        },
      )

      console.log('[Telegram] ===== Message processing completed successfully =====')
      console.log('[Telegram] Statistics:')
      console.log('  - Total chars received:', totalChars)
      console.log('  - Chunk count:', chunkCount)
      console.log('  - Final buffer length:', streamer.buffer.length)
    }
    catch (err) {
      console.error('[Telegram] ===== Bridge handle message failed =====')
      console.error('[Telegram] Full error stack:', err)
      const errMsg = formatError(err)
      if (sentMsgId) {
        console.log('[Telegram] Editing message with error:', errMsg)
        await ctx.api.editMessageText(ctx.chat.id, sentMsgId, errMsg).catch(err => console.error('[Telegram] Edit message error:', err))
      }
      else {
        console.log('[Telegram] Sending new error message:', errMsg)
        await ctx.reply(errMsg).catch(err => console.error('[Telegram] Reply error:', err))
      }
    }
  })

  console.log('[Telegram] Starting bot...')
  bot.start({
    onStart: info => console.log(`[Telegram] @${info.username} running`),
    onError: err => console.error('[Telegram] Bot start error:', err),
  })

  console.log('[Telegram] Bot started successfully')
}

/**
 * 解析配置的 Chat ID 白名单
 * @param raw - 原始配置字符串，格式如 "123456,-789012"
 * @returns Set<number> - 解析后的 Chat ID 集合
 *
 * 白名单规则：
 * - 如果传入空字符串或 undefined：返回空 Set（表示允许所有访问）
 * - 如果传入逗号分隔的字符串：返回包含这些 ID 的 Set（表示只允许这些 ID 访问）
 */
function parseIdSet(raw: string | undefined): Set<number> {
  if (!raw) {
    // 没有配置白名单，返回空 Set 表示允许所有访问
    return new Set()
  }
  // 有配置白名单，只允许白名单内的 Chat ID 访问
  return new Set(
    raw.split(',')
      .map(s => Number.parseInt(s.trim()))
      .filter(n => !isNaN(n)),
  )
}

function formatError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  console.log('[Telegram] Formatting error for user:', msg)
  if (msg.includes('401'))
    return '❌ API 认证失败，请检查配置。'
  if (msg.includes('529') || msg.includes('overloaded'))
    return '⏳ API 繁忙，请稍后重试。'
  const userMsg = `❌ 出现错误：${msg.slice(0, 200)}`
  console.log('[Telegram] Returning error message to user:', userMsg)
  return userMsg
}
