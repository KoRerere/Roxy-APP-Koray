import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw } from 'vue'
import { debounce } from 'es-toolkit'
import type { UserGetRoxyClawListData, UserSetRoxyClawCreatePayload } from '@roxy/backend-api'
import type { McpFailureType } from '@roxy/electron-preload'
import { API } from '/@/api'
import { useAgentStore } from '/@/stores/agent'

/**
 * 获取 MCP 错误的 i18n 消息
 */
export function getMcpErrorMessage(type: McpFailureType): string {
  const messageMap: Record<McpFailureType, string> = {
    script_repair_failed: $t('Roxy AI Agent 文件修复失败，请重启应用后重试'),
    agent_update_in_progress: $t('AI Agent 更新资源下载中，请稍后再试'),
    openapi_port_occupied: $t('端口已被占用'),
    openapi_server_failed: $t('Roxy Agent 启动失败'),
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

export type LarkScanInstallStatus = 'waiting' | 'polling' | 'slow_down' | 'domain_switched' | 'connected' | 'expired' | 'cancelled' | 'error'

export interface LarkScanInstallStartResult {
  success: boolean
  message?: string
  data?: {
    installId: string
    qrUrl: string
    expireIn: number
  }
}

export interface LarkScanInstallStatusResult {
  success: boolean
  message?: string
  data?: {
    status: LarkScanInstallStatus
    interval?: number
    result?: {
      appId: string
      appSecret: string
      environment: 'lark' | 'feishu'
      installerOpenId?: string
    }
    error?: string
  }
}

interface RoxyClawAgentResponse<T = unknown> {
  code?: number
  success: boolean
  data?: T
  type?: McpFailureType
  message?: string
  msg?: string
  details?: Record<string, any>
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
  const agentStore = useAgentStore()
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

  async function ensureAgentReady() {
    await agentStore.waitUntilReady()
  }

  async function requestAgentRoxyClaw<T = unknown>(path: string, init: RequestInit = {}): Promise<RoxyClawAgentResponse<T>> {
    try {
      await ensureAgentReady()

      if (!agentStore.serverUrl) {
        return { success: false, message: $t('Roxy Agent 服务未启动') }
      }

      const response = await fetch(`${agentStore.serverUrl}/api/roxy-claw${path}`, {
        method: init.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: init.body,
        cache: 'no-store',
      })

      if (!response.ok) {
        return { success: false, message: $t('Agent 请求失败：{status}', { status: response.status }) }
      }

      const payload = await response.json() as Partial<RoxyClawAgentResponse<T>>
      return {
        ...payload,
        success: payload.success ?? payload.code === 0,
        message: payload.message || payload.msg,
      }
    }
    catch (error) {
      console.error('RoxyClaw agent request failed:', error)
      return { success: false, message: $t('网络错误') }
    }
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
   * 启动 RoxyClaw
   */
  async function startRoxyClaw(): Promise<{ success: boolean, message?: string }> {
    const previousConfig = { ...toRaw(config.value) }

    try {
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

      if (!config.value.enabled) {
        const nextConfig = await updateConfig({ enabled: true })
        if (!nextConfig.enabled) {
          return {
            success: false,
            message: $t('RoxyClaw 启动失败'),
          }
        }
      }

      const result = await requestAgentRoxyClaw<{ message: string }>('/start', {
        method: 'POST',
      })

      if (!result.success) {
        if (!previousConfig.enabled) {
          await updateConfig({ enabled: false })
        }
        const errorMessage = result.type
          ? getMcpErrorMessage(result.type)
          : result.message || $t('RoxyClaw 启动失败')
        return {
          success: false,
          message: errorMessage,
        }
      }

      config.value.enabled = true
      updateOriginalConfig()
      return { success: true, message: $t('RoxyClaw 启动成功') }
    }
    catch (error) {
      console.error('Failed to start RoxyClaw:', error)
      if (!previousConfig.enabled) {
        await updateConfig({ enabled: false })
      }
      return { success: false, message: $t('RoxyClaw 启动失败') }
    }
  }

  /**
   * 停止 RoxyClaw
   */
  async function stopRoxyClaw(): Promise<{ success: boolean, message?: string }> {
    const previousConfig = { ...toRaw(config.value) }

    try {
      if (config.value.enabled) {
        const nextConfig = await updateConfig({ enabled: false })
        if (nextConfig.enabled) {
          return {
            success: false,
            message: $t('RoxyClaw 停止失败'),
          }
        }
      }

      const result = await requestAgentRoxyClaw('/stop', {
        method: 'POST',
      })

      if (!result.success) {
        if (previousConfig.enabled) {
          await updateConfig({ enabled: true })
        }
        return {
          success: false,
          message: result.message || $t('RoxyClaw 停止失败'),
        }
      }

      config.value.enabled = false
      updateOriginalConfig()
      return { success: true, message: $t('RoxyClaw 停止成功') }
    }
    catch (error) {
      console.error('Failed to stop RoxyClaw:', error)
      if (previousConfig.enabled) {
        await updateConfig({ enabled: true })
      }
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
   * 测试 Telegram 连接
   */
  async function testTelegram(token: string): Promise<{ success: boolean, message?: string }> {
    return await requestAgentRoxyClaw('/test/telegram', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  }

  /**
   * 测试 Lark 连接
   */
  async function testLark(appId: string, appSecret: string, environment: 'lark' | 'feishu' = 'feishu'): Promise<{ success: boolean, message?: string }> {
    return await requestAgentRoxyClaw('/test/lark', {
      method: 'POST',
      body: JSON.stringify({ appId, appSecret, environment }),
    })
  }

  async function startLarkScanInstall(): Promise<LarkScanInstallStartResult> {
    return await requestAgentRoxyClaw('/lark/scan-install', {
      method: 'POST',
    })
  }

  async function getLarkScanInstallStatus(installId: string): Promise<LarkScanInstallStatusResult> {
    return await requestAgentRoxyClaw(`/lark/scan-install/${encodeURIComponent(installId)}`)
  }

  async function cancelLarkScanInstall(installId: string): Promise<{ success: boolean, message?: string }> {
    return await requestAgentRoxyClaw(`/lark/scan-install/${encodeURIComponent(installId)}`, {
      method: 'DELETE',
    })
  }

  async function completeLarkScanInstall(result: NonNullable<NonNullable<LarkScanInstallStatusResult['data']>['result']>): Promise<RoxyClawConfig> {
    const allowedUserIds = result.installerOpenId
      ? Array.from(new Set([...config.value.lark_allowed_chat_ids, result.installerOpenId]))
      : config.value.lark_allowed_chat_ids

    const nextConfig = await updateConfig({
      lark_environment: result.environment,
      lark_app_id: result.appId,
      lark_app_secret: result.appSecret,
      lark_allowed_chat_ids: allowedUserIds,
    })
    connectionStatus.value.lark = { checked: true, status: 'success' }
    return nextConfig
  }

  /**
   * 测试 Slack 连接
   */
  async function testSlack(botToken: string): Promise<{ success: boolean, message?: string }> {
    return await requestAgentRoxyClaw('/test/slack', {
      method: 'POST',
      body: JSON.stringify({ botToken }),
    })
  }

  /**
   * 测试 Discord 连接
   */
  async function testDiscord(botToken: string): Promise<{ success: boolean, message?: string }> {
    return await requestAgentRoxyClaw('/test/discord', {
      method: 'POST',
      body: JSON.stringify({ botToken }),
    })
  }

  // 辅助计算属性
  const isEnabled = computed(() => config.value.enabled)
  const telegramConfigured = computed(() => !!config.value.tg_bot_token && config.value.tg_allowed_chat_ids.length > 0)
  const larkConfigured = computed(() => !!config.value.lark_app_id && !!config.value.lark_app_secret)
  const slackConfigured = computed(() => !!config.value.slack_bot_token && !!config.value.slack_signing_secret)
  const discordConfigured = computed(() => !!config.value.discord_bot_token && config.value.discord_allowed_user_ids.length > 0)
  const wechatConfigured = computed(() => !!config.value.wechat_bot_token)

  async function getWeixinBotQrcode(): Promise<{ success: boolean, message?: string, data?: { qrcode: string, url: string, qrcodeImgContent: string } }> {
    return await requestAgentRoxyClaw('/weixin/qrcode')
  }

  async function getWeixinBotQrcodeStatus(qrcode: string): Promise<{ success: boolean, message?: string, data?: { status: string, botToken: string, baseUrl: string } }> {
    const params = new URLSearchParams({ qrcode })
    return await requestAgentRoxyClaw(`/weixin/qrcode-status?${params.toString()}`)
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
    startLarkScanInstall,
    getLarkScanInstallStatus,
    cancelLarkScanInstall,
    completeLarkScanInstall,
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
    getWeixinBotQrcode,
    getWeixinBotQrcodeStatus,
  }
}, {
  persist: false,
})
