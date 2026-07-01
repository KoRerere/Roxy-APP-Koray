import { abortAll } from '@/core/registry/abortRegistry'
import { closeSchedulesDatabase } from '@/database/schedules'
import { schedulerEngine } from '@/schedules/engine'
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

  // 启动定时任务调度引擎（从 SQLite 重载 enabled 任务）。启动失败不阻塞 server。
  try {
    await schedulerEngine.start()
  }
  catch (err: any) {
    console.warn('[mode:agent] scheduler start failed:', err instanceof Error ? err.message : String(err))
  }

  return async function shutdown() {
    console.log('[mode:agent] Shutting down...')
    abortAll()
    await schedulerEngine.stop()
    closeCheckpointer()
    closeConversationsDatabase()
    closeSchedulesDatabase()
  }
}
