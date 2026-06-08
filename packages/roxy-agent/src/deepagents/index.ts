import type { DeepAgent } from 'deepagents'
import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config'

export interface AgentConfig {
  apiKey: string
  baseUrl?: string
  modelName: string
  temperature: number
  maxTokens?: number
  thinking?: {
    budgetTokens: number
  }
}

export interface AgentInstance {
  agent: DeepAgent
  destroy: () => Promise<void>
  imageProviderOptions?: {
    imageModel?: string
    imageProtocol?: string
  }
}

export { createChatAgent } from './agent/chat'
export { createClawAgent } from './agent/claw'
export { createImageAgent } from './agent/image'
export { createScriptAgent } from './agent/script'

export async function deleteCheckpoint(conversationId: string): Promise<void> {
  const checkpointPath = path.join(env.CHECKPOINT_DIR!, `checkpoint_${conversationId}.db`)
  try {
    await fs.unlink(checkpointPath)
    console.log(`Deleted checkpoint for conversation ${conversationId}`)
  }
  catch (err) {
    console.log(`Checkpoint not found for conversation ${conversationId}, skipping delete`)
  }
}
