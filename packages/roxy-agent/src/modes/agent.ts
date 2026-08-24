import { installConversationRunStatePersistence, recoverInterruptedConversationRuns } from '@/core/agent-events/conversationRunState'
import { markExited, markStarted } from '@/core/exitState'
import { mcpManager } from '@/core/mcp/mcpManager'
import { installProcessFaultGuards } from '@/core/processFaultGuard'
import { abortAll } from '@/core/registry/abortRegistry'
import { executionCenter } from '@/core/registry/executionCenter'
import { closeTasksDatabase, initializeTasksDatabase, taskLogStore } from '@/database/tasks'
import { sandboxHostManager } from '@/services/sandboxHostManager'
import { taskScheduler } from '@/tasks/scheduler'
import { startServer, stopServer } from '../app'
import { closeDatabase as closeConversationsDatabase, initializeDatabase as initializeConversationsDatabase } from '../database/conversations'
import { startIMServiceIfEnabled, stopIMService } from '../im'
import { preloadRuntimeModel } from '../runtime/provider'

/**
 * Agent 模式：启动 HTTP 服务器，暴露 chat API 给前端调用。
 * RoxyClaw 是同一 agent 进程内的 IM 能力，按后端配置启用。
 */
export async function runAgentMode(): Promise<() => Promise<void>> {
  initializeConversationsDatabase()
  initializeTasksDatabase()
  markStarted()
  const uninstallProcessFaultGuards = installProcessFaultGuards({ label: 'agent' })
  console.log('[mode:agent] Starting HTTP agent server...')
  // Warm the model configuration while the agent starts. Conversation calls
  // await the same in-flight promise and then use the process-local cache.
  void preloadRuntimeModel({
    onRetry: event => console.warn(`[mode:agent] model lookup retry ${event.attempt}/${event.maxAttempts}: ${event.reason}`),
  }).catch((error) => {
    // A later conversation retries again if startup warmup never succeeds.
    console.warn('[mode:agent] model configuration warmup failed:', error instanceof Error ? error.message : String(error))
  })
  const stopRunStatePersistence = installConversationRunStatePersistence()

  const recoveredConversationRuns = recoverInterruptedConversationRuns()
  if (recoveredConversationRuns > 0) {
    console.warn(`[mode:agent] Recovered ${recoveredConversationRuns} interrupted conversation runs`)
  }

  const recoveredTaskLogs = taskLogStore.recoverInterrupted()
  if (recoveredTaskLogs > 0) {
    console.warn(`[mode:agent] Recovered ${recoveredTaskLogs} interrupted task logs`)
  }
  try {
    await startServer()
  }
  catch (error) {
    uninstallProcessFaultGuards()
    stopRunStatePersistence()
    closeConversationsDatabase()
    closeTasksDatabase()
    throw error
  }

  await startIMServiceIfEnabled()

  // 同步后端任务并注册本地 timer。启动失败不阻塞 server。
  try {
    await taskScheduler.start()
  }
  catch (err: any) {
    console.warn('[mode:agent] task scheduler start failed:', err instanceof Error ? err.message : String(err))
  }

  return async function shutdown() {
    let shutdownCompleted = true
    try {
      console.log('[mode:agent] Shutting down...')
      await taskScheduler.stop()
      await executionCenter.cancelAll('client_shutdown')
      abortAll()
      await sandboxHostManager.shutdown()
      await mcpManager.shutdown()
      await stopServer()
      await stopIMService()
      stopRunStatePersistence()
      closeConversationsDatabase()
      closeTasksDatabase()
    }
    catch (err) {
      console.log('[mode:agent] Error occurred when shutting down', err)
      shutdownCompleted = false
    }
    finally {
      uninstallProcessFaultGuards()
      if (shutdownCompleted) {
        markExited()
      }
    }
  }
}
