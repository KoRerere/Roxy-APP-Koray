import fs from 'node:fs/promises'
import path from 'node:path'

const LOGS_DIR = process.env.CHAT_LOGS_DIR || path.join(process.cwd(), '.chat-logs')

async function ensureLogsDir(): Promise<void> {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true })
  }
  catch (error) {
    // 目录已存在，忽略错误
  }
}

export class ChatLogger {
  private threadId: string
  private events: any[] = []
  private logFilePath: string

  constructor(threadId: string) {
    this.threadId = threadId
    this.logFilePath = path.join(LOGS_DIR, `${threadId}.json`)
  }

  /**
   * 添加事件到日志
   */
  addEvent(event: any): void {
    this.events.push(event)
  }

  /**
   * 批量添加事件
   */
  addEvents(events: any[]): void {
    events.forEach(event => this.addEvent(event))
  }

  /**
   * 获取所有事件
   */
  getEvents(): any[] {
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
      // 确保日志目录存在
      await ensureLogsDir()

      const logData = {
        threadId: this.threadId,
        createdAt: new Date().toISOString(),
        events: this.events,
        version: 'v1',
      }

      await fs.writeFile(
        this.logFilePath,
        JSON.stringify(logData),
        'utf-8',
      )

      console.log(`📝 Event log saved: ${this.logFilePath} (${this.events.length} events)`)
    }
    catch (error) {
      console.error('❌ Failed to save event log:', error)
      throw error
    }
  }

  /**
   * 读取已保存的日志文件
   */
  static async loadFromFile(threadId: string): Promise<ChatLogger | null> {
    try {
      const logFilePath = path.join(LOGS_DIR, `${threadId}.json`)
      const data = await fs.readFile(logFilePath, 'utf-8')
      const logData = JSON.parse(data)

      const logger = new ChatLogger(threadId)
      logger.events = logData.events || []
      return logger
    }
    catch (error) {
      console.log(`ℹ️  No existing log file for thread: ${threadId}`)
      return null
    }
  }

  /**
   * 列出所有日志文件
   */
  static async listLogFiles(): Promise<string[]> {
    try {
      await ensureLogsDir()
      const files = await fs.readdir(LOGS_DIR)
      return files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''))
    }
    catch (error) {
      console.error('❌ Failed to list log files:', error)
      return []
    }
  }

  /**
   * 删除日志文件
   */
  static async deleteLogFile(threadId: string): Promise<void> {
    try {
      const logFilePath = path.join(LOGS_DIR, `${threadId}.json`)
      await fs.unlink(logFilePath)
      console.log(`🗑️  Deleted event log: ${threadId}`)
    }
    catch (error) {
      console.error(`❌ Failed to delete log file for thread: ${threadId}`, error)
      throw error
    }
  }

  /**
   * 清空所有日志文件
   */
  static async clearAllLogs(): Promise<void> {
    try {
      const threadIds = await ChatLogger.listLogFiles()
      for (const threadId of threadIds) {
        await ChatLogger.deleteLogFile(threadId)
      }
      console.log(`🗑️  Cleared all event logs (${threadIds.length} files)`)
    }
    catch (error) {
      console.error('❌ Failed to clear all logs:', error)
      throw error
    }
  }
}
