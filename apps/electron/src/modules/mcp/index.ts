import type { UserGetLlmInfoListData } from '@roxy/backend-api'
import type { UtilityProcess } from 'electron'
import { app, utilityProcess } from 'electron'
import path from 'node:path'
import { getPortPromise } from 'portfinder'
import { API } from '/@/api'
import { ROXY_MCP_WINDOW_ID } from '/@/constants'
import { appConfig } from '/@/constants/appConfig'
import { appCliStartArgs, isDev, isPackaged, isProd } from '/@/constants/common'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { mcpRuntimeState } from '/@/modules/mcp/state'
import { store } from '/@/modules/store'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { agentUpdater } from '/@/modules/updater/agentUpdater'
import { getErrorMessage } from '/@/utils'
import { createWindow, getWindowById } from '/@/utils/browser-window'
import { aliOSS } from '/@/utils/oss'
import { ipcSender } from '../ipc/sender'
import { createMcpError } from './errors'

export function getMcpWindow() {
  return getWindowById(ROXY_MCP_WINDOW_ID)
}

export interface McpImConfigPayload {
  enableIM?: boolean
  larkAppId?: string
  larkAppSecret?: string
  larkEnvironment?: 'lark' | 'feishu'
  larkAllowedChatIds?: string
  tgBotToken?: string
  tgAllowedChatIds?: string
  slackBotToken?: string
  slackSigningSecret?: string
  slackAppToken?: string
  slackAllowedUserIds?: string
  slackAllowedChannelIds?: string
  discordBotToken?: string
  discordAllowedUserIds?: string
  discordAllowedChannelIds?: string
  discordAllowedGuildIds?: string
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

    // 获取 RoxyClaw 配置
    let imConfigPayload: McpImConfigPayload | undefined
    try {
      const roxyClawConfig = await API.base.userGetRoxyClawList()
      if (roxyClawConfig.code === 0 && roxyClawConfig.data) {
        const data = roxyClawConfig.data
        console.log('roxyClawConfig', roxyClawConfig.data)
        imConfigPayload = {
          enableIM: data.enabled === 1,
          larkAppId: data.lark_app_id,
          larkAppSecret: data.lark_app_secret,
          larkEnvironment: data.lark_environment as 'lark' | 'feishu',
          larkAllowedChatIds: data.lark_allowed_chat_ids,
          tgBotToken: data.tg_bot_token,
          tgAllowedChatIds: data.tg_allowed_chat_ids,
          slackBotToken: data.slack_bot_token,
          slackSigningSecret: data.slack_signing_secret,
          slackAppToken: data.slack_app_token,
          slackAllowedUserIds: data.slack_allowed_user_ids,
          slackAllowedChannelIds: data.slack_allowed_channel_ids,
          discordBotToken: data.discord_bot_token,
          discordAllowedUserIds: data.discord_allowed_user_ids,
        }
        console.log('RoxyClaw config loaded from backend:', imConfigPayload)
      }
    }
    catch (error) {
      console.error('[mcp] Failed to load RoxyClaw config:', error)
    }

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

    // 获取系统下载目录，提供给 agent 作为默认下载路径
    const DOWNLOADS_DIR = app.getPath('downloads')

    const CHECKPOINT_DIR = path.join(agentUpdater.agentDir, 'checkpoints')

    // 提供流式输出的服务需要的端口
    const port = await getPortPromise({ port: this.config.port })

    // 启动前校验：验证本地脚本与远端 sha512 是否匹配，不匹配则自动重新下载
    if (!isDevelopment) {
      try {
        const corrupted = await agentUpdater.checkScriptIntegrity()
        if (corrupted.length > 0) {
          console.warn('[mcp] 检测到脚本异常，开始自动修复:', corrupted)
          await agentUpdater.repairScripts(corrupted)
          // 修复后再次校验，确保下载后的文件也正常
          const stillCorrupted = await agentUpdater.checkScriptIntegrity()
          if (stillCorrupted.length > 0) {
            console.error('[mcp] 脚本修复后仍校验失败:', stillCorrupted)
            throw createMcpError('script_repair_failed')
          }
        }
      }
      catch (error) {
        // 已抛出的业务错误直接抛出，其余错误记录日志但不阻断启动
        if (error instanceof Error && error.name === 'McpError') {
          throw error
        }
        console.error('[mcp] 脚本完整性校验异常:', getErrorMessage(error))
      }
    }

    console.info('isProd', isProd)

