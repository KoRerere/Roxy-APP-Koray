import type { FileCollectorStore } from './fileCollector'
import { FilesystemBackend, LocalShellBackend } from 'deepagents'
import { createBrowserOperationLogMiddleware, createDisableSubagentMiddleware, createRoxySkillsMiddleware, createToolErrorFallbackMiddleware } from './middlewares/index.js'
import { createRoxyFilesystemMiddleware } from './tools/filesystem'
import { loadSkillFileTools } from './tools/skill'

const DEEPAGENT_ROOT_DIR = process.cwd()

export interface DeepAgentRuntime {
  backend: any
  middleware: any[]
  tools: any[]
  interruptOn: Record<string, any>
  destroy: () => Promise<void>
}

export async function createDeepAgentRuntime(options?: {
  allowExecution?: boolean
  workspaceDir?: string
  fileCollector?: FileCollectorStore
  browserOperationLogging?: boolean
  conversationId?: string
  /** worker ID，透传给操作日志事件用于区分来源 */
  workerId?: string
  /** 任务监控面板中的本次 agent task ID；传入后即使不录制 browser ops 也会安装浏览器工具监听。 */
  taskMonitorTaskId?: string
  /** 是否禁用 deepagents 默认 task subagent 工具，默认禁用 */
  disableSubagentTool?: boolean
}): Promise<DeepAgentRuntime> {
  const allowExecution = options?.allowExecution === true
  const rootDir = options?.workspaceDir ?? DEEPAGENT_ROOT_DIR
  const backend = allowExecution
    ? await LocalShellBackend.create({
        rootDir,
        timeout: 120,
        maxOutputBytes: 100_000,
        inheritEnv: true,
      })
    : new FilesystemBackend({
        rootDir,
      })

  // 中间件顺序：数组前者为外层。BrowserOperationLog 必须位于 ToolErrorFallback 内层
  // （排在它之后），才能最先捕获工具原始异常并记录 success=false，rethrow 后由外层兜底。
  const middleware = [
    createRoxySkillsMiddleware(),
    createRoxyFilesystemMiddleware({ rootDir, fileCollector: options?.fileCollector }),
    createToolErrorFallbackMiddleware(),
  ]
  if (options?.disableSubagentTool !== false) {
    middleware.splice(1, 0, createDisableSubagentMiddleware())
  }
  const shouldInstallBrowserMiddleware = Boolean(
    (options?.browserOperationLogging && options?.conversationId) || options?.taskMonitorTaskId,
  )
  if (shouldInstallBrowserMiddleware) {
    middleware.push(createBrowserOperationLogMiddleware({
      conversationId: options?.conversationId,
      workerId: options?.workerId,
      taskId: options?.taskMonitorTaskId,
    }))
  }

  return {
    backend,
    middleware,
    tools: [...loadSkillFileTools],
    interruptOn: {
      execute: { allowedDecisions: ['approve', 'reject'] },
    } as const,
    destroy: async () => {
      const closable = backend as { close?: () => Promise<void> | void }
      if (typeof closable.close === 'function') {
        await closable.close()
      }
    },
  }
}
