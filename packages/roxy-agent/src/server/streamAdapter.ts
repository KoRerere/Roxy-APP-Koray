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
    | 'todo'
    | 'worker_todo'
    | 'title' // 对话标题更新
    | 'hitl_interrupt' // HITL：等待人工审批，SSE 连接保持打开
    | 'hitl_resume' // HITL：人工审批结果（approve/reject/edit）
    | 'image_generating' // 图片生成开始（SSE 建立后立即推送，携带占位数量）
    | 'image_partial' // 单张图片生成完成（流式逐张推送）

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
  thinking(text: string, thinkingId: string, taskId?: string): string {
    if (taskId) {
      return this.workerThinking(taskId, text, thinkingId)
    }
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
  content(text: string, contentId: string, taskId?: string): string {
    if (taskId) {
      return this.workerContent(taskId, text, contentId)
    }
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
  error(message: string, errorCode?: number): string {
    return this.formatSSE({
      type: 'error',
      data: { message, errorCode },
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

  todo(data: any): string {
    return this.formatSSE({
      type: 'todo',
      data,
      timestamp: Date.now(),
    })
  }

  workerTodo(workerId: string, data: any): string {
    return this.formatSSE({
      type: 'worker_todo',
      data: { ...data, workerId },
      timestamp: Date.now(),
    })
  }

  /**
   * Create title update event
   */
  title(title: string): string {
    return this.formatSSE({
      type: 'title',
      data: { title },
      timestamp: Date.now(),
    })
  }

  /**
   * Create HITL interrupt event — agent pauses and waits for human decision via /resume endpoint
   */
  hitlInterrupt(data: { actionRequests: any[], reviewConfigs: any[], interruptsId: string }): string {
    return this.formatSSE({
      type: 'hitl_interrupt',
      data,
      timestamp: Date.now(),
    })
  }

  /**
   * Create HITL resume event — notify frontend that user has made a decision on a specific interrupt
   */
  hitlResume(data: { interruptsId: string, decisions: Array<{ type: 'approve' | 'reject' | 'edit', reason?: string, editedAction?: any }> }): string {
    return this.formatSSE({
      type: 'hitl_resume',
      data,
      timestamp: Date.now(),
    })
  }

  /**
   * Create image_generating event — sent immediately when SSE is established, carries placeholder count
   */
  imageGenerating(data: { count: number }): string {
    return this.formatSSE({
      type: 'image_generating',
      data,
      timestamp: Date.now(),
    })
  }

  /**
   * Create image_partial event — one image is done, push immediately
   */
  imagePartial(data: { index: number, image: any }): string {
    return this.formatSSE({
      type: 'image_partial',
      data,
      timestamp: Date.now(),
    })
  }
}

export const streamAdapter = new StreamAdapter()
