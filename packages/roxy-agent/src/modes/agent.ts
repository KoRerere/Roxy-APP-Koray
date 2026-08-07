import { installConversationRunStatePersistence, recoverInterruptedConversationRuns } from '@/core/agent-events/conversationRunState'
import { runEventHub } from '@/core/agent-events/runEventHub'
import { startResourceMonitor } from '@/core/diagnostics/resourceMonitor'
import { markExited, markStarted } from '@/core/exitState'
import { writePerfmon } from '@/core/logger'
import { mcpManager } from '@/core/mcp/mcpManager'
import { abortAll } from '@/core/registry/abortRegistry'
import { taskMonitorHub } from '@/core/task-monitor'
import { closeTasksDatabase, taskLogStore } from '@/database/tasks'
import { conversationLogManager } from '@/script/browserOpsManager'
import { taskExecutionDetailHub } from '@/services/taskExecutionDetails'
import { taskScheduler } from '@/tasks/scheduler'
import { startServer, stopServer } from '../app'
import { closeDatabase as closeConversationsDatabase } from '../database/conversations'
import { closeCheckpointer, SqliteSaver } from '../deepagents/sqlite-checkpointer'
import { startIMServiceIfEnabled, stopIMService } from '../im'

function collectAgentResourceExtras(): Record<string, number | string> {
  const result: Record<string, number | string> = {
    mcp: mcpManager.count,
    checkpoints: SqliteSaver.instances.size,
    runs: runEventHub.activeRunCount,
    tmTasks: taskMonitorHub.taskCount,
    tmInvalid: taskMonitorHub.invalidationCacheSize,
    taskDetails: taskExecutionDetailHub.taskDetailCount,
    recSessions: conversationLogManager.sessionCount,
  }
  try {
    const handles = (process as NodeJS.Process & { _getActiveHandles?: () => unknown[] })._getActiveHandles?.()
    if (Array.isArray(handles)) {
      result.handles = handles.length
    }
  }
  catch {
    // _getActiveHandles 是非公开 API，部分环境可能缺失
  }
  return result
}

/**
 * Agent 模式：启动 HTTP 服务器，暴露 chat API 给前端调用。
 * RoxyClaw 是同一 agent 进程内的 IM 能力，按后端配置启用。
 */
export async function runAgentMode(): Promise<() => Promise<void>> {
  markStarted()
  console.log('[mode:agent] Starting HTTP agent server...')
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
    stopRunStatePersistence()
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

  const stopResourceMonitor = startResourceMonitor({
    label: 'agent',
    intervalMs: 15_000,
    receiver: writePerfmon,
    extras: collectAgentResourceExtras,
  })

  return async function shutdown() {
    let shutdownCompleted = true
    try {
      console.log('[mode:agent] Shutting down...')
      stopResourceMonitor()
      await taskScheduler.stop()
      abortAll()
      await mcpManager.shutdown()
      await stopServer()
      await stopIMService()
      stopRunStatePersistence()
      closeCheckpointer()
      closeConversationsDatabase()
      closeTasksDatabase()
    }
    catch (err) {
      console.log('[mode:agent] Error occurred when shutting down', err)
      shutdownCompleted = false
    }
    finally {
      if (shutdownCompleted) {
        markExited()
      }
    }
  }
}
