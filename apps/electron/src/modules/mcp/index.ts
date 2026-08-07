import type { UtilityProcess } from 'electron'
import { app, utilityProcess } from 'electron'
import path from 'node:path'
import { getPortPromise } from 'portfinder'
import { API } from '/@/api'
import { getBaseUrl, getGatewayConfig } from '/@/api/getGatewayConfig'
import { ROXY_MCP_WINDOW_ID } from '/@/constants'
import { appConfig } from '/@/constants/appConfig'
import { isPackaged, isProd } from '/@/constants/common'
import { getWebEntryUrl } from '/@/modules/app/mainWindow'
import { openAPIServer } from '/@/modules/openapi'
import { store } from '/@/modules/store'
import { handleWindowMove } from '/@/modules/sync-control/actionBar'
import { agentUpdater } from '/@/modules/updater/agentUpdater'
import { getErrorMessage } from '/@/utils'
import { createWindow, getWindowById } from '/@/utils/browser-window'
import { getCommonRequestHeaders } from '/@/utils/common'
import { createMcpError } from './errors'
import { mcpEventEmitter } from './event'

export function getMcpWindow() {
  return getWindowById(ROXY_MCP_WINDOW_ID)
}

const fallbackAgentVersion = process.env.MODE === 'development'
  ? process.env.AI_AGENT_VERSION_DEV
  : process.env.AI_AGENT_VERSION_PROD

function getMcpAppTitle() {
  return import.meta.env.VITE_APP_TITLE || (isProd ? 'RoxyBrowser' : 'RoxyBrowserDev')
}

async function getCurrentAgentVersion() {
  if (process.env.MODE === 'development') {
    return fallbackAgentVersion || '0.0.0'
  }

  try {
    const localVersionInfo = await agentUpdater.getLocalVersionInfo()
    if (localVersionInfo.exists)
      return localVersionInfo.version
  }
  catch (error) {
    console.warn('[mcp] get local agent version failed:', getErrorMessage(error))
  }

  return fallbackAgentVersion || '0.0.0'
}

async function getMcpAgentTitle() {
  const agentVersion = await getCurrentAgentVersion()
  const appTitle = getMcpAppTitle()
  return `${appTitle} AI Agent v${agentVersion}`
}

function normalizeAgentConsoleRoute(route = 'agent-console') {
  const normalizedRoute = route.replace(/^\/+/, '').replace(/\/+$/, '')
  return normalizedRoute || 'agent-console'
}

let suppressMcpWindowCloseUpdateCheck = false

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

interface StartMcpServerOptions {
  skipScriptIntegrityCheck?: boolean
}

interface CloseMcpServerOptions {
  waitForExit?: boolean
}

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

