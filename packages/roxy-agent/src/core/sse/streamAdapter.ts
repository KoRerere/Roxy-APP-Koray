/**
 * Event types for SSE stream
 */
import type { AgentErrorEnvelope } from '../agentError'
import { statusToCode } from '../agentError'

export type StreamEventType
  = | 'session'
    | 'thinking' // Simple 模式
    | 'planning'
    | 'worker_content'
    | 'worker_thinking'
    | 'worker_result'
    | 'worker_stopped'
    | 'worker_dispatch' // 并行任务下发：携带 worker 的任务标题，用于前端卡片展示
    | 'orchestrator_stopped'
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
  thinkingEvent(text: string, thinkingId: string, taskId?: string): StreamEvent {
    if (taskId) {
      return this.workerThinkingEvent(taskId, text, thinkingId)
    }
    return {
      type: 'thinking',
      data: { text, thinkingId },
      timestamp: Date.now(),
    }
  }

  thinking(text: string, thinkingId: string, taskId?: string): string {
    return this.formatSSE(this.thinkingEvent(text, thinkingId, taskId))
  }

  /**
   * Create content event (流式)
   * @param text
   * @returns string
   */
  contentEvent(text: string, contentId: string, taskId?: string): StreamEvent {
    if (taskId) {
      return this.workerContentEvent(taskId, text, contentId)
    }
    return {
      type: 'content',
      data: { text, contentId },
      timestamp: Date.now(),
    }
  }

  content(text: string, contentId: string, taskId?: string): string {
    return this.formatSSE(this.contentEvent(text, contentId, taskId))
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
  workerThinkingEvent(taskId: string, text: string, thinkingId: string): StreamEvent {
    return {
      type: 'worker_thinking',
      data: { taskId, text, thinkingId },
      timestamp: Date.now(),
    }
  }

  workerThinking(taskId: string, text: string, thinkingId: string): string {
    return this.formatSSE(this.workerThinkingEvent(taskId, text, thinkingId))
  }

  workerContentEvent(taskId: string, text: string, contentId: string): StreamEvent {
    return {
      type: 'worker_content',
      data: { taskId, text, contentId },
      timestamp: Date.now(),
    }
  }

  workerContent(taskId: string, text: string, contentId: string): string {
    return this.formatSSE(this.workerContentEvent(taskId, text, contentId))
  }

  workerResultEvent(data: {
    taskId: string
    status: 'success' | 'failed'
    exitCode?: number | null
    signal?: NodeJS.Signals | null
    error?: any
    durationMs?: number
  }): StreamEvent {
    return {
      type: 'worker_result',
      data,
      timestamp: Date.now(),
    }
  }

  workerResult(data: {
    taskId: string
    status: 'success' | 'failed'
    exitCode?: number | null
    signal?: NodeJS.Signals | null
    error?: any
    durationMs?: number
  }): string {
    return this.formatSSE(this.workerResultEvent(data))
  }

  workerStoppedEvent(data: {
    taskId: string
    status: 'failed'
    reason: 'user'
    error: string
  }): StreamEvent {
    return {
      type: 'worker_stopped',
      data,
      timestamp: Date.now(),
    }
  }

  workerStopped(data: {
    taskId: string
    status: 'failed'
    reason: 'user'
    error: string
  }): string {
    return this.formatSSE(this.workerStoppedEvent(data))
  }

  /**
   * Create worker dispatch event —— 携带 worker 的任务标题，用于前端卡片展示。
   * 在 fork worker 子进程之前同步下发，保证先于该 worker 的任何内部事件到达前端。
   */
  workerDispatchEvent(data: { taskId: string, title: string }): StreamEvent {
    return {
      type: 'worker_dispatch',
      data,
      timestamp: Date.now(),
    }
  }

  workerDispatch(data: { taskId: string, title: string }): string {
    return this.formatSSE(this.workerDispatchEvent(data))
  }

  orchestratorStoppedEvent(data: {
    status: 'failed'
    reason: 'user'
    message: string
  }): StreamEvent {
    return {
      type: 'orchestrator_stopped',
      data,
      timestamp: Date.now(),
    }
  }

  orchestratorStopped(data: {
    status: 'failed'
    reason: 'user'
    message: string
  }): string {
    return this.formatSSE(this.orchestratorStoppedEvent(data))
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
   * Create error event.
   *
   * 兼容两种调用：
   * - 旧：`error(message, httpStatus?)` —— 仍输出 `data.errorCode` 供旧前端 / 历史回放使用
   * - 新：`error(envelope)` —— 输出稳定的 `code` / `category` / `retryable` / `requestId` 等字段
   *
   * 统一输出契约（见 docs/error_codes.md，前端优先用 `code` 分支）：
   * `{ code, category, message, retryable, requestId?, httpStatus?, source, errorCode? }`
   * 其中 `errorCode` 是 `httpStatus` 的别名，仅为向后兼容保留。
   */
  error(messageOrEnvelope: string | AgentErrorEnvelope, errorCode?: number): string {
    if (typeof messageOrEnvelope === 'string') {
      return this.formatSSE({
        type: 'error',
        data: {
          code: errorCode ? statusToCode(errorCode) : 'agent_internal_error',
          message: messageOrEnvelope,
          category: 'internal',
          retryable: false,
          source: 'agent',
          httpStatus: errorCode,
          errorCode,
        },
        timestamp: Date.now(),
      })
    }

    const { code, message, data } = messageOrEnvelope
    return this.formatSSE({
      type: 'error',
      data: {
        code,
        message,
        category: data.category,
        retryable: data.retryable,
        source: data.source,
        requestId: data.requestId,
        provider: data.provider,
        model: data.model,
        httpStatus: data.httpStatus,
        // 向后兼容旧前端字段（status-message.vue 旧逻辑读取 errorCode）
        errorCode: data.httpStatus,
      },
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
  toolCallEvent(data: { toolName: string, args: any, taskId?: string, toolId?: string }): StreamEvent {
    return {
      type: 'tool_call',
      data,
      timestamp: Date.now(),
    }
  }

  toolCall(data: { toolName: string, args: any, taskId?: string, toolId?: string }): string {
    return this.formatSSE(this.toolCallEvent(data))
  }

  /**
   * Create tool result event
   */
  toolResultEvent(data: { toolName: string, result: any, et?: number, taskId?: string, toolId?: string, status?: 'success' | 'failed' }): StreamEvent {
    return {
      type: 'tool_result',
      data: { ...data },
      timestamp: Date.now(),
    }
  }

  toolResult(data: { toolName: string, result: any, et?: number, taskId?: string, toolId?: string, status?: 'success' | 'failed' }): string {
    return this.formatSSE(this.toolResultEvent(data))
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

  todoEvent(data: any): StreamEvent {
    return {
      type: 'todo',
      data,
      timestamp: Date.now(),
    }
  }

  todo(data: any): string {
    return this.formatSSE(this.todoEvent(data))
  }

  workerTodoEvent(workerId: string, data: any): StreamEvent {
    return {
      type: 'worker_todo',
      data: { ...data, workerId },
      timestamp: Date.now(),
    }
  }

  workerTodo(workerId: string, data: any): string {
    return this.formatSSE(this.workerTodoEvent(workerId, data))
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
