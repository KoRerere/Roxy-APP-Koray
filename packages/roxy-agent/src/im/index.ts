import { env } from '../config.js'
import { IMBridge } from './core/IMBridge.js'
import { startFeishuAdapter } from './feishu/adapter.js'
import { startTelegramAdapter } from './telegram/adapter.js'
// import { startDiscordAdapter } from './discord/adapter.js'

let bridgeInstance: IMBridge | null = null

export function getIMBridge(): IMBridge {
  if (!bridgeInstance) {
    bridgeInstance = new IMBridge({
      maxHistory: env.MAX_MESSAGES_BEFORE_SUMMARY,
    })
  }
  return bridgeInstance
}

export async function startIMServiceIfEnabled(): Promise<void> {
  console.log('[IM] startIMServiceIfEnabled called, ENABLE_IM =', env.ENABLE_IM)
  if (!env.ENABLE_IM) {
    console.log('[IM] IM service disabled.')
    return
  }

  const bridge = getIMBridge()
  let started = 0

  console.log('[IM] Checking Feishu config: APP_ID=%s, APP_SECRET=%s, DOMAIN=%s', env.FEISHU_APP_ID, env.FEISHU_APP_SECRET, env.FEISHU_ENVIRONMENT)
  if (env.FEISHU_APP_ID && env.FEISHU_APP_SECRET) {
    console.log('[IM] Starting Feishu adapter...')
    await startFeishuAdapter(bridge, {
      appId: env.FEISHU_APP_ID,
      appSecret: env.FEISHU_APP_SECRET,
      allowedUserIds: env.FEISHU_ALLOWED_USER_IDS || '',
      domain: env.FEISHU_ENVIRONMENT === 'lark' ? 'https://open.larksuite.com' : 'https://open.feishu.cn',
    })
    console.log('[IM] Feishu adapter started.')
    started++
  }
  else {
    console.log('[IM] Feishu adapter skipped: missing APP_ID or APP_SECRET.')
  }

  console.log('[IM] Checking Telegram config: BOT_TOKEN=%s', env.TELEGRAM_BOT_TOKEN ? 'set' : 'unset')
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ALLOWED_CHAT_IDS) {
    await startTelegramAdapter(bridge, {
      botToken: env.TELEGRAM_BOT_TOKEN,
      allowedChatIds: env.TELEGRAM_ALLOWED_CHAT_IDS || '',
    })
    console.log('[IM] Telegram adapter started.')
    started++
  }

  // if (env.DISCORD_BOT_TOKEN) {
  //   await startDiscordAdapter(bridge, {
  //     botToken: env.DISCORD_BOT_TOKEN,
  //     allowedUserIds: env.DISCORD_ALLOWED_USER_IDS || '',
  //     allowedChannelIds: env.DISCORD_ALLOWED_CHANNEL_IDS || '',
  //     allowedGuildIds: env.DISCORD_ALLOWED_GUILD_IDS || '',
  //   })
  //   console.log('[IM] Discord adapter started.')
  //   started++
  // }

  if (started > 0) {
    console.log(`[IM] IM service running with ${started} platform(s).`)
  }
  else {
    console.log('[IM] No IM platforms configured.')
  }
}
