import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../../config'

/**
 * 调试日志工具
 * 通过环境变量 DEBUG 控制是否输出日志
 * 日志会输出到文件：CHECKPOINT_DIR/logs/{thread_id}.log
 */
export class DebugLogger {
  private static enabled: boolean = env.DEBUG
  private static logDir: string | null = null
  private static logFile: string | null = null
  private static writeStream: fs.FileHandle | null = null
  private static initialized: boolean = false

  /**
   * 初始化日志文件
   * @param threadId 线程ID，用作日志文件名
   */
  static async initialize(threadId?: string): Promise<void> {
    if (!this.enabled || this.initialized) {
      return
    }

    try {
      if (!env.CHECKPOINT_DIR) {
        console.warn('[DebugLogger] CHECKPOINT_DIR not set, logs will not be saved to file')
        return
      }

      // 创建日志目录
      this.logDir = path.join(env.CHECKPOINT_DIR, 'logs')
      await fs.mkdir(this.logDir, { recursive: true })

      // 使用 thread_id 作为文件名，如果没有则使用时间戳
      const fileName = threadId ? `${threadId}.log` : `debug-${Date.now()}.log`
      this.logFile = path.join(this.logDir, fileName)

      // 打开文件流（追加模式）
      this.writeStream = await fs.open(this.logFile, 'a')

      this.initialized = true
      // 写入初始化信息
      const initMessage = `[DEBUG:system] ${new Date().toISOString()} - DebugLogger initialized ${JSON.stringify({ threadId, logFile: this.logFile }, null, 2)}\n`
      await this.writeStream.write(initMessage)
    }
    catch (error) {
      console.error('[DebugLogger] Failed to initialize file logging:', error)
    }
  }

  /**
   * 写入日志到文件
   */
  private static async writeToFile(category: string, message: string, data?: any): Promise<void> {
    if (!this.writeStream || !this.logFile) {
      return
    }

    try {
      const timestamp = new Date().toISOString()
      const prefix = `[DEBUG:${category}]`
      let logLine = `${prefix} ${timestamp} - ${message}`

      if (data !== undefined) {
        logLine += ` ${JSON.stringify(data, null, 2)}\n`
      }
      else {
        logLine += '\n'
      }

      await this.writeStream.write(logLine)
    }
    catch (error) {
      console.error('[DebugLogger] Failed to write to log file:', error)
    }
  }

  /**
   * 关闭日志文件
   */
  static async close(): Promise<void> {
    if (this.writeStream) {
      try {
        await this.writeStream.close()
        this.writeStream = null
        this.initialized = false
      }
      catch (error) {
        console.error('[DebugLogger] Failed to close log file:', error)
      }
    }
  }

  /**
   * 检查调试日志是否启用
   */
  static isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 输出调试日志
   * @param category 日志分类（如 'tool-calls', 'chunk', 'message'）
   * @param message 日志消息
   * @param data 附加数据（可选）
   */
  static async log(category: string, message: string, data?: any): Promise<void> {
    if (!this.enabled)
      return

    const timestamp = new Date().toISOString()
    const prefix = `[DEBUG:${category}]`

    // 写入文件
    await this.writeToFile(category, message, data)

    // 同时输出到控制台（方便开发时查看）
    if (data !== undefined) {
      console.log(`${prefix} ${timestamp} - ${message}`, data)
    }
    else {
      console.log(`${prefix} ${timestamp} - ${message}`)
    }
  }

  /**
   * 输出结构化的调试信息
   * @param category 日志分类
   * @param title 标题
   * @param obj 要输出的对象
   */
  static async logObject(category: string, title: string, obj: any): Promise<void> {
    if (!this.enabled)
      return

    const timestamp = new Date().toISOString()
    const prefix = `[DEBUG:${category}]`

    // 写入文件
    await this.writeToFile(category, title, obj)

    // 同时输出到控制台
    console.group(`${prefix} ${timestamp} - ${title}`)
    console.log(JSON.stringify(obj, null, 2))
    console.groupEnd()
  }

  /**
   * 输出工具调用相关的调试信息
   */
  static async logToolCalls(toolCalls: any, source: string = 'unknown'): Promise<void> {
    if (!this.enabled)
      return

    await this.log('tool-calls', `Tool calls from ${source}:`, {
      count: toolCalls?.length || 0,
      toolCalls: toolCalls || [],
    })
  }

  /**
   * 输出 chunk 相关的调试信息
   */
  static async logChunk(chunk: any, index?: number): Promise<void> {
    if (!this.enabled)
      return

    const chunkInfo = {
      index,
      chunk,
    }

    await this.log('chunk', `Chunk ${index !== undefined ? `#${index}` : ''} structure:`, chunkInfo)
  }

  /**
   * 输出 aggregated message 的调试信息
   */
  static async logAggregatedMessage(msg: any): Promise<void> {
    if (!this.enabled)
      return

    await this.logObject('aggregated-message', 'Aggregated Message Structure', msg)
  }

  /**
   * 输出警告信息（始终输出，不受 DEBUG 控制）
   */
  static warn(message: string, data?: any): void {
    const timestamp = new Date().toISOString()
    if (data !== undefined) {
      console.warn(`[WARN] ${timestamp} - ${message}`, data)
    }
    else {
      console.warn(`[WARN] ${timestamp} - ${message}`)
    }
  }

  /**
   * 输出错误信息（始终输出，不受 DEBUG 控制）
   */
  static error(message: string, error?: any): void {
    const timestamp = new Date().toISOString()
    if (error !== undefined) {
      console.error(`[ERROR] ${timestamp} - ${message}`, error)
    }
    else {
      console.error(`[ERROR] ${timestamp} - ${message}`)
    }
  }
}
