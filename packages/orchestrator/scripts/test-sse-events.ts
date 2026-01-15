/**
 * 测试 SSE 事件流
 * 连接到 API 服务并打印所有接收到的事件
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const API_URL = process.env.API_URL || 'http://localhost:3000'
const MESSAGE = process.argv[2] || '打开窗口名称为"Baidu","Bing"两个窗口，然后分别访问baidu,bing并搜索指纹浏览器。看看排在第一位的是哪个品牌，然后就关闭浏览器。'

interface StreamEvent {
  type: string
  data: any
  timestamp?: number
}

interface SSEEventLogEntry {
  timestamp: string
  eventType: string
  data: any
  receivedAt: string
}

/**
 * SSE 事件日志记录器
 */
class SSEEventLogger {
  private logFile: string
  private entries: SSEEventLogEntry[] = []
  private sessionId?: string
  private message?: string

  constructor(logDir: string) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')
    this.logFile = path.join(logDir, `sse-events-${timestamp}.jsonl`)
  }

  /**
   * 设置会话信息
   */
  setSession(sessionId: string, message: string): void {
    this.sessionId = sessionId
    this.message = message
  }

  /**
   * 记录一个 SSE 事件
   */
  async logEvent(event: StreamEvent): Promise<void> {
    const entry: SSEEventLogEntry = {
      timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
      eventType: event.type,
      data: event.data,
      receivedAt: new Date().toISOString(),
    }

    this.entries.push(entry)
    await this.flush()
  }

  /**
   * 将条目写入磁盘（JSONL 格式）
   */
  private async flush(): Promise<void> {
    try {
      const content = this.entries.map(e => JSON.stringify(e)).join('\n')
      await fs.writeFile(this.logFile, content, 'utf-8')
    }
    catch (error) {
      console.error('[SSEEventLogger] 写入日志文件失败:', error)
    }
  }

  /**
   * 保存会话摘要
   */
  async saveSummary(): Promise<void> {
    try {
      const summaryFile = this.logFile.replace('.jsonl', '-summary.json')
      const summary = {
        sessionId: this.sessionId,
        message: this.message,
        startTime: this.entries[0]?.receivedAt,
        endTime: this.entries[this.entries.length - 1]?.receivedAt,
        totalEvents: this.entries.length,
        eventTypes: this.entries.reduce((acc, e) => {
          acc[e.eventType] = (acc[e.eventType] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        logFile: this.logFile,
      }

      await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf-8')
      console.log(`\n📝 会话摘要已保存: ${summaryFile}`)
    }
    catch (error) {
      console.error('[SSEEventLogger] 保存会话摘要失败:', error)
    }
  }

  /**
   * 关闭日志器
   */
  async close(): Promise<void> {
    await this.flush()
    await this.saveSummary()
    console.log(`📁 事件日志已保存: ${this.logFile}`)
    console.log(`   - 总事件数: ${this.entries.length}`)
  }
}

/**
 * 格式化事件数据用于显示
 */
function formatEvent(event: StreamEvent): string {
  const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString()
  const dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data, null, 2)

  return `[${timestamp}] ${event.type}\n${dataStr}`
}

/**
 * 使用 fetch 接收 SSE 流
 */
async function testSSE() {
  console.log('🚀 开始测试 SSE 事件流')
  console.log(`📡 API URL: ${API_URL}`)
  console.log(`💬 Message: ${MESSAGE}\n`)
  console.log('─'.repeat(80))

  // 创建日志目录
  const logDir = path.join(process.cwd(), 'logs', 'test-sse')
  await fs.mkdir(logDir, { recursive: true })

  // 创建事件日志器
  const eventLogger = new SSEEventLogger(logDir)

  try {
    // 创建 session
    const sessionResponse = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          thinkingEnabled: true,
          mode: 'orchestrator',
        },
      }),
    })

    if (!sessionResponse.ok) {
      throw new Error(`Failed to create session: ${sessionResponse.statusText}`)
    }

    const sessionData = await sessionResponse.json()
    const sessionId = sessionData.sessionId
    console.log(`✅ Session created: ${sessionId}\n`)

    // 设置日志器的会话信息
    eventLogger.setSession(sessionId, MESSAGE)

    // 发送聊天请求
    const chatResponse = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: MESSAGE,
        sessionId,
        thinkingEnabled: true,
        mode: 'orchestrator',
      }),
    })

    if (!chatResponse.ok) {
      throw new Error(`Failed to send chat: ${chatResponse.statusText}`)
    }

    if (!chatResponse.body) {
      throw new Error('Response body is null')
    }

    // 使用 ReadableStream 读取 SSE 流
    const reader = chatResponse.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    console.log('📥 开始接收事件流...\n')

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        console.log('\n✅ 事件流结束')
        await eventLogger.close()
        break
      }

      // 解码数据
      buffer += decoder.decode(value, { stream: true })

      // 处理完整的 SSE 消息
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留最后一个不完整的行

      let currentEvent: {
        type?: string
        data?: string
        timestamp?: string
      } = {}

      for (const line of lines) {
        if (line.trim() === '') {
          // 空行表示一个完整的事件
          if (currentEvent.type) {
            try {
              const event: StreamEvent = {
                type: currentEvent.type!,
                data: currentEvent.data ? JSON.parse(currentEvent.data) : {},
                timestamp: currentEvent.timestamp ? Number.parseInt(currentEvent.timestamp, 10) : undefined,
              }

              // 记录事件到日志文件
              await eventLogger.logEvent(event)

              console.log(formatEvent(event))
              console.log('─'.repeat(80))
            }
            catch (error) {
              console.error(`❌ 解析事件失败:`, error)
              console.log(`原始数据:`, currentEvent)
            }
          }
          currentEvent = {}
          continue
        }

        // 解析 SSE 格式: "field: value"
        const colonIndex = line.indexOf(':')
        if (colonIndex === -1) {
          continue
        }

        const field = line.substring(0, colonIndex).trim()
        const value = line.substring(colonIndex + 1).trim()

        if (field === 'event') {
          currentEvent.type = value
        }
        else if (field === 'data') {
          currentEvent.data = value
        }
        else if (field === 'id') {
          // id 字段存储为字符串，稍后解析为数字
          currentEvent.timestamp = value
        }
      }
    }
  }
  catch (error: any) {
    console.error('❌ 测试失败:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    // 即使出错也尝试保存日志
    try {
      await eventLogger.close()
    }
    catch (logError) {
      console.error('保存日志失败:', logError)
    }
    process.exit(1)
  }
}

// 运行测试
testSSE().catch((error) => {
  console.error('❌ 未处理的错误:', error)
  process.exit(1)
})
