import type { Message, StreamEvent } from '../types.js'
import { OrchestratorEventHandler } from './OrchestratorEventHandler.js'
import { SimpleEventHandler } from './SimpleEventHandler.js'

/**
 * 事件管理器
 * 统一的事件处理入口，负责路由到不同的处理器
 */
export class EventHandlerManager {
  private orchestratorHandler: OrchestratorEventHandler
  private simpleHandler: SimpleEventHandler
  private messages: Message[] = []
  private sessionId: string | null = null
  private currentMode: 'orchestrator' | 'simple' | 'auto' = 'auto'
  private currentUserMessageId: string | null = null

  constructor() {
    this.orchestratorHandler = new OrchestratorEventHandler()
    this.simpleHandler = new SimpleEventHandler()
  }

  /**
   * 处理 SSE 事件
   */
  handleEvent(event: StreamEvent): void {
    const { type, data } = event

    // 处理 session 事件
    if (type === 'session') {
      this.sessionId = data.sessionId || null
      return
    }

    // 处理 error 事件
    if (type === 'error') {
      const errorMessage: Message = {
        id: this.generateMessageId(),
        type: 'ai',
        content: data.message || '发生错误',
        rawText: data.message || '发生错误',
        phase: undefined,
        eventType: 'error',
        timestamp: event.timestamp || Date.now(),
      }
      this.addMessage(errorMessage)
      return
    }

    // 处理 done 事件（标记流式输出完成）
    if (type === 'done') {
      /**
       * 优化3：done 事件时，更新 synthesis 状态为 completed
       */
      const synthesisMessages = this.messages.filter(msg => msg.phase === 'synthesis')
      for (const msg of synthesisMessages) {
        if (msg.synthesisData) {
          msg.synthesisData.status = 'completed'
        }
      }
      return
    }

    /**
     * 根据模式路由到不同的处理器
     */
    const onMessageUpdate = (message: Message) => {
      // 如果消息没有 userMessageId，且当前有用户消息 ID，则设置它
      if (!message.userMessageId && this.currentUserMessageId) {
        message.userMessageId = this.currentUserMessageId
      }
      this.updateOrAddMessage(message)
    }

    // 判断应该使用哪个处理器
    const useOrchestrator = this.shouldUseOrchestrator(type)

    if (useOrchestrator) {
      this.orchestratorHandler.handleEvent(event, onMessageUpdate)
    }
    else {
      this.simpleHandler.handleEvent(event, onMessageUpdate)
    }
  }

  /**
   * 判断是否应该使用 Orchestrator 处理器
   */
  private shouldUseOrchestrator(eventType: StreamEvent['type']): boolean {
    // 如果明确指定了模式，使用指定模式
    if (this.currentMode === 'orchestrator') {
      return true
    }
    if (this.currentMode === 'simple') {
      return false
    }

    // auto 模式：根据事件类型判断
    const orchestratorEventTypes: StreamEvent['type'][] = [
      'plan_status',
      'planning_thinking',
      'planning_content',
      'plan',
      'worker_start',
      'worker_thinking',
      'worker_content',
      'worker_status',
      'worker_complete',
      'synthesis_status',
      'synthesis_thinking',
      'synthesis_content',
      'tool_call',
      'tool_result',
    ]

    return orchestratorEventTypes.includes(eventType)
  }

  /**
   * 更新或添加消息
   */
  private updateOrAddMessage(message: Message): void {
    const existingIndex = this.messages.findIndex(msg => msg.id === message.id)

    if (existingIndex >= 0) {
      // 更新现有消息
      this.messages[existingIndex] = message
    }
    else {
      // 添加新消息
      this.messages.push(message)
    }
  }

  /**
   * 设置当前模式
   */
  setMode(mode: 'orchestrator' | 'simple' | 'auto'): void {
    this.currentMode = mode
  }

  /**
   * 设置当前用户消息 ID
   */
  setUserMessageId(userMessageId: string): void {
    this.currentUserMessageId = userMessageId
  }

  /**
   * 获取当前用户消息 ID
   */
  getUserMessageId(): string | null {
    return this.currentUserMessageId
  }

  /**
   * 获取所有消息
   * 直接返回原始消息，不进行拆分
   * 前端 message-item.vue 会根据消息中的 phase 数据来显示对应的内容
   */
  getMessages(): Message[] {
    return this.messages
  }

  /**
   * 获取特定阶段的消息
   */
  getPhaseMessages(phase: 'planning' | 'worker' | 'synthesis'): Message[] {
    return this.messages.filter(msg => msg.phase === phase)
  }

  /**
   * 获取 sessionId
   */
  getSessionId(): string | null {
    return this.sessionId
  }

  /**
   * 重置状态（新会话时）
   */
  reset(): void {
    this.messages = []
    this.sessionId = null
    this.currentUserMessageId = null
    this.orchestratorHandler.reset()
    this.simpleHandler.reset()
  }

  /**
   * 重置处理器状态（保留消息，只重置处理器内部状态）
   * 用于历史记录加载时，确保每个用户消息生成新的AI消息
   */
  resetHandlers(): void {
    this.orchestratorHandler.reset()
    this.simpleHandler.reset()
  }

  /**
   * 添加消息
   */
  protected addMessage(message: Message): void {
    this.messages.push(message)
  }

  /**
   * 更新消息
   */
  protected updateMessage(messageId: string, updater: (msg: Message) => void): void {
    const message = this.messages.find(msg => msg.id === messageId)
    if (message) {
      updater(message)
    }
  }

  /**
   * 查找消息
   */
  protected findMessage(predicate: (msg: Message) => boolean): Message | undefined {
    return this.messages.find(predicate)
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
}
