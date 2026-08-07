import type { AgentInstance } from '..'
import type { DeepAgentRuntime } from '../backend'
import type { ModelRetryInfo } from '@/deepagents/middlewares'
import {
  createDeepAgent,
  GENERAL_PURPOSE_SUBAGENT,
} from 'deepagents'
import { mcpManager } from '@/core/mcp/mcpManager'
import { agentPaths } from '@/core/storage/agentPaths'
import { createModelRetryMiddleware, createOrphanToolResultsMiddleware } from '@/deepagents/middlewares'
import { createLLM } from '../../llm'
import { createDeepAgentRuntime } from '../backend'
import { conversationCheckpointPath } from '../checkpointPaths'
import { createFileCollectorStore } from '../fileCollector'
import { appendRecordingContext, ROXY_MAIN_SYSTEM_PROMPT, ROXY_WORKER_SYSTEM_PROMPT } from '../prompt'
import { SqliteSaver } from '../sqlite-checkpointer'
import { createRoxyFilesystemMiddleware } from '../tools/filesystem'
import { getScriptSelfDescriptionTool } from '../tools/get_script_self_description'
import { listScriptsTool } from '../tools/list_scripts'
import { createRunScriptTool } from '../tools/run_script'
import { createWorkerTools } from '../tools/run_worker'
import { HITL_DELETE_INTERRUPT_ON } from './hitlTools'

export async function createChatAgent(options: {
  role?: 'main' | 'worker'
  workerId?: string
  conversationId?: string
  turnId?: string
  onRetry?: (info: ModelRetryInfo) => void
  fullAccess?: boolean
  browserOperationLogging?: boolean
  signal?: AbortSignal
  taskMonitorTaskId?: string
  /** 本次运行授权的窗口 dirId；非空时窗口类工具只能操作这些窗口 */
  allowedDirIds?: string[]
}): Promise<AgentInstance> {
  const role = options.role ?? 'main'
  if (role === 'worker' && !options.conversationId) {
    throw new Error('Worker chat agent requires parent conversationId')
  }

  // 调用方应为可重叠的 run 提供唯一 workerId，使旧 run 的异步销毁不会影响新 run。
  // 其他调用点继续按 conversationId 隔离，无 conversationId 时回退 'chat'。
  const workerId = options.workerId ?? (options.conversationId ? `chat_${options.conversationId}` : 'chat')
  const sessionId = options.conversationId ?? workerId
  let playwrightCreated = false
  let runtime: DeepAgentRuntime | undefined
  let destroyPromise: Promise<void> | undefined

  const throwIfAborted = () => {
    if (!options.signal?.aborted) {
      return
    }

    throw options.signal.reason instanceof Error
      ? options.signal.reason
      : new DOMException('User cancelled', 'AbortError')
  }

  const destroyResources = () => {
    destroyPromise ||= (async () => {
      try {
        await runtime?.destroy()
      }
      finally {
        if (playwrightCreated) {
          await mcpManager.destroyPlaywrightClientForWorker(workerId)
        }
      }
    })()
    return destroyPromise
  }

  try {
    throwIfAborted()
    await mcpManager.createPlaywrightClientForWorker(workerId, sessionId)
    playwrightCreated = true
    mcpManager.setWorkerAllowedDirIds(workerId, options.allowedDirIds ?? [])
    throwIfAborted()

    const mcpTools = await mcpManager.getToolsForWorker(workerId, true)
    throwIfAborted()

    const model = await createLLM({
      enableThinking: true,
      conversationId: options.conversationId,
      turnId: options.turnId,
      signal: options.signal,
    })
    throwIfAborted()

    let checkpointer
    if (role !== 'worker' && options.conversationId) {
      const checkpointPath = conversationCheckpointPath(options.conversationId)
      checkpointer = SqliteSaver.fromConnString(checkpointPath)
    }

    // agent 文件工具根 = 会话目录（脚本工作台在 workbench/{workId}/ 下，agent 以会话相对路径读写）
    const workspaceDir = options.conversationId ? agentPaths.sessionDir(options.conversationId) : undefined
    const fileCollector = createFileCollectorStore()
    runtime = await createDeepAgentRuntime({
      allowExecution: Boolean(workspaceDir),
      workspaceDir,
      fileCollector,
      browserOperationLogging: options.browserOperationLogging !== false,
      conversationId: options.conversationId,
      workerId,
      taskMonitorTaskId: options.taskMonitorTaskId,
      disableSubagentTool: false,
    })
    throwIfAborted()

    const runScriptTool = createRunScriptTool({
      fileCollector,
      workspaceDir,
      taskMonitorTaskId: options.taskMonitorTaskId,
    })

    const tools = [
      ...runtime.tools,
      ...mcpTools,
      ...(role === 'main' ? createWorkerTools(options.conversationId!) : []),
      listScriptsTool,
      getScriptSelfDescriptionTool,
      runScriptTool,
    ]

    const baseSystemPrompt = role === 'worker'
      ? ROXY_WORKER_SYSTEM_PROMPT
      : ROXY_MAIN_SYSTEM_PROMPT
    const systemPrompt = appendRecordingContext(
      baseSystemPrompt,
      options.conversationId ? agentPaths.sessionRecordingLog(options.conversationId) : undefined,
    )

    // The default general-purpose subagent gets its own middleware stack inside
    // deepagents, so explicitly install the same filesystem overrides there.
    const generalPurposeSubagent = {
      ...GENERAL_PURPOSE_SUBAGENT,
      tools,
      middleware: [createRoxyFilesystemMiddleware({
        rootDir: workspaceDir ?? process.cwd(),
        fileCollector,
      })],
    }

    const agent = createDeepAgent({
      model,
      checkpointer,
      backend: runtime.backend,
      systemPrompt,
      tools,
      middleware: [
        ...(role === 'main' ? [createOrphanToolResultsMiddleware()] : []),
        createModelRetryMiddleware({ onRetry: options.onRetry }),
        ...runtime.middleware,
      ],
      subagents: [generalPurposeSubagent],
      name: role,
      ...(checkpointer && !options.fullAccess
        ? {
            interruptOn: {
              ...runtime.interruptOn,
              ...HITL_DELETE_INTERRUPT_ON,
            },
          }
        : {}),
    })

    return {
      agent,
      consumeFiles: fileCollector.consume,
      destroy: destroyResources,
    }
  }
  catch (error) {
    await destroyResources().catch((cleanupError) => {
      console.warn(`[chat] Failed to clean up agent initialization for ${workerId}:`, cleanupError)
    })
    throwIfAborted()
    throw error
  }
}
