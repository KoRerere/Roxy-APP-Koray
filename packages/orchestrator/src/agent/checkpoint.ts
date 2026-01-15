import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite'
// import { existsSync } from 'node:fs'
// import { fileURLToPath } from "url";
// import { mkdir } from 'node:fs/promises'
import path from 'node:path'

// 创建 SQLite checkpoint 存储
// 数据库文件存储在项目根目录下的 .checkpoints 文件夹
// const checkpointDir = path.join(process.cwd(), '.checkpoints')
const checkpointPath = path.join(process.env.CHECKPOINT_DIR!, 'checkpoints.db')
console.log('checkpointPath: ', checkpointPath)

// 创建 checkpoint saver 实例（单例）
let checkpointSaverInstance: Awaited<ReturnType<typeof createCheckpointSaver>> | null = null

export async function createCheckpointSaver() {
  console.log('process.env.CHECKPOINT_DIR: ', checkpointPath)
  // 确保 checkpoint 目录存在
  // if (!existsSync(checkpointDir)) {
  //   await mkdir(checkpointDir, { recursive: true })
  //   console.log(`✅ Created checkpoint directory: ${checkpointDir}`)
  // }

  // fromConnString 是同步方法，不需要 await
  // SQLite 数据库文件会在第一次连接时自动创建
  const checkpointer = SqliteSaver.fromConnString(checkpointPath)

  // 执行一个空操作来触发 setup()，确保数据库文件被创建
  // setup() 会在第一次操作时自动调用，创建表结构
  try {
    // 尝试列出空的 checkpoint，这会触发 setup
    const emptyList = checkpointer.list({})
    // 消费迭代器以确保 setup 被调用
    await emptyList.next()
    console.log(`✅ Checkpoint database initialized: ${checkpointPath}`)
  }
  catch (error) {
    // 忽略错误，数据库可能已经存在或已经初始化
    console.log(`ℹ️  Checkpoint database check: ${error instanceof Error ? error.message : String(error)}`)
  }

  return checkpointer
}

/**
 * 获取 checkpoint saver 实例（单例模式）
 */
export async function getCheckpointSaver() {
  if (!checkpointSaverInstance) {
    checkpointSaverInstance = await createCheckpointSaver()
  }
  return checkpointSaverInstance
}

/**
 * 删除指定 thread_id 的所有 checkpoint 数据
 */
export async function deleteThreadCheckpoints(threadId: string): Promise<void> {
  const checkpointer = await getCheckpointSaver()
  await checkpointer.deleteThread(threadId)
}

/**
 * 列出所有 thread_id，并返回每个 thread 的元数据（包括创建时间）
 */
export interface ThreadInfo {
  threadId: string
  /** 通过 configurable.user_id 记录所属用户（如果有） */
  userId?: string
  createdAt?: number
  lastUpdated?: number
}

export async function listThreads(): Promise<string[]>
export async function listThreads(withMetadata: false, userId?: string): Promise<string[]>
export async function listThreads(withMetadata: true, userId?: string): Promise<ThreadInfo[]>
export async function listThreads(withMetadata = false, userId?: string): Promise<string[] | ThreadInfo[]> {
  const checkpointer = await getCheckpointSaver()
  const checkpoints = await checkpointer.list({})
  const threadMap = new Map<string, { userId?: string, createdAt?: number, lastUpdated?: number }>()

  for await (const checkpoint of checkpoints) {
    const threadId = checkpoint.config?.configurable?.thread_id as string | undefined
    const checkpointUserId = checkpoint.config?.configurable?.user_id as string | undefined

    // 如果指定了 userId，只处理匹配的 checkpoint（在遍历时直接过滤，更高效）
    if (userId && checkpointUserId !== userId) {
      continue
    }

    if (threadId) {
      const existing = threadMap.get(threadId) || {}
      // 记录 userId（如果存在）
      if (checkpointUserId && !existing.userId) {
        existing.userId = checkpointUserId
      }
      let timestamp: number | undefined

      // 尝试从 checkpoint.id 提取时间戳
      // 由于类型定义中可能没有 id 字段，这里使用 (checkpoint as any).id 访问，避免类型错误
      const rawId = (checkpoint as any).id as string | undefined
      if (rawId) {
        const idParts = rawId.split('-')
        const possibleTimestamp = Number.parseInt(idParts[0] || '0', 10)
        if (possibleTimestamp > 1000000000000 && possibleTimestamp < 9999999999999) {
          timestamp = possibleTimestamp
        }
      }

      // 如果没有从 id 中提取到时间戳，使用当前时间
      if (!timestamp) {
        timestamp = Date.now()
      }

      if (!existing.createdAt || timestamp < existing.createdAt) {
        existing.createdAt = timestamp
      }
      if (!existing.lastUpdated || timestamp > existing.lastUpdated) {
        existing.lastUpdated = timestamp
      }

      threadMap.set(threadId, existing)
    }
  }

  if (withMetadata) {
    return Array.from(threadMap.entries()).map(([threadId, metadata]) => ({
      threadId,
      userId: metadata.userId,
      createdAt: metadata.createdAt,
      lastUpdated: metadata.lastUpdated,
    }))
  }

  return Array.from(threadMap.keys())
}

/**
 * 获取指定 threadId 的最新 checkpoint 状态（包含 messages）
 * 注意：返回的是最新 checkpoint 中的所有消息，这些消息包含了完整的对话历史
 */
export async function getThreadMessages(threadId: string): Promise<any[]> {
  const checkpointer = await getCheckpointSaver()

  // 使用 getState 方法获取指定 thread 的最新状态
  try {
    const state = await checkpointer.get({
      configurable: { thread_id: threadId },
    })

    // 从 state 中提取 messages（使用 snake_case）
    if (state && (state as any).channel_values?.messages) {
      const messages = (state as any).channel_values.messages
      console.log(`[Checkpoint] Thread ${threadId}: Found ${messages.length} messages in latest checkpoint`)
      return messages
    }

    // 如果 getState 没有返回消息，尝试使用 list 方法查找最新 checkpoint
    const checkpoints = await checkpointer.list({
      configurable: { thread_id: threadId },
    })

    // 找到该 thread 的最新 checkpoint
    let latestCheckpoint: any = null
    let latestTimestamp = 0

    for await (const checkpoint of checkpoints) {
      const rawId = (checkpoint as any).id as string | undefined
      if (rawId) {
        const idParts = rawId.split('-')
        const possibleTimestamp = Number.parseInt(idParts[0] || '0', 10)
        if (possibleTimestamp > latestTimestamp) {
          latestTimestamp = possibleTimestamp
          latestCheckpoint = checkpoint
        }
      }
      // 如果没有找到带时间戳的，使用第一个匹配的
      if (!latestCheckpoint) {
        latestCheckpoint = checkpoint
      }
    }

    // 从 checkpoint 中提取 messages（使用 snake_case）
    if (latestCheckpoint && (latestCheckpoint as any)?.channel_values?.messages) {
      const messages = (latestCheckpoint as any).channel_values.messages
      console.log(`[Checkpoint] Thread ${threadId}: Found ${messages.length} messages in checkpoint (fallback method)`)
      return messages
    }
  }
  catch (error: any) {
    console.error(`[Checkpoint] Error getting messages for thread ${threadId}:`, error)
  }

  return []
}
