import type { AIMessageStructure, StreamEvent } from './types.js'
/**
 * 消息收集器
 * 用于在流式输出过程中收集所有事件，并在完成后构建完整的 AI 消息
 */
export class MessageCollector {
  private events: StreamEvent[] = []
  private aiMessageId: string
  private userMessageId: string
  private threadId: string
  private userId: string

  constructor(aiMessageId: string, userMessageId: string, threadId: string, userId: string) {
    this.aiMessageId = aiMessageId
    this.userMessageId = userMessageId
    this.threadId = threadId
    this.userId = userId
  }

  /**
   * 收集事件
   */
  collectEvent(event: StreamEvent): void {
    // 过滤掉不需要保存的事件类型
    const excludeEventTypes = ['user_message_id', 'session']
    if (!excludeEventTypes.includes(event.type)) {
      this.events.push({
        ...event,
        timestamp: event.timestamp || Date.now(),
      })
    }
  }

  /**
   * 构建完整的 AI 消息
   */
  buildAIMessage(): AIMessageStructure {
    const message: Partial<AIMessageStructure> = {
      id: this.aiMessageId,
      userMessageId: this.userMessageId,
      threadId: this.threadId,
      userId: this.userId,
      content: '',
      rawText: '',
      timestamp: Date.now(),
    }

    // 分析事件，构建消息内容
    let currentPhase: 'simple' | 'planning' | 'worker' | 'synthesis' | undefined
    const planningData = { status: '', thinking: '', content: '', plan: [] as any[] }
    const synthesisData = { status: '', thinking: '', content: '' }
    const workers = new Map<string, any>()
    const toolCalls: any[] = []
    let tokenUsage: any = null

    for (const event of this.events) {
      const { type, data } = event

      // 确定阶段
      if (type.startsWith('planning_') || type === 'plan_status' || type === 'plan') {
        currentPhase = 'planning'
      }
      else if (type.startsWith('worker_') || type === 'worker_start' || type === 'worker_complete') {
        currentPhase = 'worker'
      }
      else if (type.startsWith('synthesis_')) {
        currentPhase = 'synthesis'
      }
      else if (type === 'content' || type === 'thinking') {
        // 如果没有明确的阶段，默认为 simple
        if (!currentPhase) {
          currentPhase = 'simple'
        }
      }

      // 处理不同类型的事件
      switch (type) {
        case 'thinking':
        case 'content':
          if (currentPhase === 'simple') {
            const text = data?.text || ''
            message.content += text
            message.rawText += text
          }
          break

        case 'planning_thinking':
          planningData.thinking += data?.text || ''
          break

        case 'planning_content':
          planningData.content += data?.text || ''
          break

        case 'plan_status':
          planningData.status = data?.status || planningData.status
          break

        case 'plan':
          if (data?.plan && Array.isArray(data.plan)) {
            planningData.plan = data.plan
          }
          break

        case 'worker_start':
        case 'worker_thinking':
        case 'worker_content':
        case 'worker_status':
        case 'worker_complete':
        { const taskId = data?.taskId
          if (data?.taskId) {
            if (!workers.has(taskId)) {
              workers.set(taskId, {
                taskId,
                task: data?.task || '',
                status: 'pending',
                thinking: '',
                content: '',
                toolCalls: [],
              })
            }
            const worker = workers.get(taskId)

            if (type === 'worker_thinking') {
              worker.thinking += data?.text || ''
            }
            else if (type === 'worker_content') {
              worker.content += data?.text || ''
            }
            else if (type === 'worker_start') {
              worker.task = data?.task || worker.task
              worker.status = data?.status || 'pending'
            }
            else if (type === 'worker_status') {
              worker.status = data?.status || worker.status
            }
            else if (type === 'worker_complete') {
              worker.status = 'completed'
            }
          }
          break }

        case 'synthesis_thinking':
          synthesisData.thinking += data?.text || ''
          break

        case 'synthesis_content':
          synthesisData.content += data?.text || ''
          break

        case 'synthesis_status':
          synthesisData.status = data?.status || synthesisData.status
          break

        case 'tool_call':
        { const toolCall = {
          toolName: data?.toolName || '',
          args: data?.args || {},
          taskId: data?.taskId,
        }
        toolCalls.push(toolCall)

        // 如果有 taskId，也添加到对应的 worker
        if (data?.taskId && workers.has(data.taskId)) {
          workers.get(data.taskId).toolCalls.push(toolCall)
        }
        break }

        case 'tool_result':
        { const resultToolName = data?.toolName
          const result = data?.result
          const executionTime = data?.executionTime

          // 更新对应的工具调用结果
          const targetToolCall = toolCalls.find(tc =>
            tc.toolName === resultToolName
            && tc.taskId === data?.taskId
            && !tc.result,
          )
          if (targetToolCall) {
            targetToolCall.result = result
            targetToolCall.executionTime = executionTime
          }

          // 如果有 taskId，也更新 worker 中的工具调用
          if (data?.taskId && workers.has(data.taskId)) {
            const workerToolCall = workers.get(data.taskId).toolCalls.find((tc: any) =>
              tc.toolName === resultToolName && !tc.result,
            )
            if (workerToolCall) {
              workerToolCall.result = result
              workerToolCall.executionTime = executionTime
            }
          }
          break }

        case 'token_usage':
          tokenUsage = {
            input: data?.prompt_tokens || data?.input || 0,
            output: data?.completion_tokens || data?.output || 0,
            total: data?.total_tokens || data?.total || 0,
          }
          break
      }
    }

    // 设置阶段和相关数据
    message.phase = currentPhase

    if (currentPhase === 'planning' && (planningData.content || planningData.thinking || planningData.plan.length > 0)) {
      message.planningData = planningData
    }

    if (currentPhase === 'synthesis' && (synthesisData.content || synthesisData.thinking)) {
      message.synthesisData = synthesisData
    }

    if (workers.size > 0) {
      message.workers = Array.from(workers.values())
      // 向后兼容：如果只有一个 worker，也设置 workerData
      if (workers.size === 1) {
        message.workerData = Array.from(workers.values())[0]
      }
    }

    if (toolCalls.length > 0) {
      message.toolCalls = toolCalls
    }

    if (tokenUsage) {
      message.tokenUsage = tokenUsage
    }

    return message as AIMessageStructure
  }

  /**
   * 获取收集的事件数量
   */
  getEventCount(): number {
    return this.events.length
  }

  /**
   * 清空收集的事件
   */
  clear(): void {
    this.events = []
  }
}
