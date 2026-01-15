import fs from 'node:fs/promises'
import path from 'node:path'

const MESSAGE_MAPPING_DIR = process.env.MESSAGE_MAPPING_DIR || path.join(process.cwd(), '.message-mappings')

/**
 * 消息映射接口
 */
export interface MessageMapping {
  aiMessageId: string
  userContent: string
  timestamp: number
}

/**
 * 会话消息映射
 * 格式: { userMessageId: MessageMapping }
 */
export type SessionMessageMapping = Record<string, MessageMapping>

async function ensureMessageMappingDir(): Promise<void> {
  try {
    await fs.mkdir(MESSAGE_MAPPING_DIR, { recursive: true })
  }
  catch (error) {
    // 目录已存在，忽略错误
  }
}

/**
 * 获取消息映射文件路径
 */
function getMessageMappingFilePath(threadId: string): string {
  return path.join(MESSAGE_MAPPING_DIR, `${threadId}.json`)
}

/**
 * 保存消息映射到本地文件
 */
export async function saveMessageMapping(
  threadId: string,
  userMessageId: string,
  aiMessageId: string,
  userContent: string,
): Promise<void> {
  try {
    await ensureMessageMappingDir()
    const filePath = getMessageMappingFilePath(threadId)

    // 读取现有映射
    let mappings: SessionMessageMapping = {}
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      mappings = JSON.parse(data)
    }
    catch (error) {
      // 文件不存在，使用空对象
    }

    // 添加或更新映射
    mappings[userMessageId] = {
      aiMessageId,
      userContent,
      timestamp: Date.now(),
    }

    // 保存到文件
    await fs.writeFile(
      filePath,
      JSON.stringify(mappings, null, 2),
      'utf-8',
    )

    console.log(`[MessageMappingStorage] Saved mapping ${userMessageId} -> ${aiMessageId} for thread ${threadId}`)
  }
  catch (error) {
    console.error('[MessageMappingStorage] Failed to save message mapping:', error)
    throw error
  }
}

/**
 * 加载指定 threadId 的所有消息映射
 */
export async function loadMessageMappings(threadId: string): Promise<SessionMessageMapping> {
  try {
    const filePath = getMessageMappingFilePath(threadId)
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  }
  catch (error) {
    // 文件不存在，返回空对象
    return {}
  }
}

/**
 * 删除指定 threadId 的消息映射文件
 */
export async function deleteMessageMappings(threadId: string): Promise<void> {
  try {
    const filePath = getMessageMappingFilePath(threadId)
    await fs.unlink(filePath)
    console.log(`[MessageMappingStorage] Deleted message mappings for thread ${threadId}`)
  }
  catch (error) {
    // 文件不存在，忽略错误
  }
}
