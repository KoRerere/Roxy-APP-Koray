import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw } from 'vue'
import { debounce } from 'es-toolkit'
import type { UserGetRoxyClawListData, UserSetRoxyClawCreatePayload } from '@roxy/backend-api'
import type { McpFailureType } from '@roxy/electron-preload'
import { API } from '/@/api'
import { replaceToRoute } from '/@/router/navigation'

/**
 * 获取 MCP 错误的 i18n 消息
 */
export function getMcpErrorMessage(type: McpFailureType): string {
  const messageMap: Record<McpFailureType, string> = {
    roxyclaw_already_running: $t('RoxyClaw 正在运行中，请先停止 RoxyClaw'),
    mcp_window_already_open: $t('Roxy AI Agent 正在运行中，请先关闭 Roxy AI Agent 窗口'),
    script_repair_failed: $t('Roxy AI Agent 文件修复失败，请重启应用后重试'),
    unknown_error: $t('服务异常，请稍后重试'),
  }

  return messageMap[type] || messageMap.unknown_error
}

// RoxyClaw 配置接口
export interface RoxyClawConfig {
  enabled: boolean
  tg_bot_token: string
  tg_allowed_chat_ids: string[]
  lark_app_id: string
  lark_app_secret: string
  lark_allowed_chat_ids: string[]
  lark_environment: 'lark' | 'feishu'
  slack_bot_token: string
  slack_signing_secret: string
  slack_app_token: string
  slack_allowed_user_ids: string[]
  slack_allowed_channel_ids: string[]
  discord_bot_token: string
  discord_allowed_user_ids: string[]
  wechat_bot_token: string
}

export interface UpdateConfigResult {
  success: boolean
  config: RoxyClawConfig
  message?: string
}

// 默认配置
const defaultConfig: RoxyClawConfig = {
  enabled: false,
  tg_bot_token: '',
  tg_allowed_chat_ids: [],
  lark_app_id: '',
  lark_app_secret: '',
  lark_allowed_chat_ids: [],
  lark_environment: 'feishu',
  slack_bot_token: '',
  slack_signing_secret: '',
  slack_app_token: '',
  slack_allowed_user_ids: [],
  slack_allowed_channel_ids: [],
  discord_bot_token: '',
  discord_allowed_user_ids: [],
  wechat_bot_token: '',
}

