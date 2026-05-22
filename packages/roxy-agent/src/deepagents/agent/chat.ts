import type { AgentInstance } from '..'
import {
  createDeepAgent,
} from 'deepagents'
import path from 'node:path'
import { env } from '../../config'
import { createLLM } from '../../llm'
import { mcpManager } from '../../mcpManager'
import { createDeepAgentRuntime } from '../backend'
import { ORCHESTRATOR_SYSTEM_PROMPT, SIMPLE_SYSTEM_PROMPT } from '../prompt'
import { SqliteSaver } from '../sqlite-checkpointer'
import { workerTools } from '../tools/run_worker'

const HITL_INTERRUPT_ON: Record<string, any> = {
  roxy_delete_browsers: { allowedDecisions: ['approve', 'reject'] },
  roxy_delete_proxies: { allowedDecisions: ['approve', 'reject'] },
  roxy_delete_accounts: { allowedDecisions: ['approve', 'reject'] },
}

export async function createChatAgent(options: {
  mode: 'simple' | 'orchestrator'
  workerId?: string
  conversationId?: string
}): Promise<AgentInstance> {
  const workerId = options.workerId ?? 'simple'

  await mcpManager.createPlaywrightClientForWorker(workerId)
  const mcpTools = await mcpManager.getToolsForWorker(workerId)

  const model = await createLLM(true)

  let checkpointer
  if (options.conversationId) {
    const checkpointPath = path.join(env.CHECKPOINT_DIR, `checkpoint_${options.conversationId}.db`)
    checkpointer = SqliteSaver.fromConnString(checkpointPath)
  }

  const runtime = await createDeepAgentRuntime({
    allowExecution: Boolean(checkpointer),
  })

  const tools = options.mode === 'orchestrator'
    ? [...runtime.tools, ...workerTools, ...mcpTools]
    : [...runtime.tools, ...mcpTools]

  const systemPrompt = options.mode === 'orchestrator'
    ? ORCHESTRATOR_SYSTEM_PROMPT
    : SIMPLE_SYSTEM_PROMPT

  const agent = createDeepAgent({
    model,
    checkpointer,
    backend: runtime.backend,
    systemPrompt,
    tools,
    middleware: runtime.middleware,
    name: options.mode,
    ...(checkpointer
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
    destroy: async () => {
      await runtime.destroy()
      await mcpManager.destroyPlaywrightClientForWorker(workerId)
    },
  }
}
