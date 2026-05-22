import { API } from '../api'
import { IMBridge } from './core/IMBridge.js'
import { startDiscordAdapter } from './discord/adapter.js'
import { startFeishuAdapter } from './feishu/adapter.js'
import { startSlackAdapter } from './slack/adapter.js'
import { startTelegramAdapter } from './telegram/adapter.js'
import { startWeixinAdapter } from './weixin/adapter.js'

export async function startIMServiceIfEnabled(): Promise<void> {
  let data: any
  try {
    const roxyClawConfig = await API.base.userGetRoxyClawList()
    if (roxyClawConfig.code === 0 && roxyClawConfig.data) {
      data = roxyClawConfig.data
    }
  }
  catch (error) {
    console.error('[mcp] Failed to load RoxyClaw config:', error)
  }

  const enableIM = data?.enabled === 1

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

  const config = {
    ROXY_MODE: enableIM ? 'im' : 'agent',
    ENABLE_IM: enableIM,
    FEISHU_APP_ID: data?.lark_app_id,
    FEISHU_APP_SECRET: data?.lark_app_secret,
    FEISHU_ENVIRONMENT: data?.lark_environment as 'lark' | 'feishu' | undefined,
    FEISHU_ALLOWED_USER_IDS: data?.lark_allowed_chat_ids,
    TELEGRAM_BOT_TOKEN: data?.tg_bot_token,
    TELEGRAM_ALLOWED_CHAT_IDS: data?.tg_allowed_chat_ids,
    SLACK_BOT_TOKEN: data?.slack_bot_token,
    SLACK_SIGNING_SECRET: data?.slack_signing_secret,
    SLACK_APP_TOKEN: data?.slack_app_token,
    SLACK_ALLOWED_USER_IDS: data?.slack_allowed_user_ids,
    SLACK_ALLOWED_CHANNEL_IDS: data?.slack_allowed_channel_ids,
    DISCORD_BOT_TOKEN: data?.discord_bot_token,
    DISCORD_ALLOWED_USER_IDS: data?.discord_allowed_user_ids,
    WECHAT_BOT_TOKEN: data?.wechat_bot_token,
  }

  console.log('im config:', config)

  if (config.FEISHU_APP_ID && config.FEISHU_APP_SECRET) {
    const feishuBridge = new IMBridge(config.FEISHU_ENVIRONMENT === 'lark' ? 'lark' : 'feishu')
    await safeStartAdapter('Feishu', config.FEISHU_ENVIRONMENT === 'lark' ? 'lark' : 'feishu', () => startFeishuAdapter(feishuBridge, {
      appId: config.FEISHU_APP_ID!,
      appSecret: config.FEISHU_APP_SECRET!,
      allowedUserIds: config.FEISHU_ALLOWED_USER_IDS || '',
      domain: config.FEISHU_ENVIRONMENT === 'lark' ? 'https://open.larksuite.com' : 'https://open.feishu.cn',
    }))
  }

  if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_ALLOWED_CHAT_IDS) {
    const telegramBridge = new IMBridge('telegram')
    await safeStartAdapter('Telegram', 'telegram', () => startTelegramAdapter(telegramBridge, {
      botToken: config.TELEGRAM_BOT_TOKEN!,
      allowedChatIds: config.TELEGRAM_ALLOWED_CHAT_IDS || '',
    }))
  }

  if (config.SLACK_BOT_TOKEN && config.SLACK_SIGNING_SECRET) {
    const slackBridge = new IMBridge('slack')
    await safeStartAdapter('Slack', 'slack', () => startSlackAdapter(slackBridge, {
      botToken: config.SLACK_BOT_TOKEN!,
      signingSecret: config.SLACK_SIGNING_SECRET!,
      appToken: config.SLACK_APP_TOKEN,
      allowedUserIds: config.SLACK_ALLOWED_USER_IDS || '',
      allowedChannelIds: config.SLACK_ALLOWED_CHANNEL_IDS || '',
    }))
  }

  if (config.DISCORD_BOT_TOKEN) {
    const discordBridge = new IMBridge('discord')
    await safeStartAdapter('Discord', 'discord', () => startDiscordAdapter(discordBridge, {
      botToken: config.DISCORD_BOT_TOKEN!,
      allowedUserIds: config.DISCORD_ALLOWED_USER_IDS || '',
    }))
  }

  if (config.WECHAT_BOT_TOKEN) {
    const weixinBridge = new IMBridge('weixin')
    await safeStartAdapter('Weixin', 'weixin', () => startWeixinAdapter(weixinBridge, {
      botToken: config.WECHAT_BOT_TOKEN,
    }))
  }

  if (started > 0) {
    console.info(`[IM] IM service running with ${started} platform(s).`)
  }
  else {
    console.warn('[IM] No IM adapters started successfully.')
  }
}
