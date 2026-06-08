import type { McpFailureType } from '@roxy/electron-preload'
import type { IPCMainInstance } from '/@/modules/ipc/types'
import { globalShortcut, net } from 'electron'
import { closeMcpWindow, createMcpWindow, getMcpWindow, mcpManager } from '/@/modules/mcp'
import { isMcpError } from '/@/modules/mcp/errors'
import { mcpRuntimeState } from '/@/modules/mcp/state'

const WEIXIN_BOT_BASE_URL = 'https://ilinkai.weixin.qq.com'

interface McpResponse<T = any> {
  success: boolean
  data?: T
  type?: McpFailureType
  message?: string
  details?: Record<string, any>
}

export function closeSyncControl() {
  globalShortcut.unregisterAll()
}

/** MCP 相关 */
export function setupMcpIpc(ipcMain: IPCMainInstance) {
  /** 获取 MCP 状态 */
  ipcMain.on('mcp:getStatus', async (_event) => {
    return {
      mcpWindowOpen: mcpRuntimeState.getMcpWindowOpen(),
      roxyClawEnabled: mcpRuntimeState.getRoxyClawEnabled(),
      mcpServerRunning: mcpManager.isWorkerConnected(),
    }
  })

  /** 打开mcp */
  ipcMain.on('mcp:open', async (_event, options?: { scene?: string, skill?: string }): Promise<McpResponse> => {
    console.log('Opening MCP')

    // 检查 RoxyClaw 是否正在运行
    if (mcpRuntimeState.getRoxyClawEnabled()) {
      return {
        success: false,
        type: 'roxyclaw_already_running',
      }
    }

    // 窗口已打开，直接聚焦到前台
    const existingWin = getMcpWindow()
    if (existingWin) {
      if (existingWin.isMinimized()) {
        existingWin.restore()
      }
      // macOS 上窗口被遮挡时渲染进程可能处于限流状态，先 show 再 focus，
      // 确保窗口真正回到前台、渲染恢复后再下发消息，避免监听器收不到。
      existingWin.show()
      existingWin.focus()
      // 已打开窗口时用消息而非重载，避免打断对话，由 Agent 窗口判断 isChatting 后决定提示或应用
      if (options?.skill) {
        ipcMain.send('mcp:use-skill', options.skill)
      }
      if (options?.scene) {
        ipcMain.send('mcp:use-scene', options.scene)
      }
      return { success: true }
    }

    try {
      await mcpManager.startMcpServer('agent')
      await createMcpWindow(options?.scene, options?.skill)
      mcpRuntimeState.setMcpWindowOpen(true)
      return { success: true }
    }
    catch (error) {
      if (isMcpError(error)) {
        return {
          success: false,
          type: error.type,
          message: error.message,
          details: error.details,
        }
      }
      return {
        success: false,
        type: 'unknown_error',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })

  /** 获取mcp配置 */
  ipcMain.on('mcp:config', async (_event) => {
    return mcpManager.config
  })

  /** 关闭mcp */
  ipcMain.on('mcp:close', async (_event) => {
    mcpManager.closeMcpServer()
    await closeMcpWindow()
    mcpRuntimeState.setMcpWindowOpen(false)
  })

  /** 启动 RoxyClaw */
  ipcMain.on('mcp:startRoxyClaw', async (_event): Promise<McpResponse<{ message: string }>> => {
    try {
      console.log('Starting RoxyClaw...')

      // 检查 MCP 窗口是否正在运行
      if (mcpRuntimeState.getMcpWindowOpen()) {
        return {
          success: false,
          type: 'mcp_window_already_open',
        }
      }

      await mcpManager.startMcpServer('im')
      mcpRuntimeState.setRoxyClawEnabled(true)
      return { success: true, data: { message: 'RoxyClaw started successfully' } }
    }
    catch (error) {
      console.error('Failed to start RoxyClaw:', error)
      if (isMcpError(error)) {
        return {
          success: false,
          type: error.type,
          message: error.message,
          details: error.details,
        }
      }
      return {
        success: false,
        type: 'unknown_error',
        message: error instanceof Error ? error.message : 'Failed to start RoxyClaw',
      }
    }
  })

  /** 停止 RoxyClaw */
  ipcMain.on('mcp:stopRoxyClaw', async (_event) => {
    try {
      console.log('Stopping RoxyClaw...')
      mcpManager.closeMcpServer()
      mcpRuntimeState.setRoxyClawEnabled(false)
      return { success: true, message: 'RoxyClaw stopped successfully' }
    }
    catch (error) {
      console.error('Failed to stop RoxyClaw:', error)
      return { success: false, message: error instanceof Error ? error.message : 'Failed to stop RoxyClaw' }
    }
  })

  /** 获取 RoxyClaw 状态 */
  ipcMain.on('mcp:roxyClawStatus', async (_event) => {
    return {
      enabled: mcpRuntimeState.getRoxyClawEnabled(),
      connected: mcpManager.isWorkerConnected(),
    }
  })

  /** 测试 Telegram 连接 */
  ipcMain.on('mcp:testTelegram', async (_event, token: string) => {
    try {
      const response = await net.fetch(`https://api.telegram.org/bot${token}/getMe`)
      const data: any = await response.json()

      if (data.ok && data.result && data.result.is_bot) {
        return { success: true, message: 'Telegram bot token 有效' }
      }

      return { success: false, message: 'Telegram bot token 无效' }
    }
    catch (error) {
      console.error('Telegram test failed:', error)
      return { success: false, message: '网络错误' }
    }
  })

  /** 测试 Lark 连接 */
  ipcMain.on('mcp:testLark', async (_event, appId: string, appSecret: string, environment: 'lark' | 'feishu') => {
    try {
      const domain = environment === 'lark' ? 'open.larksuite.com' : 'open.feishu.cn'
      const response = await net.fetch(`https://${domain}/open-apis/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret,
        }),
      })

      const data: any = await response.json()

      if (data.code === 0 && data.tenant_access_token) {
        return { success: true, message: 'Lark / 飞书 app credentials 有效!' }
      }

      return { success: false, message: 'app credentials 无效' }
    }
    catch (error) {
      console.error('Lark test failed:', error)
      return { success: false, message: '网络错误' }
    }
  })

  /** 测试 Slack 连接 */
  ipcMain.on('mcp:testSlack', async (_event, botToken: string) => {
    try {
      const response = await net.fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${botToken}`,
        },
      })

      const data: any = await response.json()

      if (data.ok) {
        return { success: true, message: 'Slack bot token 有效!' }
      }

      return { success: false, message: data.error || 'Slack bot token 无效' }
    }
    catch (error) {
      console.error('Slack test failed:', error)
      return { success: false, message: '网络错误' }
    }
  })

  /** 测试 Discord 连接 */
  ipcMain.on('mcp:testDiscord', async (_event, botToken: string) => {
    try {
      const response = await net.fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      })

      if (response.ok) {
        return { success: true, message: 'Discord bot token 有效!' }
      }

      const data: any = await response.json().catch(() => null)
      return { success: false, message: data?.message || 'Discord bot token 无效' }
    }
    catch (error) {
      console.error('Discord test failed:', error)
      return { success: false, message: 'Network error' }
    }
  })

  ipcMain.on('mcp:getWeixinBotQrcode', async () => {
    try {
      const response = await net.fetch(`${WEIXIN_BOT_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=3`)
      const data: any = await response.json()

      if (!response.ok || !data?.qrcode) {
        return { success: false, message: data?.errmsg || data?.msg || 'Failed to get Weixin QR code' }
      }

      return {
        success: true,
        data: {
          qrcode: data.qrcode || '',
          url: data.url || '',
          qrcodeImgContent: data.qrcode_img_content || '',
        },
      }
    }
    catch (error) {
      console.error('Weixin QR code request failed:', error)
      return { success: false, message: 'Network error' }
    }
  })

  ipcMain.on('mcp:getWeixinBotQrcodeStatus', async (_event, qrcode: string) => {
    try {
      const response = await net.fetch(`${WEIXIN_BOT_BASE_URL}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`)
      const data: any = await response.json()

      if (!response.ok) {
        return { success: false, message: data?.errmsg || data?.msg || 'Failed to get Weixin QR status' }
      }

      return {
        success: true,
        data: {
          status: data?.status || '',
          botToken: data?.bot_token || '',
          baseUrl: data?.baseurl || WEIXIN_BOT_BASE_URL,
        },
      }
    }
    catch (error) {
      console.error('Weixin QR status request failed:', error)
      return { success: false, message: 'Network error' }
    }
  })
}
