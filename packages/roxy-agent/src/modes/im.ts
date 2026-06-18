import { abortAll } from '@/core/registry/abortRegistry'
import { closeDatabase as closeConversationsDatabase } from '../database/conversations'
import { closeCheckpointer } from '../deepagents/sqlite-checkpointer'
import { startIMServiceIfEnabled } from '../im'

/**
 * IM 模式（RoxyClaw）：无窗口后台运行，连接 Feishu/Telegram 等 IM 平台。
 * 不启动 HTTP 服务器。
 */
export async function runIMMode(): Promise<() => Promise<void>> {
  console.log('[mode:im] Starting IM service...')
  await startIMServiceIfEnabled()

  return async function shutdown() {
    console.log('[mode:im] Shutting down...')
    abortAll()
    closeCheckpointer()
    closeConversationsDatabase()
  }
}
