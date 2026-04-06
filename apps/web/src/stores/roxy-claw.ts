import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw } from 'vue'
import { debounce } from 'es-toolkit'
import type { UserGetRoxyClawListData, UserSetRoxyClawCreatePayload } from '@roxy/backend-api'
import { API } from '/@/api'
import { useRouter } from 'vue-router'

// RoxyClaw 配置接口
export interface RoxyClawConfig {
  enabled: boolean
  tg_bot_token: string
  tg_allowed_chat_ids: string[]
  lark_app_id: string
  lark_app_secret: string
  lark_allowed_chat_ids: string[]
  lark_environment: 'lark' | 'feishu'
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
}

export const useRoxyClawStore = defineStore('roxyClaw', () => {
  const config = ref<RoxyClawConfig>({ ...defaultConfig })
  const originalConfig = shallowRef<RoxyClawConfig>({ ...defaultConfig })
  const router = useRouter()

  // connectionStatus 只在内存中，不持久化到 localStorage
  const connectionStatus = shallowRef<{
    telegram: { checked: boolean, status: 'success' | 'failed' | null }
    lark: { checked: boolean, status: 'success' | 'failed' | null }
  }>({
    telegram: { checked: false, status: null },
    lark: { checked: false, status: null },
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
        router.replace({ name: 'api-keys', query: { highlight: 'true' } })
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
          message: $t('MCP 窗口正在运行中，请先关闭 MCP 窗口'),
        }
      }

      // 检查 Telegram 配置
      if (config.value.tg_bot_token && config.value.tg_allowed_chat_ids.length === 0) {
        return {
          success: false,
          message: $t('Telegram Bot 的 Allowed Chat IDs (白名单) 是必填项，请先填写'),
        }
      }

      // 设置为启动中状态
      config.value.enabled = true

      // 如果在 Electron 环境中，调用主进程
      if (globalThis.electronAPI) {
        const result = await globalThis.electronAPI.send('mcp:startRoxyClaw')

        if (!result.success) {
          config.value.enabled = false
        }
        else {
          // 启动成功后更新原始配置
          updateOriginalConfig()
        }
        if (result.success) {
          return {
            success: true,
            message: $t('RoxyClaw 启动成功'),
          }
        }
        else {
          return {
            success: false,
            message: $t('RoxyClaw 启动失败'),
          }
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
   * 测试 Telegram 连接（调用 Telegram 官方接口）
   */
  async function testTelegram(token: string): Promise<{ success: boolean, message?: string }> {
    try {
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
   * 测试 Lark 连接（调用飞书官方接口）
   */
  async function testLark(appId: string, appSecret: string, environment: 'lark' | 'feishu' = 'feishu'): Promise<{ success: boolean, message?: string }> {
    try {
      // 反向代理 open.feishu.cn 或 open.larksuite.com，飞书有同源策略，不能直接访问
      const response = await fetch(`https://apitest.roxybrowser.co/${environment}/open-apis/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret,
        }),
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

  // 辅助计算属性
  const isEnabled = computed(() => config.value.enabled)
  const telegramConfigured = computed(() => !!config.value.tg_bot_token && config.value.tg_allowed_chat_ids.length > 0)
  const larkConfigured = computed(() => !!config.value.lark_app_id && !!config.value.lark_app_secret)

  return {
    config,
    fetchConfig,
    updateConfig,
    startRoxyClaw,
    stopRoxyClaw,
    restartRoxyClaw,
    testTelegram,
    testLark,
    isEnabled,
    telegramConfigured,
    larkConfigured,
    connectionStatus,
    isConfigChanged,
    updateOriginalConfig,
    getMcpStatus,
  }
}, {
  persist: false,
})
