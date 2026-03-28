import type { UserGetLlmInfoListData } from '@roxy/backend-api'
import type { UtilityProcess } from 'electron'
import { app, utilityProcess } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getPortPromise } from 'portfinder'
import { API } from '/@/api'
import { ROXY_MCP_WINDOW_ID } from '/@/constants'
import { appConfig } from '/@/constants/appConfig'
import { appCliStartArgs, isDev, isPackaged } from '/@/constants/common'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { store } from '/@/modules/store'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { agentUpdater } from '/@/modules/updater/agentUpdater'
import { createWindow, getWindowById } from '/@/utils/browser-window'
import { aliOSS } from '/@/utils/oss'
import { calculateFileHash } from '/@/utils'
import { ipcSender } from '../ipc/sender'

export function getMcpWindow() {
  return getWindowById(ROXY_MCP_WINDOW_ID)
}

export const mcpManager = new (class McpManager {
  config: {
    port: number
  } = {
    port: 26580,
  }

  private mcpWorker: UtilityProcess | null = null

  private llmInfo: UserGetLlmInfoListData['data'] = null!

  async startMcpServer() {
    // 等待更新完毕。
    try {
      if (agentUpdater.promise) {
        await agentUpdater.promise
      }
    }
    catch (error) {
      console.error('agentUpdaterPromise wait error:', error)
    }

    // 主动触发一次更新检查，确保本地 agent 脚本与 sha512 期望值就绪
    try {
      await agentUpdater.checkForUpdates()
    }
    catch (error) {
      console.error('[mcp] agentUpdater.checkForUpdates error:', error)
    }

    const llmInfo = await API.base.userGetLlmInfoList({})

    if (llmInfo.code !== 0 || !llmInfo.data) {
      return
    }

    this.llmInfo = llmInfo.data

    if (this.mcpWorker) {
      return this.mcpWorker
    }

    // 是否处于开发环境，pnpm dev 启动时，为true，打包后为false
    const isDevelopment = process.env.MODE === 'development'

    const OPENAPI_SCRIPT_PATH = isDevelopment ? path.join(import.meta.dirname, './openapiMcp.mjs') : appConfig.openapiMcpBinPath

    const PLAYWRIGHT_SCRIPT_PATH = isDevelopment ? path.join(import.meta.dirname, './playwrightMcp.mjs') : appConfig.playwrightMcpBinPath

    const AGENT_ENTRY_SCRIPT = isDevelopment ? path.join(import.meta.dirname, './agent.mjs') : appConfig.agentBinPath

    // 开发时让 agent 能解析到 packages/roxy-agent/words（敏感词库）
    const ROXY_AGENT_PACKAGE_ROOT = isDevelopment ? path.resolve(import.meta.dirname, '..', '..', '..', 'packages', 'roxy-agent') : undefined

    const CHECKPOINT_DIR = path.join(agentUpdater.agentDir, 'checkpoints')

    const DOWNLOADS_DIR = app.getPath('downloads')

    await fs.mkdir(CHECKPOINT_DIR, { recursive: true })
    // 提供流式输出的服务需要的端口
    const port = await getPortPromise({ port: this.config.port })

    // 启动前校验：阻止使用被篡改的本地脚本（尤其是从云端下载落地的 mjs）
    const integrityRequired = process.env.ROXY_AGENT_INTEGRITY_REQUIRED !== 'false'
    if (!isDevelopment && integrityRequired) {
      const expectedAgentSha512 = agentUpdater.agentEntrySha512
      const expectedOpenapiSha512 = agentUpdater.openapiEntrySha512
      const expectedPlaywrightSha512 = agentUpdater.playwrightEntrySha512

      if (!expectedAgentSha512 || !expectedOpenapiSha512 || !expectedPlaywrightSha512) {
        throw new Error('[mcp] missing expected sha512 for agent scripts')
      }

      const localAgentSha512 = await calculateFileHash(AGENT_ENTRY_SCRIPT)
      const localOpenapiSha512 = await calculateFileHash(OPENAPI_SCRIPT_PATH)
      const localPlaywrightSha512 = await calculateFileHash(PLAYWRIGHT_SCRIPT_PATH)

      if (localAgentSha512 !== expectedAgentSha512) {
        throw new Error('[mcp] agent script sha512 mismatch')
      }
      if (localOpenapiSha512 !== expectedOpenapiSha512) {
        throw new Error('[mcp] openapi script sha512 mismatch')
      }
      if (localPlaywrightSha512 !== expectedPlaywrightSha512) {
        throw new Error('[mcp] playwright script sha512 mismatch')
      }
    }

    const env = {
      ...process.env,
      ...(ROXY_AGENT_PACKAGE_ROOT ? { ROXY_AGENT_PACKAGE_ROOT } : {}),
      LLM_PROVIDER: llmInfo.data.provider,
      LLM_MODEL: llmInfo.data.model,
      LLM_API_KEY: llmInfo.data.apikey,
      LLM_BASE_URL: llmInfo.data.baseUrl,
      LLM_BALANCE: llmInfo.data.balance,
      OPENAPI_SCRIPT_PATH,
      ROXY_API_KEY: store.apiKey,
      ROXY_API_HOST: `http://127.0.0.1:${store.apiPort}`,
      PLAYWRIGHT_SCRIPT_PATH,
      CHECKPOINT_DIR,

      ROXY_SERVER_PORT: String(port),
      ROXY_USER_ID: String(store.userId),
      ROXY_WORKSPACE_ID: String(store.workspaceId),

      SYSTEM_LANGUAGE: store.language,
      // 是否处于开发环境，pnpm dev 启动时，为true，打包后为false
      DEVELOPMENT: isDevelopment ? 'true' : 'false',
      DOWNLOADS_DIR,
      SKILLS_DIR: agentUpdater.agentDir,
      ...(agentUpdater.agentEntrySha512 && !isDevelopment ? { AGENT_ENTRY_SCRIPT_SHA512: agentUpdater.agentEntrySha512 } : {}),
      ...(agentUpdater.openapiEntrySha512 && !isDevelopment ? { OPENAPI_SCRIPT_SHA512: agentUpdater.openapiEntrySha512 } : {}),
      ...(agentUpdater.playwrightEntrySha512 && !isDevelopment ? { PLAYWRIGHT_SCRIPT_SHA512: agentUpdater.playwrightEntrySha512 } : {}),
    }
    Object.keys(env).forEach((key) => {
      env[key] = String(env[key])
    })
    const worker = utilityProcess.fork(AGENT_ENTRY_SCRIPT, [], {
      env,
      execArgv: appCliStartArgs['roxy-log-level'] === 'debug' || isDev ? [`--inspect=20580`] : [],
    })

    this.config.port = port
    this.mcpWorker = worker

    worker.on('message', async (message) => {
      console.log('[MCP Worker Message]', message)
      const event = message?.event
      switch (event) {
        case 'save_chat_message':
          this.handleSaveChatMessage(message)
          break
        case 'token_usage_change':
          this.handleTokenUsage(message)
          break
      }
    })

    worker.on('exit', (code?: number) => {
      console.log(`[MCP Worker Exit] code: ${code}`)
      this.mcpWorker = null
    })

    return worker
  }

  private async handleSaveChatMessage(message: {
    event: 'save_chat_message'
    data: { conversationId: string, file: string, message: string, inputToken: number, outputToken: number, time: number, taskType: string }
  }) {
    const remoteUrl = await this.handleOssFileSave(message.data.file)
    try {
      const result = await API.base.userSaveLlmDataCreate({
        content: message.data.message,
        resultUrl: remoteUrl || '',
        conversationId: message.data.conversationId,
        inputToken: message.data.inputToken,
        outputToken: message.data.outputToken,
      })
      if (result.code !== 0) {
        console.error('save chat message error:', result.msg)
      }
    }
    catch (error) {
      console.error('save chat message error:', error)
    }
  }

  /**
   * 将ai回复的消息保存到阿里云oss
   * @param file 文件路径
   */
  private async handleOssFileSave(file: string) {
    const fileName = path.basename(file)
    try {
      const { url } = await aliOSS.put(`/groupdata/workspace/${store.workspaceId}/mcp/${fileName}`, file)
      console.log('oss file save url:', url)
      return url
    }
    catch (error) {
      console.error('oss file save error:', error)
    }
  }

  /**
   * 计算消费 token 数量（每次 LLM 调用后立即扣钱）
   * @param message
   */
  private async handleTokenUsage(message: { event: 'token_usage_change', data: { input_tokens: number, output_tokens: number } }) {
    console.log('llm token usage message:', message)
    try {
      const res = await API.base.userCalcLlmTokenCostCreate({
        provider: this.llmInfo.provider || 'siliconflow',
        model: this.llmInfo.model || 'Pro/deepseek-ai/DeepSeek-V3.2',
        inputToken: message.data.input_tokens,
        outputToken: message.data.output_tokens,
      })

      if (res.code === 0) {
        this.mcpWorker?.postMessage({ event: 'change_balance', data: { balance: res.data.balance } })
        // ipcMain.send('mcp:token-usage', { ...res.data })
        ipcSender.mcp.tokenUsage({ ...res.data })
        this.llmInfo.balance = res.data.balance
      }
      else {
        console.error('llm token usage error:', res.msg)
      }
    }
    catch (error) {
      console.error('llm token usage error:', error)
    }
  }

  closeMcpServer() {
    if (this.mcpWorker) {
      this.mcpWorker.kill()
      this.mcpWorker = null
    }
  }

  async restartMcpServer() {
    this.closeMcpServer()
    await this.startMcpServer()
  }
})()

export async function createMcpWindow() {
  const targetWin = getMcpWindow()

  if (targetWin) {
    targetWin.show()
    return
  }

  const win = createWindow({
    roxyWindowId: ROXY_MCP_WINDOW_ID,
    autoHideMenuBar: true,
    width: 460,
    height: 820,
    maxWidth: 640,
    minWidth: 375,
    minHeight: 760,
    // resizable: false,
    // frame: false,
    // alwaysOnTop: false,
    // hasShadow: true,
    // skipTaskbar: true,
    // show: true,
  })

  win.on('close', () => {
    if (!agentUpdater.isInProgress) {
      agentUpdater.stopInterval()
      agentUpdater.checkForUpdates()
    }
    mcpManager.closeMcpServer()
    win.destroy()
  })

  win.loadURL(await getWebEntryUrl('mcp'))
  // win.setShape([])
  // 设置窗口部分点击可穿透
  // win.setIgnoreMouseEvents(true);
  if (!isPackaged) {
    win.webContents.openDevTools()
  }
  handleWindowMove(win)
  win.on('close', async () => {
    win.destroy()
  })
}

export async function closeMcpWindow() {
  const targetWin = getMcpWindow()
  if (targetWin) {
    targetWin.destroy()
  }
}
