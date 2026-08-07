import type { AgentInstance } from '..'
import {
  createDeepAgent,
} from 'deepagents'
import { mcpManager } from '@/core/mcp/mcpManager'
import { createOrphanToolResultsMiddleware } from '@/deepagents/middlewares'
import { createLLM } from '../../llm'
import { createDeepAgentRuntime } from '../backend'
import { conversationCheckpointPath } from '../checkpointPaths'
import { ROXY_CLAW_SYSTEM_PROMPT } from '../prompt'
import { SqliteSaver } from '../sqlite-checkpointer'
import { HITL_DELETE_TOOLS } from './hitlTools'

export async function createClawAgent(options: {
  workerId: string
  conversationId?: string
  turnId?: string
  taskMonitorTaskId?: string
}): Promise<AgentInstance> {
  const { workerId } = options

  await mcpManager.createPlaywrightClientForWorker(workerId, options.conversationId ?? workerId)
  const mcpTools = await mcpManager.getToolsForWorker(workerId)

  const model = await createLLM({
    enableThinking: true,
    conversationId: options.conversationId,
    turnId: options.turnId,
  })

  let checkpointer
  if (options.conversationId) {
    const checkpointPath = conversationCheckpointPath(options.conversationId)
    checkpointer = SqliteSaver.fromConnString(checkpointPath)
  }

  const runtime = await createDeepAgentRuntime({
    allowExecution: Boolean(checkpointer),
    conversationId: options.conversationId,
    workerId,
    taskMonitorTaskId: options.taskMonitorTaskId,
  })

  const tools = [
    ...runtime.tools,
    ...mcpTools.filter((t: any) => !HITL_DELETE_TOOLS.includes(t.name)),
  ]

  const agent = createDeepAgent({
    model,
    checkpointer,
    backend: runtime.backend,
    systemPrompt: ROXY_CLAW_SYSTEM_PROMPT,
    tools,
    middleware: [
      createOrphanToolResultsMiddleware(),
      ...runtime.middleware,
    ],
    name: 'claw',
    subagents: [],
    ...(checkpointer ? { interruptOn: runtime.interruptOn } : {}),
  })

  return {
    agent,
    destroy: async () => {
      await runtime.destroy()
      await mcpManager.destroyPlaywrightClientForWorker(workerId)
    },
  }
}
