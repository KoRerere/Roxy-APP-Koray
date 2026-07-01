import type { FileCollectorStore } from './fileCollector'
import { FilesystemBackend, LocalShellBackend } from 'deepagents'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { env } from '@/config'
import { createBrowserRecordingMiddleware, createDisableSubagentMiddleware, createRoxySkillsMiddleware, createToolErrorFallbackMiddleware } from './middlewares/index.js'
import { loadSkillFileTools } from './tools/skill'

const DEEPAGENT_ROOT_DIR = process.cwd()

export interface DeepAgentRuntime {
  backend: any
  middleware: any[]
  tools: any[]
  interruptOn: Record<string, any>
  destroy: () => Promise<void>
}

export function ensureWorkspaceDir(conversationId?: string): string {
  const safeConversationId = conversationId || randomUUID().toString()
  const workspaceDir = path.join(env.CHECKPOINT_DIR, 'agent-workspaces', safeConversationId)
  fs.mkdirSync(workspaceDir, { recursive: true })
  return workspaceDir
}

export async function createDeepAgentRuntime(options?: {
  allowExecution?: boolean
  workspaceDir?: string
  fileCollector?: FileCollectorStore
  browserRecording?: boolean
  conversationId?: string
  /** worker ID，透传给录制事件用于区分来源 */
  workerId?: string
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

  // 中间件顺序：数组前者为外层。BrowserRecording 必须位于 ToolErrorFallback 内层
  // （排在它之后），才能最先捕获工具原始异常并记录 success=false，rethrow 后由外层兜底。
  const middleware = [
    createRoxySkillsMiddleware(),
    createDisableSubagentMiddleware(),
    createToolErrorFallbackMiddleware(),
  ]
  if (options?.browserRecording && options?.conversationId) {
    middleware.push(createBrowserRecordingMiddleware({
      conversationId: options.conversationId,
      workerId: options.workerId,
    }))
  }

  return {
    backend,
    middleware,
    tools: [...loadSkillFileTools],
    interruptOn: {
      read_file: { allowedDecisions: ['approve', 'reject'] },
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
