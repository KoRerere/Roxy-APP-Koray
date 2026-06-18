import type { AgentInstance } from '@/deepagents'
import { createDeepAgent } from 'deepagents'
import path from 'node:path'
import { aiAgentModelApi } from '@/api/model'
import { env } from '@/config'
import { mcpManager } from '@/core/mcp/mcpManager'
import { createDeepAgentRuntime } from '@/deepagents/backend'
import { createImageSpecStore } from '@/deepagents/imageSpec'
import { createSaveImageSpecLimitMiddleware } from '@/deepagents/middlewares/imageSpec'
import { IMAGE_SYSTEM_PROMPT } from '@/deepagents/prompt'
import { SqliteSaver } from '@/deepagents/sqlite-checkpointer'
import { createImageTools } from '@/deepagents/tools/image'
import { createLLMFromModelInfo } from '@/llm'

export async function createImageAgent(options: {
  conversationId?: string
  turnId?: string
}): Promise<AgentInstance> {
  const mcpTools = await mcpManager.getToolsForWorker('image', false)
  const modelInfo = await aiAgentModelApi.getUserModel({
    headers: {
      ...(options.conversationId ? { 'Conversation-Id': options.conversationId } : {}),
      ...(options.turnId ? { 'Turn-Id': options.turnId } : {}),
    },
  })
  const model = createLLMFromModelInfo(modelInfo, {
    enableThinking: true,
    conversationId: options.conversationId,
    turnId: options.turnId,
    modelType: 'vlm_model',
  })
  ;(model as any).defaultOptions = {
    ...(model as any).defaultOptions,
    parallel_tool_calls: false,
  }

  let checkpointer
  if (options.conversationId) {
    const checkpointPath = path.join(env.CHECKPOINT_DIR, `checkpoint_${options.conversationId}.db`)
    checkpointer = SqliteSaver.fromConnString(checkpointPath)
  }

  const runtime = await createDeepAgentRuntime({
    allowExecution: Boolean(checkpointer),
  })
  const imageSpecStore = createImageSpecStore()

  const tools = [
    ...runtime.tools,
    ...mcpTools,
    ...createImageTools(imageSpecStore),
  ]
  const agent = createDeepAgent({
    model,
    checkpointer,
    backend: runtime.backend,
    systemPrompt: IMAGE_SYSTEM_PROMPT,
    tools,
    middleware: [...runtime.middleware, createSaveImageSpecLimitMiddleware()],
    name: 'image',
    subagents: [],
    ...(checkpointer ? { interruptOn: runtime.interruptOn } : {}),
  })

  return {
    agent,
    imageProviderOptions: {
      imageModel: modelInfo.image_model?.model,
      imageProtocol: modelInfo.image_model?.api_format,
    },
    consumeImageSpec: imageSpecStore.consume,
    destroy: async () => {
      await runtime.destroy()
    },
  }
}
