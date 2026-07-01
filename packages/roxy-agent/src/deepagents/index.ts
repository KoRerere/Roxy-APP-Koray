import type { CollectedFile } from './fileCollector'
import type { ImageGenerationSpec } from './imageSpec'
import type { DeepAgent } from 'deepagents'
import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config'
import { closeCheckpointer } from './sqlite-checkpointer'

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
  consumeImageSpec?: () => ImageGenerationSpec | undefined
  consumeFiles?: () => CollectedFile[]
}

export { createChatAgent } from './agent/chat'
export { createClawAgent } from './agent/claw'
export { createImageAgent } from './agent/image'

export async function deleteCheckpoint(conversationId: string): Promise<void> {
  const checkpointPath = path.join(env.CHECKPOINT_DIR!, `checkpoint_${conversationId}.db`)
  closeCheckpointer(checkpointPath)

  const paths = [
    checkpointPath,
    `${checkpointPath}-wal`,
    `${checkpointPath}-shm`,
  ]
  let deleted = false

  for (const filePath of paths) {
    try {
      await fs.unlink(filePath)
      deleted = true
    }
    catch (err: any) {
      if (err?.code !== 'ENOENT')
        throw err
    }
  }

  console.log(
    deleted
      ? `Deleted checkpoint for conversation ${conversationId}`
      : `Checkpoint not found for conversation ${conversationId}, skipping delete`,
  )
}
