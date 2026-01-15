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
import { createWindow, getWindowById } from '/@/utils/browser-window'

export function getMcpWindow() {
  return getWindowById(ROXY_MCP_WINDOW_ID)
}

export const mcpManager = new (class McpManager {
  config: {
    port: number
  } = {
    port: 26580,
  }

  mcpWorker: UtilityProcess | null = null

  async startMcpServer() {
    const llmInfo = await API.base.userGetLlmInfoList({})

    if (llmInfo.code !== 0 || !llmInfo.data) {
      return
    }

    if (this.mcpWorker) {
      return this.mcpWorker
    }

    const CHECKPOINT_DIR = path.join(app.getPath('userData'), 'orchestrator', 'checkpoints')
    const CHAT_LOGS_DIR = path.join(app.getPath('userData'), 'orchestrator', 'chat-logs')
    const USER_MESSAGES_MAP_DIR = path.join(app.getPath('userData'), 'orchestrator', 'user-messages-map')
    const AI_MESSAGES_LOGS_DIR = path.join(app.getPath('userData'), 'orchestrator', 'ai-messages-logs')

    await fs.mkdir(CHECKPOINT_DIR, { recursive: true })
    await fs.mkdir(CHAT_LOGS_DIR, { recursive: true })
    await fs.mkdir(USER_MESSAGES_MAP_DIR, { recursive: true })
    await fs.mkdir(AI_MESSAGES_LOGS_DIR, { recursive: true })
    // 提供流式输出的服务需要的端口
    const port = await getPortPromise({ port: this.config.port })
    const worker = utilityProcess.fork(path.join(import.meta.dirname, './orchestrator.mjs'), [], {
      env: {
        ...process.env,
        PORT: String(port),
        LLM_PROVIDER: 'siliconflow',
        OPENROUTER_API_KEY: 'xxxx',
        OPENROUTER_MODEL: 'deepseek/deepseek-v3.2',
        SITE_URL: 'http://localhost:3000',
        SITE_NAME: 'Orchestrator',
        // weihan
        // SILICONFLOW_API_KEY: 'sk-uripdpnveznviklknsolooipdporoszfuihtgygsnbksnboy',
        // SILICONFLOW_PROVIDER_BASE_URL: 'https://api.siliconflow.cn/v1',
        // SILICONFLOW_MODEL: 'Pro/deepseek-ai/DeepSeek-V3.2',

        // huar
        // @ts-ignore
        SILICONFLOW_API_KEY: 'sk-wxnwfldyelnxcdcanjotibnlxaunqlqwipxxvijcjuaintjz',
        SILICONFLOW_PROVIDER_BASE_URL: 'https://api.siliconflow.cn/v1',
        SILICONFLOW_MODEL: 'Pro/deepseek-ai/DeepSeek-V3.2',

        SILICONFLOW_THINKING_BUDGET: '4096',
        DEBUG: 'false',
        MAX_TURNS: '20',
        CONTEXT_MESSAGE_LIMIT: '15',
        WORKER_CONTEXT_LIMIT: '0',
        PROMPTS_LANGUAGE: 'zh',
        ROXYBROWSER_MODEL: 'gemini-3-pro-high',
        ROXYBROWSER_API_KEY: 'sk-IlYgJGmZE2bI9m6sJmvBVY2ycjoCGI4EH8CqNB16ep3Yh5dx',

        // opanapi 执行脚本
        OPENAPI_SCRIPT_PATH: process.env.MODE === 'development' ? path.join(import.meta.dirname, './openapiMcp.mjs') : path.join(appConfig.unpackedFilePath, './dist/openapiMcp.mjs'),
        ROXY_API_KEY: store.apiKey,
        ROXY_API_HOST: `http://127.0.0.1:${store.apiPort}`,

        // playwright
        PLAYWRIGHT_SCRIPT_PATH: process.env.MODE === 'development' ? path.join(import.meta.dirname, './playwrightMcp.mjs') : path.join(appConfig.unpackedFilePath, './dist/playwrightMcp.mjs'),

        // 对话上下文存放目录
        CHECKPOINT_DIR,

        // sse 流存放目录
        CHAT_LOGS_DIR,

        // 对话映射关系存放目录
        USER_MESSAGES_MAP_DIR,

        // AI 消息事件日志存放目录
        AI_MESSAGES_LOGS_DIR,
        MESSAGE_MAPPING_DIR: USER_MESSAGES_MAP_DIR,
        ...llmInfo.data,
      },
      execArgv: appCliStartArgs['roxy-log-level'] === 'debug' || isDev ? [`--inspect=20580`] : [],
    })

    this.config.port = port
    this.mcpWorker = worker
    worker.on('message', (message) => {
      console.log('[MCP Worker Message]', message)
    })
    worker.on('exit', (code?: number, signal?: string) => {
      console.log(`[MCP Worker Exit] code: ${code}, signal: ${signal}`)
      this.mcpWorker = null
    })

    return worker
  }

  closeMcpServer() {
    if (this.mcpWorker) {
      this.mcpWorker.kill()
      this.mcpWorker = null
    }
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
    width: 640,
    height: 900,
    autoHideMenuBar: true,
    // maxWidth: 750,
    // resizable: false,
    // frame: false,
    // alwaysOnTop: false,
    // hasShadow: true,
    // skipTaskbar: true,
    // show: true,
  })

  win.loadURL(await getWebEntryUrl('#/mcp'))
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
