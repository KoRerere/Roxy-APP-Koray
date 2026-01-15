import fs from 'node:fs/promises'
import path from 'node:path'

const AI_MESSAGES_LOGS_DIR = process.env.AI_MESSAGES_LOGS_DIR || path.join(process.cwd(), '.ai-messages-logs')

/**
 * 流事件接口
 */
export interface StreamEvent {
  type: string
  data: any
  timestamp: number
}

/**
 * 用户消息的AI回复事件数据
 */
export interface UserMessageAIEvents {
  userMessageId: string
  threadId: string
  createdAt: string
  lastUpdated: string
  eventCount: number
  events: StreamEvent[]
}

/**
 * 确保 AI 消息日志目录存在
 */
async function ensureAIMessageLogsDir(threadId?: string): Promise<void> {
  try {
    const baseDir = AI_MESSAGES_LOGS_DIR
    await fs.mkdir(baseDir, { recursive: true })

    if (threadId) {
      const threadDir = path.join(baseDir, threadId)
      await fs.mkdir(threadDir, { recursive: true })
    }
  }
  catch (error) {
    // 目录已存在，忽略错误
  }
}

/**
 * AI 消息事件日志记录器
 * 每个用户消息对应一个独立的日志文件
 */
export class AIMessageLogger {
  private threadId: string
  /**
   * 改为public以便外部访问
   */
  public userMessageId: string
  private events: StreamEvent[] = []
  private logFilePath: string

  constructor(threadId: string, userMessageId: string) {
    this.threadId = threadId
    this.userMessageId = userMessageId
    this.logFilePath = path.join(AI_MESSAGES_LOGS_DIR, threadId, `${userMessageId}.json`)
  }