export const mcpManager = new (class McpManager {
  config: {
    port: number
  } = {
    port: isProd ? 26580 : 26581,
  }

  private mcpWorker: UtilityProcess | null = null
  private startupPromise: Promise<UtilityProcess> | null = null
  private roxyClawStartupPromise: Promise<boolean> | null = null
  private closingPromise: Promise<void> | null = null

  async startMcpServer(options: StartMcpServerOptions = {}) {
    if (this.mcpWorker)
      return this.mcpWorker

    if (this.startupPromise)
      return this.startupPromise

    this.startupPromise = this.startMcpServerInner(options).finally(() => {
      this.startupPromise = null
    })

    return this.startupPromise
  }

  private async startMcpServerInner(options: StartMcpServerOptions = {}) {
    await this.waitForCloseInProgress()
    await agentUpdater.waitForDownloadIfPending().catch((error) => {
      console.error('[mcp] wait pending agent download error:', getErrorMessage(error))
    })

    if (this.mcpWorker) {
      return this.mcpWorker
    }

    // 是否处于开发环境，pnpm dev 启动时，为true，打包后为false
    const isDevelopment = process.env.MODE === 'development'

    const AGENT_SCRIPT_PATH = isDevelopment ? path.join(import.meta.dirname, './agent.mjs') : appConfig.agentBinPath

    const electronAppPathEnv = getElectronAppPathEnv()

    const CHECKPOINT_DIR = path.join(agentUpdater.agentDir, 'checkpoints')

    // 提供流式输出的服务需要的端口
    const port = await getPortPromise({ port: this.config.port })

    const ROXY_SERVER_URL = getBaseUrl() || await getGatewayConfig()

    // 启动前校验：验证本地脚本与远端 sha512 是否匹配，不匹配则自动重新下载
    if (!isDevelopment && !options.skipScriptIntegrityCheck) {
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

    const env: Record<string, any> = {
      ...process.env,
      ENV_TYPE: isDevelopment ? 'development' : (isProd ? 'production' : 'staging'),

      ROXY_USER_TOKEN: store.token,
      ROXY_SERVER_URL,
      ROXY_SERVER_HEADERS: JSON.stringify(getCommonRequestHeaders()),

      ROXY_API_KEY: store.apiKey,
      ROXY_API_HOST: `http://127.0.0.1:${store.apiPort}`,

      AGENT_SCRIPT_PATH,

      // agent 数据根目录（新存储结构的唯一锚点）。
      // 旧的 CHECKPOINT_DIR / AGENT_WORK_DIR / SKILLS_DIR 暂时保留，作为迁移源与回退，
      // 待迁移器与 agentPaths 全面接管后（见 docs/agent-data-directory-design.md 的 P5）移除。
      // ROXY_AGENT_HOME: appConfig.agentDataDir,

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

      // 统一以 agent 进程运行，RoxyClaw 作为同一进程内的 IM 能力按需启动。
      ROXY_MODE: 'agent',
    }

    // 移除从宿主机 process.env 透传进来的 Anthropic SDK 鉴权变量。
    // agent 创建 ChatAnthropic 时已显式传入 apiKey（即 x-api-key），
    // 但 @anthropic-ai/sdk 会在 authToken 未传时回退读取 ANTHROPIC_AUTH_TOKEN，
    // 一旦宿主机设置了该变量，就会在 x-api-key 之外额外注入 Authorization: Bearer，
    // 导致 /v1/messages 请求同时携带两个鉴权头。这里统一清掉，确保只用 x-api-key。
    delete env.ANTHROPIC_AUTH_TOKEN
    delete env.ANTHROPIC_API_KEY

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

    const worker = utilityProcess.fork(AGENT_SCRIPT_PATH, [], {
      env,
      execArgv: [isProd ? '--inspect=20580' : '--inspect=20581', '--experimental-network-inspection', '--experimental-strip-types'],
      stdio: 'pipe',
    })

    this.config.port = port
    this.mcpWorker = worker
    agentUpdater.setRunningAgentVersion(await getCurrentAgentVersion())

    // 无论开发/生产环境，worker 退出时都要清空引用，确保下次能重新启动
    worker.once('exit', (code: number) => {
      console.log(`[MCP Worker Exit] code=${code}`)
      if (this.mcpWorker === worker) {
        this.mcpWorker = null
      }
      if (!this.mcpWorker)
        agentUpdater.setRunningAgentVersion(null)
    })

    this.attachMcpWorkerDiagnostics(worker, AGENT_SCRIPT_PATH)

    worker.on('message', async (message) => {
      console.log('[MCP Worker Message]', message)
      // const event = message?.event
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

  async closeMcpServer(options: CloseMcpServerOptions = {}) {
    const worker = this.mcpWorker
    this.startupPromise = null
    if (!worker) {
      if (options.waitForExit)
        await this.waitForCloseInProgress()
      return
    }

    this.mcpWorker = null

    const exitPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 5000)
      worker.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
      worker.once('error', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
    const closingPromise = exitPromise.finally(() => {
      if (this.closingPromise === closingPromise)
        this.closingPromise = null
    })
    this.closingPromise = closingPromise

    worker.kill()
    if (options.waitForExit)
      await this.closingPromise
  }

  private async waitForCloseInProgress() {
    const closingPromise = this.closingPromise
    if (closingPromise)
      await closingPromise
  }

  async startRoxyClawIfEnabled(source = 'background', options: { ensureOpenAPIServer?: boolean } = {}) {
    if (this.roxyClawStartupPromise) {
      return this.roxyClawStartupPromise
    }

    this.roxyClawStartupPromise = this.startRoxyClawIfEnabledInner(source, options).finally(() => {
      this.roxyClawStartupPromise = null
    })

    return this.roxyClawStartupPromise
  }

  private async startRoxyClawIfEnabledInner(source: string, options: { ensureOpenAPIServer?: boolean }) {
    if (!store.token) {
      console.info(`[mcp] Skip RoxyClaw ${source} startup: user is not logged in.`)
      return false
    }

    try {
      const result = await API.base.userGetRoxyClawList()
      if (result.code !== 0 || result.data?.enabled !== 1) {
        console.info(`[mcp] Skip RoxyClaw ${source} startup: disabled by remote config.`)
        return false
      }

      if (options.ensureOpenAPIServer !== false) {
        await openAPIServer.start()
      }

      if (!store.apiPort || store.apiPort === -1) {
        console.warn(`[mcp] Skip RoxyClaw ${source} startup: OpenAPI server is not enabled.`)
        return false
      }

      await this.startMcpServer()
      console.info(`[mcp] Agent server started for RoxyClaw from ${source} remote config.`)
      return true
    }
    catch (error) {
      console.error(`[mcp] Failed to start RoxyClaw from ${source} remote config:`, error)
      return false
    }
  }
})()

export async function createMcpWindow(route?: string) {
  return createMcpWindowWithRoute(route)
}

export async function createMcpWindowWithRoute(route = 'agent-console') {
  const agentTitle = await getMcpAgentTitle()
  const targetWin = getMcpWindow()

  if (targetWin) {
    if (targetWin.isMinimized()) {
      targetWin.restore()
    }
    targetWin.show()
    targetWin.focus()
    targetWin.setTitle(agentTitle)
    const normalizedRoute = normalizeAgentConsoleRoute(route)
    if (normalizedRoute !== 'agent-console') {
      targetWin.webContents.send('IPC-bridge', {
        name: 'mcp:navigate',
        payload: [`/${normalizedRoute}`],
      })
    }
    return
  }

  const win = createWindow({
    roxyWindowId: ROXY_MCP_WINDOW_ID,
    autoHideMenuBar: true,
    width: 1440,
    height: 926,
    minWidth: 944,
    minHeight: 750,
    // resizable: false,
    // frame: false,
    // alwaysOnTop: false,
    // hasShadow: true,
    // skipTaskbar: true,
    // show: true,
  })

  win.setTitle(agentTitle)
  win.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  win.once('closed', () => {
    if (!suppressMcpWindowCloseUpdateCheck) {
      mcpManager.closeMcpServer().catch((error) => {
        console.error('[mcp] close MCP server on MCP window close error:', error)
      })
    }
  })

  win.loadURL(await getWebEntryUrl(normalizeAgentConsoleRoute(route)))
  // win.setShape([])
  // 设置窗口部分点击可穿透
  // win.setIgnoreMouseEvents(true);
  if (!isPackaged) {
    win.webContents.openDevTools()
  }
  handleWindowMove(win)
}

export async function closeMcpWindow() {
  const targetWin = getMcpWindow()
  if (targetWin) {
    targetWin.destroy()
  }
}

async function destroyMcpWindowForRestart() {
  const targetWin = getMcpWindow()
  if (!targetWin || targetWin.isDestroyed())
    return

  suppressMcpWindowCloseUpdateCheck = true
  try {
    await new Promise<void>((resolve) => {
      targetWin.once('closed', () => resolve())
      targetWin.destroy()
    })
  }
  finally {
    suppressMcpWindowCloseUpdateCheck = false
  }
}

export async function restartMcpForAgentUpdate(route = 'agent-console') {
  if (agentUpdater.isInProgress)
    throw createMcpError('agent_update_in_progress', 'AI Agent 更新资源下载中，请稍后再试')

  agentUpdater.clearUpdateMessageData()
  await mcpManager.closeMcpServer({ waitForExit: true })
  await agentUpdater.checkForUpdates({
    allowDownload: true,
    throwOnDownloadFailure: true,
  })
  await destroyMcpWindowForRestart()
  await mcpManager.startMcpServer({
    skipScriptIntegrityCheck: true,
  })
  agentUpdater.clearUpdateMessageData()
  await createMcpWindowWithRoute(route)
}
