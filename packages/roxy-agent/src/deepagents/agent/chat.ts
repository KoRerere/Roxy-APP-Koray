import type { AgentInstance } from '..'
import type { ModelRetryInfo } from '@/deepagents/middlewares'
import {
  createDeepAgent,
} from 'deepagents'
import path from 'node:path'
import { mcpManager } from '@/core/mcp/mcpManager'
import { createModelRetryMiddleware } from '@/deepagents/middlewares'
import { env } from '../../config'
import { createLLM } from '../../llm'
import { createDeepAgentRuntime, ensureWorkspaceDir } from '../backend'
import { createFileCollectorStore } from '../fileCollector'
import { ORCHESTRATOR_SYSTEM_PROMPT, SIMPLE_SYSTEM_PROMPT } from '../prompt'
import { SqliteSaver } from '../sqlite-checkpointer'
import { listScriptsTool } from '../tools/list_scripts'
import { createRunScriptTool } from '../tools/run_script'
import { workerTools } from '../tools/run_worker'
import { scheduleTools } from '../tools/schedules'
import { getCurrentTimeTool } from '../tools/get_current_time'

const HITL_INTERRUPT_ON: Record<string, any> = {
  roxy_delete_browsers: { allowedDecisions: ['approve', 'reject'] },
  roxy_delete_proxies: { allowedDecisions: ['approve', 'reject'] },
  roxy_delete_accounts: { allowedDecisions: ['approve', 'reject'] },
}

export async function createChatAgent(options: {
  mode: 'simple' | 'orchestrator'
  workerId?: string
  conversationId?: string
  turnId?: string
  onRetry?: (info: ModelRetryInfo) => void
  fullAccess?: boolean
}): Promise<AgentInstance> {
  const workerId = options.workerId ?? 'simple'

  await mcpManager.createPlaywrightClientForWorker(workerId)
  const mcpTools = await mcpManager.getToolsForWorker(workerId, true, options.conversationId)

  const model = await createLLM({
    enableThinking: true,
    conversationId: options.conversationId,
    turnId: options.turnId,
  })

  let checkpointer
  if (options.conversationId) {
    const checkpointPath = path.join(env.CHECKPOINT_DIR, `checkpoint_${options.conversationId}.db`)
    checkpointer = SqliteSaver.fromConnString(checkpointPath)
  }

  const workspaceDir = options.conversationId ? ensureWorkspaceDir(options.conversationId) : undefined
  const fileCollector = createFileCollectorStore()
  const runtime = await createDeepAgentRuntime({
    allowExecution: Boolean(checkpointer),
    workspaceDir,
    fileCollector,
    browserRecording: true,
    conversationId: options.conversationId,
    workerId,
  })

  const runScriptTool = createRunScriptTool({
    fileCollector,
    workspaceDir,
    scriptOutputDir: workspaceDir ? path.join(workspaceDir, 'script-run') : undefined,
    scriptLogsDir: workspaceDir ? path.join(workspaceDir, 'script-run') : undefined,
  })
  const tools = options.mode === 'orchestrator'
    ? [...runtime.tools, ...workerTools, ...scheduleTools, getCurrentTimeTool, ...mcpTools]
    : [...runtime.tools, runScriptTool, listScriptsTool, ...scheduleTools, getCurrentTimeTool, ...mcpTools]

  const systemPrompt = options.mode === 'orchestrator'
    ? ORCHESTRATOR_SYSTEM_PROMPT
    : SIMPLE_SYSTEM_PROMPT

  const agent = createDeepAgent({
    model,
    checkpointer,
    backend: runtime.backend,
    systemPrompt,
    tools,
    middleware: [
      createModelRetryMiddleware({ onRetry: options.onRetry }),
      ...runtime.middleware,
    ],
    name: options.mode,
    subagents: [],
    ...(checkpointer && !options.fullAccess
      ? {
          interruptOn: {
            ...runtime.interruptOn,
            ...HITL_INTERRUPT_ON,
          },
        }
      : {}),
  })

  return {
    agent,
    consumeFiles: fileCollector.consume,
    destroy: async () => {
      await runtime.destroy()
      await mcpManager.destroyPlaywrightClientForWorker(workerId)
    },
  }
}
