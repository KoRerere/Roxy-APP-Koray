import type { AgentMode } from './types'
import type { UtilityProcess } from 'electron'
import { app, utilityProcess } from 'electron'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { getPortPromise } from 'portfinder'
import { API } from '/@/api'
import { getBaseUrl, getGatewayConfig } from '/@/api/getGatewayConfig'
import { ROXY_MCP_WINDOW_ID } from '/@/constants'
import { appConfig } from '/@/constants/appConfig'
import { isPackaged, isProd } from '/@/constants/common'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { mcpRuntimeState } from '/@/modules/mcp/state'
import { store } from '/@/modules/store'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { agentUpdater } from '/@/modules/updater/agentUpdater'
import { getErrorMessage } from '/@/utils'
import { createWindow, getWindowById } from '/@/utils/browser-window'
import { getCommonRequestHeaders } from '/@/utils/common'
import { aliOSS } from '/@/utils/oss'
import { createMcpError } from './errors'
import { mcpEventEmitter } from './event'

export function getMcpWindow() {
  return getWindowById(ROXY_MCP_WINDOW_ID)
}

const electronAppPathEnvKeyMap = {
  home: 'HOME_DIR',
  appData: 'APP_DATA_DIR',
  assets: 'ASSETS_DIR',
  userData: 'USER_DATA_DIR',
  sessionData: 'SESSION_DATA_DIR',
  temp: 'TEMP_DIR',
  exe: 'EXE_PATH',
  module: 'MODULE_PATH',
  desktop: 'DESKTOP_DIR',
  documents: 'DOCUMENTS_DIR',
  downloads: 'DOWNLOADS_DIR',
  music: 'MUSIC_DIR',
  pictures: 'PICTURES_DIR',
  videos: 'VIDEOS_DIR',
  recent: 'RECENT_DIR',
  logs: 'LOGS_DIR',
  crashDumps: 'CRASH_DUMPS_DIR',
} as const satisfies Record<Parameters<typeof app.getPath>[0], string>

function getElectronAppPathEnv(): Record<string, string> {
  return Object.entries(electronAppPathEnvKeyMap).reduce<Record<string, string>>((acc, [pathName, envKey]) => {
    try {
      acc[envKey] = app.getPath(pathName as Parameters<typeof app.getPath>[0])
    }
    catch (error) {
      console.warn(`[mcp] app.getPath(${pathName}) failed:`, getErrorMessage(error))
    }

    return acc
  }, {})
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
  weChatBotToken?: string
}

export const mcpManager = new (class McpManager {
  config: {
    port: number
  } = {
    port: 26580,
  }

  eventEmitter: EventEmitter = new EventEmitter()

  private mcpWorker: UtilityProcess | null = null

  async startMcpServer(agentModel?: AgentMode) {
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

    if (this.mcpWorker) {
      return this.mcpWorker
    }

    // 是否处于开发环境，pnpm dev 启动时，为true，打包后为false
    const isDevelopment = process.env.MODE === 'development'

    const OPENAPI_SCRIPT_PATH = isDevelopment ? path.join(import.meta.dirname, './openapiMcp.mjs') : appConfig.openapiMcpBinPath

    const PLAYWRIGHT_SCRIPT_PATH = isDevelopment ? path.join(import.meta.dirname, './playwrightMcp.mjs') : appConfig.playwrightMcpBinPath

    const AGENT_ENTRY_SCRIPT = isDevelopment ? path.join(import.meta.dirname, './agent.mjs') : appConfig.agentBinPath

    const electronAppPathEnv = getElectronAppPathEnv()

    const CHECKPOINT_DIR = path.join(agentUpdater.agentDir, 'checkpoints')

    // 提供流式输出的服务需要的端口
    const port = await getPortPromise({ port: this.config.port })

    const ROXY_SERVER_URL = getBaseUrl() || await getGatewayConfig()

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

    const env = {
      ...process.env,
      ENV_TYPE: isDevelopment ? 'development' : (isProd ? 'production' : 'staging'),

      ROXY_USER_TOKEN: store.token,
      ROXY_SERVER_URL,
      ROXY_SERVER_HEADERS: JSON.stringify(getCommonRequestHeaders()),

      // openapi 和 playwright mcp 执行脚本路径，已经相关参数。
      OPENAPI_SCRIPT_PATH,
      ROXY_API_KEY: store.apiKey,
      ROXY_API_HOST: `http://127.0.0.1:${store.apiPort}`,
      PLAYWRIGHT_SCRIPT_PATH,

      AGENT_SCRIPT_PATH: AGENT_ENTRY_SCRIPT,

      CHECKPOINT_DIR,

      // agent 的工作目录
      AGENT_WORK_DIR: agentUpdater.agentDir,
      // ROXY_AGENT_PACKAGE_ROOT,

      ROXY_SERVER_PORT: String(port),
      ROXY_USER_ID: String(store.userId),
      ROXY_WORKSPACE_ID: String(store.workspaceId),

      // 语言
      SYSTEM_LANGUAGE: store.language,

      ...electronAppPathEnv,
      SKILLS_DIR: agentUpdater.agentDir,

      // // 启动模式：启用 IM 时以 im 模式运行，否则以 agent 模式运行（两者互斥，只有一个进程）
      ROXY_MODE: agentModel || 'agent',
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
      execArgv: [isProd ? '--inspect=20580' : '--inspect=20581', '--experimental-network-inspection', '--experimental-strip-types'],
      stdio: 'pipe',
    })

    this.config.port = port
    this.mcpWorker = worker

    // 无论开发/生产环境，worker 退出时都要清空引用，确保下次能重新启动
    worker.once('exit', (code: number) => {
      console.log(`[MCP Worker Exit] code=${code}`)
      this.mcpWorker = null
    })

    if (isDevelopment || !isProd) {
      this.attachMcpWorkerDiagnostics(worker, AGENT_ENTRY_SCRIPT)
    }

    worker.on('message', async (message) => {
      console.log('[MCP Worker Message]', message)
      const event = message?.event
      switch (event) {
        case 'save_chat_message':
          this.handleSaveChatMessage(message)
          break
      }
    })

    mcpEventEmitter.on('baseUrlChanged', (baseUrl) => {
      worker.postMessage({ data: { baseUrl } })
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

export async function createMcpWindow(scene?: string, skill?: string) {
  // 用 encodeURIComponent 而非 URLSearchParams：后者会把空格编码成 `+`，
  // 而 vue-router 解析 query 时用 decodeURIComponent，不会把 `+` 还原成空格。
  const parts: string[] = []
  if (scene)
    parts.push(`scene=${encodeURIComponent(scene)}`)
  if (skill)
    parts.push(`skill=${encodeURIComponent(skill)}`)
  const query = parts.join('&')
  const suffix = query ? `?${query}` : ''

  const targetWin = getMcpWindow()

  if (targetWin) {
    if (query) {
      targetWin.loadURL(`${await getWebEntryUrl('mcp')}${suffix}`)
    }
    targetWin.show()
    return
  }

  const win = createWindow({
    roxyWindowId: ROXY_MCP_WINDOW_ID,
    autoHideMenuBar: true,
    width: 1000,
    height: 720,
    minWidth: 1000,
    minHeight: 720,
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

  win.loadURL(`${await getWebEntryUrl('mcp')}${suffix}`)
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
