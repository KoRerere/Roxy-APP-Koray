import type { AgentInstance } from '..'
import {
  createDeepAgent,
} from 'deepagents'
import path from 'node:path'
import { mcpManager } from '@/core/mcp/mcpManager'
import { env } from '../../config'
import { createLLM } from '../../llm'
import { createDeepAgentRuntime } from '../backend'
import { SIMPLE_SYSTEM_PROMPT_IM_COMPACT } from '../prompt'
import { SqliteSaver } from '../sqlite-checkpointer'

const HITL_DELETE_TOOLS = ['roxy_delete_browsers', 'roxy_delete_proxies', 'roxy_delete_accounts']

export async function createClawAgent(options: {
  workerId: string
  conversationId?: string
  turnId?: string
}): Promise<AgentInstance> {
  const { workerId } = options

  await mcpManager.createPlaywrightClientForWorker(workerId)
  const mcpTools = await mcpManager.getToolsForWorker(workerId)

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

  const runtime = await createDeepAgentRuntime({
    allowExecution: Boolean(checkpointer),
  })

  const tools = [
    ...runtime.tools,
    ...mcpTools.filter((t: any) => !HITL_DELETE_TOOLS.includes(t.name)),
  ]

  const agent = createDeepAgent({
    model,
    checkpointer,
    backend: runtime.backend,
    systemPrompt: SIMPLE_SYSTEM_PROMPT_IM_COMPACT,
    tools,
    middleware: runtime.middleware,
    name: 'simple',
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
