import fs from 'node:fs/promises'
import path from 'node:path'

const USER_MESSAGES_MAP_DIR = process.env.USER_MESSAGES_MAP_DIR || path.join(process.cwd(), '.user-messages-map')

/**
 * 用户消息存储接口
 */
export interface UserMessage {
  id: string
  threadId: string
  userId: string
  content: string
  timestamp: number
}

async function ensureUserMessagesDir(): Promise<void> {
  try {
    await fs.mkdir(USER_MESSAGES_MAP_DIR, { recursive: true })
  }
  catch (error) {
    // 目录已存在，忽略错误
  }
}

/**
 * 获取用户消息文件路径
 */
function getUserMessagesFilePath(threadId: string): string {
  return path.join(USER_MESSAGES_MAP_DIR, `${threadId}.json`)
}

/**
 * 保存用户消息到本地文件
 */
export async function saveUserMessage(message: UserMessage): Promise<void> {
  try {
    await ensureUserMessagesDir()
    const filePath = getUserMessagesFilePath(message.threadId)

    // 读取现有消息
    let messages: UserMessage[] = []
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      messages = JSON.parse(data)
    }
    catch (error) {
      // 文件不存在，使用空数组
    }

    // 添加新消息
    messages.push(message)

    // 按时间戳排序
    messages.sort((a, b) => a.timestamp - b.timestamp)

    // 保存到文件
    await fs.writeFile(
      filePath,
      JSON.stringify(messages, null, 2),
      'utf-8',
    )

    console.log(`[UserMessageStorage] Saved user message ${message.id} for thread ${message.threadId}`)
  }
  catch (error) {
    console.error('[UserMessageStorage] Failed to save user message:', error)
    throw error
  }
}

/**
 * 加载指定 threadId 的所有用户消息（按时间戳排序）
 */
export async function loadUserMessages(threadId: string): Promise<UserMessage[]> {
  try {
    const filePath = getUserMessagesFilePath(threadId)
    const data = await fs.readFile(filePath, 'utf-8')
    const messages: UserMessage[] = JSON.parse(data)

    // 按时间戳排序
    messages.sort((a, b) => a.timestamp - b.timestamp)

    return messages
  }
  catch (error) {
    // 文件不存在，返回空数组
    return []
  }
}

/**
 * 删除指定 threadId 的用户消息文件
 */
export async function deleteUserMessages(threadId: string): Promise<void> {
  try {
    const filePath = getUserMessagesFilePath(threadId)
    await fs.unlink(filePath)
    console.log(`[UserMessageStorage] Deleted user messages for thread ${threadId}`)
  }
  catch (error) {
    // 文件不存在，忽略错误
  }
}

/**
 * 列出所有有用户消息的 threadId
 */
export async function listThreadIds(): Promise<string[]> {
  try {
    await ensureUserMessagesDir()
    const files = await fs.readdir(USER_MESSAGES_MAP_DIR)
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
  }
  catch (error) {
    return []
  }
}
