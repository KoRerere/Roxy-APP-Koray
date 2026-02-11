/**
 * Event types for SSE stream
 */
export type StreamEventType
  = | 'session'
    | 'thinking' // Simple 模式
    | 'planning'
    | 'worker_content'
    | 'worker_thinking'
    | 'worker_result'
    | 'synthesis'
    | 'tool_call'
    | 'tool_result'
    | 'token_usage' // Token 使用信息
    | 'error'
    | 'done'
    | 'interrupt'
    | 'content'

export interface StreamEvent {
  type: StreamEventType
  data: any
  timestamp?: number
}

/**
 * Adapter to convert internal events to SSE format
 */
class StreamAdapter {
  /**
   * Format event as SSE message
   */
  formatSSE(event: StreamEvent): string {
    const data = JSON.stringify(event)
    const timestamp = event.timestamp || Date.now()

    return `event: ${event.type}\ndata: ${data}\nid: ${timestamp}\n\n`
  }

  // ==================== 会话管理类 ====================

  /**
   * Create session event
   */
  session(sessionId: string): string {
    return this.formatSSE({
      type: 'session',
      data: { sessionId },
      timestamp: Date.now(),
    })
  }

  // ==================== 规划阶段 (Planning Phase) ====================

  /**
   * Create planning thinking event (流式)
   */
  thinking(text: string, thinkingId: string): string {
    return this.formatSSE({
      type: 'thinking',
      data: { text, thinkingId },
      timestamp: Date.now(),
    })
  }

  /**
   * Create content event (流式)
   * @param text
   * @returns
   */
  content(text: string, contentId: string): string {
    return this.formatSSE({
      type: 'content',
      data: { text, contentId },
      timestamp: Date.now(),
    })
  }

  /**
   * Create planning content event (流式)
   */
  planning(text: string): string {
    return this.formatSSE({
      type: 'planning',
      data: { text },
      timestamp: Date.now(),
    })
  }

  // ==================== Worker 阶段 (Worker Phase) ====================

  /**
   * Create worker thinking event (流式)
   */
  workerThinking(taskId: string, text: string, thinkingId: string): string {
    return this.formatSSE({
      type: 'worker_thinking',
      data: { taskId, text, thinkingId },
      timestamp: Date.now(),
    })
  }

  workerContent(taskId: string, text: string, contentId: string): string {
    return this.formatSSE({
      type: 'worker_content',
      data: { taskId, text, contentId },
      timestamp: Date.now(),
    })
  }

  workerResult(data: { taskId: string, status: 'success' | 'failed', error?: any }): string {
    return this.formatSSE({
      type: 'worker_result',
      data,
      timestamp: Date.now(),
    })
  }

  // ==================== 综合阶段 (Synthesis Phase) ====================

  /**
   * Create synthesis thinking event (流式)
   */
  synthesis(text: string): string {
    return this.formatSSE({
      type: 'synthesis',
      data: { text },
      timestamp: Date.now(),
    })
  }

  // ==================== 系统类 ====================

  /**
   * Create error event
   */
  error(message: string, details?: any, taskId?: string): string {
    return this.formatSSE({
      type: 'error',
      data: { message, details, taskId },
      timestamp: Date.now(),
    })
  }

  /**
   * Create interrupt event
   */
  interrupt(message: string): string {
    return this.formatSSE({
      type: 'interrupt',
      data: { message },
      timestamp: Date.now(),
    })
  }

  /**
   * Create done event
   */
  done(finalAnswer?: string): string {
    return this.formatSSE({
      type: 'done',
      data: { finalAnswer },
      timestamp: Date.now(),
    })
  }

  // ==================== 工具调用类 ====================

  /**
   * Create tool call event
   */
  toolCall(data: { toolName: string, args: any, taskId?: string, toolId?: string }): string {
    return this.formatSSE({
      type: 'tool_call',
      data,
      timestamp: Date.now(),
    })
  }

  /**
   * Create tool result event
   */
  toolResult(data: { toolName: string, result: any, et?: number, taskId?: string, toolId?: string, status?: 'success' | 'failed' }): string {
    return this.formatSSE({
      type: 'tool_result',
      data: { ...data },
      timestamp: Date.now(),
    })
  }
  // ==================== Token Usage 类 ====================

  /**
   * Create token usage event
   */
  tokenUsage(data: { current: any, delta: any }): string {
    return this.formatSSE({
      type: 'token_usage',
      data,
      timestamp: Date.now(),
    })
  }
}

export const streamAdapter = new StreamAdapter()