    const env = {
      ...process.env,
      ENV_TYPE: isDevelopment ? 'development' : (isProd ? 'production' : 'staging'),
      // LLM_BASE_URL: llmInfo.data.baseUrl,

      ROXY_USER_TOKEN: store.token,

      // openapi 和 playwright mcp 执行脚本路径，已经相关参数。
      OPENAPI_SCRIPT_PATH,
      ROXY_API_KEY: store.apiKey,
      ROXY_API_HOST: `http://127.0.0.1:${store.apiPort}`,
      PLAYWRIGHT_SCRIPT_PATH,

      CHECKPOINT_DIR,

      // agent 的工作目录
      ROXY_AGENT_PACKAGE_ROOT,

      ROXY_SERVER_PORT: String(port),
      ROXY_USER_ID: String(store.userId),
      ROXY_WORKSPACE_ID: String(store.workspaceId),

      // 语言
      SYSTEM_LANGUAGE: store.language,

      // 是否处于开发环境，pnpm dev 启动时，为true，打包后为false
      // DEVELOPMENT: isDevelopment ? 'true' : 'false',

      DOWNLOADS_DIR,
      SKILLS_DIR: agentUpdater.agentDir,

      // 启动模式：启用 IM 时以 im 模式运行，否则以 agent 模式运行（两者互斥，只有一个进程）
      ROXY_MODE: imConfigPayload?.enableIM ? 'im' : 'agent',

      ENABLE_IM: imConfigPayload?.enableIM,
      FEISHU_APP_ID: imConfigPayload?.larkAppId,
      FEISHU_APP_SECRET: imConfigPayload?.larkAppSecret,
      FEISHU_ENVIRONMENT: imConfigPayload?.larkEnvironment,
      FEISHU_ALLOWED_USER_IDS: imConfigPayload?.larkAllowedChatIds,
      TELEGRAM_BOT_TOKEN: imConfigPayload?.tgBotToken,
      TELEGRAM_ALLOWED_CHAT_IDS: imConfigPayload?.tgAllowedChatIds,
      SLACK_BOT_TOKEN: imConfigPayload?.slackBotToken,
      SLACK_SIGNING_SECRET: imConfigPayload?.slackSigningSecret,
      SLACK_APP_TOKEN: imConfigPayload?.slackAppToken,
      SLACK_ALLOWED_USER_IDS: imConfigPayload?.slackAllowedUserIds,
      SLACK_ALLOWED_CHANNEL_IDS: imConfigPayload?.slackAllowedChannelIds,
      DISCORD_BOT_TOKEN: imConfigPayload?.discordBotToken,
      DISCORD_ALLOWED_USER_IDS: imConfigPayload?.discordAllowedUserIds,
      // ROXY_DOCS_MCP_URL: import.meta.env.VITE_ROXY_DOCS_MCP_URL,
    }

    // 清理和验证环境变量 - 只保留有效的值
    Object.keys(env).forEach((key) => {
      const value = env[key]
      // 过滤掉 null 和 undefined，避免转换成字符串 "null" 或 "undefined"
      if (value == null) {
        delete env[key]
      }
      else if (typeof value !== 'string') {
        // 将其他类型转换为字符串
        env[key] = String(value)
      }
    })

    const worker = utilityProcess.fork(AGENT_ENTRY_SCRIPT, [], {
      env,
      execArgv: appCliStartArgs['roxy-log-level'] === 'debug' || isDev ? ['--inspect=20580', '--experimental-network-inspection'] : [],
      stdio: 'pipe',
    })

    this.config.port = port
    this.mcpWorker = worker

    // 无论开发/生产环境，worker 退出时都要清空引用，确保下次能重新启动
    worker.once('exit', (code: number) => {
      console.log(`[MCP Worker Exit] code=${code}`)
      this.mcpWorker = null
    })

    if (isDevelopment) {
      this.attachMcpWorkerDiagnostics(worker, AGENT_ENTRY_SCRIPT)
    }

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

    return worker
  }

  /**
   * 为 MCP utility 子进程挂接 stderr/stdout（同时镜像到主进程与保留尾部缓冲），并在异常退出时打印可诊断上下文。
   */
  private attachMcpWorkerDiagnostics(worker: UtilityProcess, agentEntryScript: string) {
    const streamTailMax = 48_000
    let stderrTail = ''
    let stdoutTail = ''

    worker.stdout?.setEncoding('utf8')
    worker.stdout?.on('data', (chunk: string) => {
      process.stdout.write(chunk)
      stdoutTail = (stdoutTail + chunk).slice(-streamTailMax)
    })

    worker.stderr?.setEncoding('utf8')
    worker.stderr?.on('data', (chunk: string) => {
      process.stderr.write(chunk)
      stderrTail = (stderrTail + chunk).slice(-streamTailMax)
    })

    worker.once('spawn', () => {
      console.log('[MCP Worker Spawn]', { pid: worker.pid, script: agentEntryScript })
    })

    worker.on('error', (type, location, report) => {
      console.error('[MCP Worker Error]', { type, location, report })
    })

    worker.on('exit', (code: number) => {
      const failed = code !== 0
      const detail = {
        code,
        script: agentEntryScript,
        stderrTail: stderrTail || '(无捕获输出)',
        stdoutTail: stdoutTail || '(无捕获输出)',
      }
      if (failed) {
        console.error('[MCP Worker Exit]', detail)
      }
      else {
        console.log('[MCP Worker Exit]', { code, script: agentEntryScript })
      }
      // mcpWorker 已由外层 once('exit') 清空，这里仅做日志
    })
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

  isWorkerConnected() {
    return !!this.mcpWorker
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
    width: 960,
    height: 624,
    minWidth: 960,
    minHeight: 624,
    // resizable: false,
    // frame: false,
    // alwaysOnTop: false,
    // hasShadow: true,
    // skipTaskbar: true,
    // show: true,
  })

  win.on('close', () => {
    mcpRuntimeState.setMcpWindowOpen(false)
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