  /**
   * 添加事件
   */
  addEvent(event: StreamEvent): void {
    // 添加事件，确保有时间戳
    const eventWithTimestamp = {
      ...event,
      timestamp: event.timestamp || Date.now(),
    }

    this.events.push(eventWithTimestamp)

    // 按时间戳排序
    this.events.sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * 批量添加事件
   */
  addEvents(events: StreamEvent[]): void {
    events.forEach(event => this.addEvent(event))
  }

  /**
   * 获取所有事件
   */
  getEvents(): StreamEvent[] {
    return this.events
  }

  /**
   * 获取事件数量
   */
  getEventCount(): number {
    return this.events.length
  }

  /**
   * 保存日志到文件
   */
  async saveToFile(): Promise<void> {
    try {
      // 确保目录存在
      await ensureAIMessageLogsDir(this.threadId)

      // 尝试加载现有文件
      let existingEvents: StreamEvent[] = []
      try {
        const existingData = await fs.readFile(this.logFilePath, 'utf-8')
        const existingLogData = JSON.parse(existingData) as UserMessageAIEvents
        existingEvents = existingLogData.events || []
      }
      catch (error) {
        // 文件不存在，创建新文件
        console.log(`ℹ️  Creating new AI message event log file: ${this.threadId}/${this.userMessageId}`)
      }

      // 合并事件（去重）
      const allEvents = [...existingEvents]
      for (const newEvent of this.events) {
        // 检查是否已存在相同的事件
        const exists = allEvents.some(existingEvent =>
          existingEvent.type === newEvent.type
          && existingEvent.timestamp === newEvent.timestamp
          && JSON.stringify(existingEvent.data) === JSON.stringify(newEvent.data),
        )
        if (!exists) {
          allEvents.push(newEvent)
        }
      }

      // 按时间戳排序
      allEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))

      const logData: UserMessageAIEvents = {
        userMessageId: this.userMessageId,
        threadId: this.threadId,
        createdAt: existingEvents.length > 0
          ? (JSON.parse(await fs.readFile(this.logFilePath, 'utf-8').catch(() => '{}')) as any).createdAt || new Date().toISOString()
          : new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        eventCount: allEvents.length,
        events: allEvents,
      }

      await fs.writeFile(
        this.logFilePath,
        JSON.stringify(logData, null, 2),
        'utf-8',
      )

      console.log(`📝 AI message event log saved: ${this.threadId}/${this.userMessageId}.json (${allEvents.length} events, ${this.events.length} new)`)
    }
    catch (error) {
      console.error('❌ Failed to save AI message event log:', error)
      throw error
    }
  }

  /**
   * 读取指定用户消息的AI事件日志
   */
  static async loadFromFile(threadId: string, userMessageId: string): Promise<AIMessageLogger | null> {
    try {
      const logFilePath = path.join(AI_MESSAGES_LOGS_DIR, threadId, `${userMessageId}.json`)
      const data = await fs.readFile(logFilePath, 'utf-8')
      const logData = JSON.parse(data) as UserMessageAIEvents

      const logger = new AIMessageLogger(threadId, userMessageId)
      logger.events = logData.events || []
      return logger
    }
    catch (error) {
      console.log(`ℹ️  No existing AI message event log file for: ${threadId}/${userMessageId}`)
      return null
    }
  }

  /**
   * 加载指定threadId的所有用户消息AI事件日志
   */
  static async loadAllFromThread(threadId: string): Promise<Record<string, StreamEvent[]>> {
    try {
      const threadDir = path.join(AI_MESSAGES_LOGS_DIR, threadId)
      const files = await fs.readdir(threadDir)
      const jsonFiles = files.filter(file => file.endsWith('.json'))
      console.log('[AIMessageLogger] loadAllFromThread:!!', threadDir, jsonFiles)
      const eventMappings: Record<string, StreamEvent[]> = {}

      for (const file of jsonFiles) {
        const userMessageId = file.replace('.json', '')
        console.log('[AIMessageLogger] loadAllFromThread:!! userMessageId:', userMessageId)
        const filePath = path.join(threadDir, file)

        try {
          const data = await fs.readFile(filePath, 'utf-8')
          console.log('[AIMessageLogger] loadAllFromThread:!! data:', data)
          const logData = JSON.parse(data) as UserMessageAIEvents
          eventMappings[userMessageId] = logData.events || []
        }
        catch (error) {
          console.warn(`⚠️  Failed to load AI message log: ${threadId}/${file}`, error)
        }
      }

      return eventMappings
    }
    catch (error) {
      console.log(`ℹ️  No AI message event logs found for thread: ${threadId}`)
      return {}
    }
  }

  /**
   * 列出所有threadId
   */
  static async listThreadIds(): Promise<string[]> {
    try {
      await ensureAIMessageLogsDir()
      const entries = await fs.readdir(AI_MESSAGES_LOGS_DIR, { withFileTypes: true })
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
    }
    catch (error) {
      console.error('❌ Failed to list AI message log thread IDs:', error)
      return []
    }
  }

  /**
   * 列出指定threadId下的所有userMessageId
   */
  static async listUserMessageIds(threadId: string): Promise<string[]> {
    try {
      const threadDir = path.join(AI_MESSAGES_LOGS_DIR, threadId)
      const files = await fs.readdir(threadDir)
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''))
    }
    catch (error) {
      console.log(`ℹ️  No user message IDs found for thread: ${threadId}`)
      return []
    }
  }

  /**
   * 删除指定用户消息的日志文件
   */
  static async deleteLogFile(threadId: string, userMessageId: string): Promise<void> {
    try {
      const logFilePath = path.join(AI_MESSAGES_LOGS_DIR, threadId, `${userMessageId}.json`)
      await fs.unlink(logFilePath)
      console.log(`🗑️  Deleted AI message event log: ${threadId}/${userMessageId}`)
    }
    catch (error) {
      console.error(`❌ Failed to delete AI message event log: ${threadId}/${userMessageId}`, error)
      throw error
    }
  }

  /**
   * 删除整个threadId目录
   */
  static async deleteThreadLogs(threadId: string): Promise<void> {
    try {
      const threadDir = path.join(AI_MESSAGES_LOGS_DIR, threadId)
      await fs.rm(threadDir, { recursive: true, force: true })
      console.log(`🗑️  Deleted all AI message event logs for thread: ${threadId}`)
    }
    catch (error) {
      console.error(`❌ Failed to delete AI message event logs for thread: ${threadId}`, error)
      throw error
    }
  }

  /**
   * 清空所有日志
   */
  static async clearAllLogs(): Promise<void> {
    try {
      const threadIds = await AIMessageLogger.listThreadIds()
      for (const threadId of threadIds) {
        await AIMessageLogger.deleteThreadLogs(threadId)
      }
      console.log(`🗑️  Cleared all AI message event logs (${threadIds.length} threads)`)
    }
    catch (error) {
      console.error('❌ Failed to clear all AI message event logs:', error)
      throw error
    }
  }
}
