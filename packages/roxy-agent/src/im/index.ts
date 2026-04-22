import { env } from '../config.js'
import { IMBridge } from './core/IMBridge.js'
import { startDiscordAdapter } from './discord/adapter.js'
import { startFeishuAdapter } from './feishu/adapter.js'
import { startSlackAdapter } from './slack/adapter.js'
import { startTelegramAdapter } from './telegram/adapter.js'

export async function startIMServiceIfEnabled(): Promise<void> {
  let started = 0

  async function safeStartAdapter(name: string, imName: string, startFn: () => Promise<void>) {
    try {
      await startFn()
      console.info(`[IM] ${name} adapter started`)
      started++
    }
    catch (err) {
      console.error(`[IM] Failed to start ${name} adapter:`, err)
    }
  }

  if (env.FEISHU_APP_ID && env.FEISHU_APP_SECRET) {
    const feishuBridge = new IMBridge(env.FEISHU_ENVIRONMENT === 'lark' ? 'lark' : 'feishu')
    await safeStartAdapter('Feishu', env.FEISHU_ENVIRONMENT === 'lark' ? 'lark' : 'feishu', () => startFeishuAdapter(feishuBridge, {
      appId: env.FEISHU_APP_ID!,
      appSecret: env.FEISHU_APP_SECRET!,
      allowedUserIds: env.FEISHU_ALLOWED_USER_IDS || '',
      domain: env.FEISHU_ENVIRONMENT === 'lark' ? 'https://open.larksuite.com' : 'https://open.feishu.cn',
    }))
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ALLOWED_CHAT_IDS) {
    const telegramBridge = new IMBridge('telegram')
    await safeStartAdapter('Telegram', 'telegram', () => startTelegramAdapter(telegramBridge, {
      botToken: env.TELEGRAM_BOT_TOKEN!,
      allowedChatIds: env.TELEGRAM_ALLOWED_CHAT_IDS || '',
    }))
  }

  if (env.SLACK_BOT_TOKEN && env.SLACK_SIGNING_SECRET) {
    const slackBridge = new IMBridge('slack')
    await safeStartAdapter('Slack', 'slack', () => startSlackAdapter(slackBridge, {
      botToken: env.SLACK_BOT_TOKEN!,
      signingSecret: env.SLACK_SIGNING_SECRET!,
      appToken: env.SLACK_APP_TOKEN,
      allowedUserIds: env.SLACK_ALLOWED_USER_IDS || '',
      allowedChannelIds: env.SLACK_ALLOWED_CHANNEL_IDS || '',
    }))
  }

  if (env.DISCORD_BOT_TOKEN) {
    const discordBridge = new IMBridge('discord')
    await safeStartAdapter('Discord', 'discord', () => startDiscordAdapter(discordBridge, {
      botToken: env.DISCORD_BOT_TOKEN!,
      allowedUserIds: env.DISCORD_ALLOWED_USER_IDS || '',
    }))
  }

  if (started > 0) {
    console.info(`[IM] IM service running with ${started} platform(s).`)
  }
  else {
    console.warn('[IM] No IM adapters started successfully.')
  }
}
