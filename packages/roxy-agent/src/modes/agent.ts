import { abortAll } from '@/core/registry/abortRegistry'
import { startServer } from '../app'
import { closeDatabase as closeConversationsDatabase } from '../database/conversations'
import { closeCheckpointer } from '../deepagents/sqlite-checkpointer'

/**
 * Agent 模式：启动 HTTP 服务器，暴露 chat API 给前端调用。
 * 不启动任何 IM 适配器。
 */
export async function runAgentMode(): Promise<() => Promise<void>> {
  console.log('[mode:agent] Starting HTTP agent server...')
  await startServer()

  return async function shutdown() {
    console.log('[mode:agent] Shutting down...')
    abortAll()
    closeCheckpointer()
    closeConversationsDatabase()
  }
}