export const useRoxyClawStore = defineStore('roxyClaw', () => {
  const config = ref<RoxyClawConfig>({ ...defaultConfig })
  const originalConfig = shallowRef<RoxyClawConfig>({ ...defaultConfig })

  // connectionStatus 只在内存中，不持久化到 localStorage
  const connectionStatus = shallowRef<{
    telegram: { checked: boolean, status: 'success' | 'failed' | null }
    lark: { checked: boolean, status: 'success' | 'failed' | null }
    slack: { checked: boolean, status: 'success' | 'failed' | null }
    discord: { checked: boolean, status: 'success' | 'failed' | null }
    wechat: { checked: boolean, status: 'success' | 'failed' | null }
  }>({
    telegram: { checked: false, status: null },
    lark: { checked: false, status: null },
    slack: { checked: false, status: null },
    discord: { checked: false, status: null },
    wechat: { checked: false, status: null },
  })

  /**
   * 获取配置
   */
  async function fetchConfig(): Promise<RoxyClawConfig> {
    try {
      const res: UserGetRoxyClawListData = await API.base.userGetRoxyClawList()
      if (res.code === 0 && res.data) {
        const data = res.data
        // 转换后端数据格式
        const parsedConfig: RoxyClawConfig = {
          enabled: data.enabled === 1,
          tg_bot_token: data.tg_bot_token || '',
          tg_allowed_chat_ids: data.tg_allowed_chat_ids ? data.tg_allowed_chat_ids.split(',').map((id: string) => id.trim()).filter(Boolean) : [],
          lark_app_id: data.lark_app_id || '',
          lark_app_secret: data.lark_app_secret || '',
          lark_allowed_chat_ids: data.lark_allowed_chat_ids ? data.lark_allowed_chat_ids.split(',').map((id: string) => id.trim()).filter(Boolean) : [],
          lark_environment: (data.lark_environment as 'lark' | 'feishu') || 'feishu',
          slack_bot_token: data.slack_bot_token || '',
          slack_signing_secret: data.slack_signing_secret || '',
          slack_app_token: data.slack_app_token || '',
          slack_allowed_user_ids: data.slack_allowed_user_ids ? data.slack_allowed_user_ids.split(',').map((id: string) => id.trim()).filter(Boolean) : [],
          slack_allowed_channel_ids: data.slack_allowed_channel_ids ? data.slack_allowed_channel_ids.split(',').map((id: string) => id.trim()).filter(Boolean) : [],
          discord_bot_token: data.discord_bot_token || '',
          discord_allowed_user_ids: data.discord_allowed_user_ids ? data.discord_allowed_user_ids.split(',').map((id: string) => id.trim()).filter(Boolean) : [],
          wechat_bot_token: (data as any).weixin_bot_token || (data as any).wechat_bot_token || '',
        }
        config.value = parsedConfig
        // 保存原始配置用于判断是否修改
        originalConfig.value = { ...toRaw(config.value) }
        return toRaw(config.value)
      }
      // 如果没有数据，返回默认配置
      originalConfig.value = { ...defaultConfig }
      config.value = { ...defaultConfig }
      return toRaw(config.value)
    }
    catch (error) {
      console.error('Failed to fetch RoxyClaw config:', error)
      // 出错时返回本地存储的配置或默认配置
      originalConfig.value = { ...toRaw(config.value) }
      return toRaw(config.value)
    }
  }

  /**
   * 判断配置是否已变更（忽略 enabled 字段的变化）
   */
  function isConfigChanged(): boolean {
    // 创建不包含 enabled 字段的配置副本进行比较
    const { enabled: _, ...configWithoutEnabled } = config.value
    const { enabled: __, ...originalWithoutEnabled } = originalConfig.value
    return JSON.stringify(configWithoutEnabled) !== JSON.stringify(originalWithoutEnabled)
  }

  /**
   * 更新原始配置（用于配置修改后重新检测）
   */
  function updateOriginalConfig() {
    originalConfig.value = { ...toRaw(config.value) }
  }

  // 防抖的自动重启函数
  const debouncedRestart = debounce(async () => {
    if (config.value.enabled) {
      console.log('RoxyClaw configuration changed, automatically restarting...')
      await restartRoxyClaw()
    }
  }, 300)

  /**
   * 更新配置
   */
  async function updateConfig(partialConfig: Partial<RoxyClawConfig>): Promise<RoxyClawConfig> {
    // 合并配置
    const newConfig = { ...toRaw(config.value), ...partialConfig }

    // 检查配置是否有变化（忽略 enabled 字段）
    const { enabled: _, ...configWithoutEnabled } = toRaw(config.value)
    const { enabled: __, ...newConfigWithoutEnabled } = newConfig
    const hasConfigChanged = JSON.stringify(configWithoutEnabled) !== JSON.stringify(newConfigWithoutEnabled)

    // 转换为后端接口格式
    const payload: UserSetRoxyClawCreatePayload = {
      tg_bot_token: newConfig.tg_bot_token,
      tg_allowed_chat_ids: newConfig.tg_allowed_chat_ids.join(','),
      lark_app_id: newConfig.lark_app_id,
      lark_app_secret: newConfig.lark_app_secret,
      lark_allowed_chat_ids: newConfig.lark_allowed_chat_ids.join(','),
      enabled: newConfig.enabled ? 1 : 0,
      lark_environment: newConfig.lark_environment,
      slack_bot_token: newConfig.slack_bot_token,
      slack_signing_secret: newConfig.slack_signing_secret,
      slack_app_token: newConfig.slack_app_token,
      slack_allowed_user_ids: newConfig.slack_allowed_user_ids.join(','),
      slack_allowed_channel_ids: newConfig.slack_allowed_channel_ids.join(','),
      discord_bot_token: newConfig.discord_bot_token,
      discord_allowed_user_ids: newConfig.discord_allowed_user_ids.join(','),
      wechat_bot_token: newConfig.wechat_bot_token,
    }

    try {
      const res = await API.base.userSetRoxyClawCreate(payload)
      if (res.code === 0) {
        // 更新成功后更新本地配置
        config.value = newConfig
        // 更新原始配置
        updateOriginalConfig()

        // 如果配置有变化且 RoxyClaw 已启用，则自动重启
        if (hasConfigChanged && config.value.enabled) {
          console.log('RoxyClaw configuration updated, automatically restarting...')
          debouncedRestart()
        }

        return newConfig
      }
      else {
        console.error('Failed to update RoxyClaw config:', res.msg)
        // 如果失败，返回原配置
        return toRaw(config.value)
      }
    }
    catch (error) {
      console.error('Failed to update RoxyClaw config:', error)
      // 如果请求失败，返回原配置
      return toRaw(config.value)
    }
  }

  /**
   * 获取 MCP 状态
   */
  async function getMcpStatus(): Promise<{ mcpWindowOpen: boolean, roxyClawEnabled: boolean, mcpServerRunning: boolean }> {
    if (globalThis.electronAPI) {
      try {
        return await globalThis.electronAPI.send('mcp:getStatus')
      }
      catch (error) {
        console.error('Failed to get MCP status:', error)
        return { mcpWindowOpen: false, roxyClawEnabled: false, mcpServerRunning: false }
      }
    }
    return { mcpWindowOpen: false, roxyClawEnabled: false, mcpServerRunning: false }
  }

  /**
   * 启动 RoxyClaw
   */
  async function startRoxyClaw(): Promise<{ success: boolean, message?: string }> {
    try {
      const apiPort = await globalThis.electronAPI.send('util:getApiPort')
      if (apiPort === -1) {
        replaceToRoute('api-keys', { highlight: 'true' })
        return {
          success: false,
          message: $t('请检查 API 启用状态或端口是否被占用'),
        }
      }

      // 检查 MCP 窗口是否正在运行
      const mcpStatus = await getMcpStatus()
      if (mcpStatus.mcpWindowOpen) {
        return {
          success: false,
          message: $t('Roxy AI Agent 窗口正在运行中，请先关闭 Roxy AI Agent 窗口'),
        }
      }

      // 检查 Telegram 配置
      if (config.value.tg_bot_token && config.value.tg_allowed_chat_ids.length === 0) {
        return {
          success: false,
          message: $t('Telegram Bot 的 Allowed Chat IDs (白名单) 是必填项，请先填写'),
        }
      }
      // 检查 Discord 配置
      if (config.value.discord_bot_token && config.value.discord_allowed_user_ids.length === 0) {
        return {
          success: false,
          message: $t('Discord Bot 的 Allowed User IDs (白名单) 是必填项，请先填写'),
        }
      }

      // 设置为启动中状态
      config.value.enabled = true

      // 如果在 Electron 环境中，调用主进程
      if (globalThis.electronAPI) {
        const result = await globalThis.electronAPI.send('mcp:startRoxyClaw')

        if (!result.success) {
          config.value.enabled = false
          // 使用错误类型获取对应的 i18n 消息
          const errorMessage = result.type
            ? getMcpErrorMessage(result.type)
            : result.message || $t('RoxyClaw 启动失败')
          return {
            success: false,
            message: errorMessage,
          }
        }

        // 启动成功后更新原始配置
        updateOriginalConfig()
        return {
          success: true,
          message: $t('RoxyClaw 启动成功'),
        }
      }

      // 如果在浏览器环境（开发模式），使用 mock
      await new Promise(resolve => setTimeout(resolve, 500))
      // 启动成功后更新原始配置
      updateOriginalConfig()
      return { success: true, message: $t('RoxyClaw 启动成功') }
    }
    catch (error) {
      console.error('Failed to start RoxyClaw:', error)
      config.value.enabled = false
      return { success: false, message: $t('RoxyClaw 启动失败') }
    }
  }

  /**
   * 停止 RoxyClaw
   */
  async function stopRoxyClaw(): Promise<{ success: boolean, message?: string }> {
    try {
      // 首先设置为停止状态
      config.value.enabled = false

      // 如果在 Electron 环境中，调用主进程
      if (globalThis.electronAPI) {
        const result = await globalThis.electronAPI.send('mcp:stopRoxyClaw')
        // 如果停止失败，恢复状态
        if (!result.success) {
          config.value.enabled = true
        }
        else {
          // 停止成功后更新原始配置
          updateOriginalConfig()
        }
        if (result.success) {
          return {
            success: true,
            message: $t('RoxyClaw 停止成功'),
          }
        }
        else {
          return {
            success: false,
            message: $t('RoxyClaw 停止失败'),
          }
        }
      }

      // 如果在浏览器环境（开发模式），使用 mock
      await new Promise(resolve => setTimeout(resolve, 500))
      // 停止成功后更新原始配置
      updateOriginalConfig()
      return { success: true, message: $t('RoxyClaw 停止成功') }
    }
    catch (error) {
      console.error('Failed to stop RoxyClaw:', error)
      config.value.enabled = true
      return { success: false, message: $t('RoxyClaw 停止失败') }
    }
  }

  /**
   * 重启 RoxyClaw
   */
  async function restartRoxyClaw(): Promise<{ success: boolean, message?: string }> {
    try {
      // 先停止
      const stopResult = await stopRoxyClaw()
      if (!stopResult.success) {
        return stopResult
      }

      // 再启动
      const startResult = await startRoxyClaw()
      return startResult
    }
    catch (error) {
      console.error('Failed to restart RoxyClaw:', error)
      return { success: false, message: $t('RoxyClaw 重启失败') }
    }
  }

  /**
   * 测试 Telegram 连接（通过 Electron IPC 调用，使用系统代理）
   */
  async function testTelegram(token: string): Promise<{ success: boolean, message?: string }> {
    try {
      if (globalThis.electronAPI) {
        return await globalThis.electronAPI.send('mcp:testTelegram', token)
      }
      // 浏览器环境降级处理
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`)
      const data = await response.json()
      if (data.ok && data.result && data.result.is_bot) {
        return { success: true, message: $t('Telegram bot token 有效') }
      }
      return { success: false, message: $t('Telegram bot token 无效') }
    }
    catch (error) {
      console.error('Telegram test failed:', error)
      return { success: false, message: $t('网络错误') }
    }
  }

  /**
   * 测试 Lark 连接（通过 Electron IPC 调用，使用系统代理）
   */
  async function testLark(appId: string, appSecret: string, environment: 'lark' | 'feishu' = 'feishu'): Promise<{ success: boolean, message?: string }> {
    try {
      if (globalThis.electronAPI) {
        return await globalThis.electronAPI.send('mcp:testLark', appId, appSecret, environment)
      }
      // 浏览器环境降级处理
      const domain = environment === 'lark' ? 'open.larksuite.com' : 'open.feishu.cn'
      const response = await fetch(`https://${domain}/open-apis/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      })
      const data = await response.json()
      if (data.code === 0 && data.tenant_access_token) {
        return { success: true, message: $t('{lark} app credentials 有效!', { lark: $t('Lark / 飞书') }) }
      }
      return { success: false, message: $t('app credentials 无效') }
    }
    catch (error) {
      console.error('Lark test failed:', error)
      return { success: false, message: $t('网络错误') }
    }
  }

  /**
   * 测试 Slack 连接（通过 Electron IPC 调用，使用系统代理）
   */
  async function testSlack(botToken: string): Promise<{ success: boolean, message?: string }> {
    try {
      if (globalThis.electronAPI) {
        return await globalThis.electronAPI.send('mcp:testSlack', botToken)
      }
      // 浏览器环境降级处理
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${botToken}`,
        },
      })
      const data = await response.json()
      if (data.ok) {
        return { success: true, message: $t('Slack bot token 有效!') }
      }
      return { success: false, message: data.error || $t('Slack bot token 无效') }
    }
    catch (error) {
      console.error('Slack test failed:', error)
      return { success: false, message: $t('网络错误') }
    }
  }

  /**
   * 测试 Discord 连接（通过 Electron IPC 调用，使用系统代理）
   */
  async function testDiscord(botToken: string): Promise<{ success: boolean, message?: string }> {
    try {
      if (globalThis.electronAPI) {
        return await globalThis.electronAPI.send('mcp:testDiscord', botToken)
      }
      // 浏览器环境降级处理
      const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${botToken}` },
      })
      if (response.ok) {
        return { success: true, message: $t('Discord bot token 有效!') }
      }
      const data = await response.json().catch(() => null)
      return { success: false, message: data?.message || $t('Discord bot token 无效') }
    }
    catch (error) {
      console.error('Discord test failed:', error)
      return { success: false, message: $t('网络错误') }
    }
  }

  // 辅助计算属性
  const isEnabled = computed(() => config.value.enabled)
  const telegramConfigured = computed(() => !!config.value.tg_bot_token && config.value.tg_allowed_chat_ids.length > 0)
  const larkConfigured = computed(() => !!config.value.lark_app_id && !!config.value.lark_app_secret)
  const slackConfigured = computed(() => !!config.value.slack_bot_token && !!config.value.slack_signing_secret)
  const discordConfigured = computed(() => !!config.value.discord_bot_token && config.value.discord_allowed_user_ids.length > 0)
  const wechatConfigured = computed(() => !!config.value.wechat_bot_token)

  async function getWeixinBotQrcode(): Promise<{ success: boolean, message?: string, data?: { qrcode: string, url: string, qrcodeImgContent: string } }> {
    try {
      if (globalThis.electronAPI) {
        return await globalThis.electronAPI.send('mcp:getWeixinBotQrcode')
      }
      return { success: false, message: 'Electron API unavailable' }
    }
    catch (error) {
      console.error('Failed to get Weixin QR code:', error)
      return { success: false, message: $t('网络错误') }
    }
  }

  async function getWeixinBotQrcodeStatus(qrcode: string): Promise<{ success: boolean, message?: string, data?: { status: string, botToken: string, baseUrl: string } }> {
    try {
      if (globalThis.electronAPI) {
        return await globalThis.electronAPI.send('mcp:getWeixinBotQrcodeStatus', qrcode)
      }
      return { success: false, message: 'Electron API unavailable' }
    }
    catch (error) {
      console.error('Failed to get Weixin QR status:', error)
      return { success: false, message: $t('网络错误') }
    }
  }

  return {
    config,
    fetchConfig,
    updateConfig,
    startRoxyClaw,
    stopRoxyClaw,
    restartRoxyClaw,
    testTelegram,
    testLark,
    testSlack,
    testDiscord,
    isEnabled,
    telegramConfigured,
    larkConfigured,
    slackConfigured,
    discordConfigured,
    wechatConfigured,
    connectionStatus,
    isConfigChanged,
    updateOriginalConfig,
    getMcpStatus,
    getWeixinBotQrcode,
    getWeixinBotQrcodeStatus,
  }
}, {
  persist: false,
})
