import type { CollectedFile } from './fileCollector'
import type { DeepAgent } from 'deepagents'
import fs from 'node:fs/promises'
import { conversationCheckpointPath } from './checkpointPaths'
import { closeCheckpointer } from './sqlite-checkpointer'

export interface AgentInstance {
  agent: DeepAgent
  destroy: () => Promise<void>
  consumeFiles?: () => CollectedFile[]
}

export { createChatAgent } from './agent/chat'
export { createClawAgent } from './agent/claw'

export async function deleteCheckpoint(conversationId: string): Promise<void> {
  const checkpointPath = conversationCheckpointPath(conversationId)
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
