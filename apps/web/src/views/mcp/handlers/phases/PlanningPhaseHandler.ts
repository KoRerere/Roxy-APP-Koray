import type { Message, PlanTask, StreamEvent } from '../../types.js'

/**
 * Planning 阶段事件处理器
 * 处理规划阶段的所有事件转换
 */
export class PlanningPhaseHandler {
  private state = {
    status: 'analyzing' as 'analyzing' | 'drafting' | 'generated' | 'started' | 'generating' | 'completed',
    plan: [] as PlanTask[],
    thinking: '',
    content: '',
    messageId: null as string | null,
  }

  /**
   * 处理事件
   * @param event - SSE 事件
   * @param onMessageUpdate - 消息更新回调
   */
  handleEvent(event: StreamEvent, onMessageUpdate: (message: Message) => void): void {
    const { type, data } = event
    console.log('[PlanningPhaseHandler] 收到事件:', type, data)

    switch (type) {
      case 'plan_status': {
        const status = data.status as 'analyzing' | 'drafting' | 'generated'
        this.state.status = status

        // 创建或更新 planning 消息
        if (!this.state.messageId) {
          // 创建新的 planning 消息
          const messageId = this.generateMessageId()
          this.state.messageId = messageId

          const message: Message = {
            id: messageId,
            type: 'ai',
            content: '',
            phase: 'planning',
            eventType: 'plan_status',
            planningData: {
              status,
              plan: [],
              thinking: this.state.thinking,
              content: this.state.content,
            },
            timestamp: event.timestamp || Date.now(),
          }

          onMessageUpdate(message)
        }
        else {
          // 更新现有消息
          onMessageUpdate({
            id: this.state.messageId,
            type: 'ai',
            content: '',
            phase: 'planning',
            eventType: 'plan_status',
            planningData: {
              status,
              plan: [...this.state.plan],
              thinking: this.state.thinking,
              content: this.state.content,
            },
            timestamp: event.timestamp || Date.now(),
          } as Message)
        }
        break
      }

      case 'planning_thinking': {
        const text = data.text || ''
        this.state.thinking += text

        if (this.state.messageId) {
          onMessageUpdate({
            id: this.state.messageId,
            type: 'ai',
            content: '',
            phase: 'planning',
            eventType: 'planning_thinking',
            planningData: {
              status: this.state.status,
              plan: [...this.state.plan],
              thinking: this.state.thinking,
              content: this.state.content,
            },
            timestamp: event.timestamp || Date.now(),
          } as Message)
        }
        break
      }

      case 'planning_content': {
        const text = data.text || ''
        this.state.content += text

        // 如果 data 中有 status 字段，更新状态
        // Server 层可能发送 {type: 'content', phase: 'planning', status: 'started'/'generating'/'completed'}
        if (data.status) {
          const newStatus = data.status as 'started' | 'generating' | 'completed' | 'analyzing' | 'drafting' | 'generated'
          this.state.status = newStatus
        }

        // 如果 messageId 不存在，创建新的 planning 消息
        // 这通常发生在 status: 'started' 时
        if (!this.state.messageId) {
          const messageId = this.generateMessageId()
          this.state.messageId = messageId

          onMessageUpdate({
            id: messageId,
            type: 'ai',
            content: this.state.content,
            rawText: this.state.content,
            phase: 'planning',
            eventType: 'planning_content',
            planningData: {
              status: this.state.status,
              plan: [...this.state.plan],
              thinking: this.state.thinking,
              content: this.state.content,
            },
            timestamp: event.timestamp || Date.now(),
          } as Message)
        }
        else {
          // 更新现有消息
          onMessageUpdate({
            id: this.state.messageId,
            type: 'ai',
            content: this.state.content,
            rawText: this.state.content,
            phase: 'planning',
            eventType: 'planning_content',
            planningData: {
              status: this.state.status,
              plan: [...this.state.plan],
              thinking: this.state.thinking,
              content: this.state.content,
            },
            timestamp: event.timestamp || Date.now(),
          } as Message)
        }
        break
      }

      case 'plan': {
        const task = data.task as PlanTask
        if (task && task.taskId) {
          // 添加到计划列表
          this.state.plan.push({
            taskId: task.taskId,
            task: task.task,
            dependencies: task.dependencies || [],
            status: 'pending',
          })

          // 优化2：plan 事件时，不显示 content（因为 planning_content 已经显示过了）
          // 只显示 plan 列表，清空 content 避免重复
          if (this.state.messageId) {
            onMessageUpdate({
              id: this.state.messageId,
              type: 'ai',
              content: '', // 清空 content，只显示 plan
              rawText: '', // 清空 rawText
              phase: 'planning',
              eventType: 'plan',
              planningData: {
                status: this.state.status,
                plan: [...this.state.plan],
                thinking: this.state.thinking,
                content: '', // 不显示 content，避免与 planning_content 重复
              },
              timestamp: event.timestamp || Date.now(),
            } as Message)
          }
        }
        break
      }
    }
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `planning_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 获取当前计划
   */
  getCurrentPlan(): PlanTask[] {
    return this.state.plan
  }

  /**
   * 获取规划状态
   */
  getStatus(): 'analyzing' | 'drafting' | 'generated' | 'started' | 'generating' | 'completed' {
    return this.state.status
  }

  /**
   * 获取消息 ID
   */
  getMessageId(): string | null {
    return this.state.messageId
  }

  /**
   * 更新任务状态
   * @param taskId - 任务 ID
   * @param status - 新状态
   * @param onMessageUpdate - 消息更新回调
   */
  updateTaskStatus(
    taskId: string,
    status: 'pending' | 'running' | 'completed',
    onMessageUpdate: (message: Message) => void,
  ): void {
    const task = this.state.plan.find(t => t.taskId === taskId)
    if (task) {
      task.status = status

      // 更新消息
      if (this.state.messageId) {
        onMessageUpdate({
          id: this.state.messageId,
          type: 'ai',
          content: '',
          rawText: '',
          phase: 'planning',
          eventType: 'plan',
          planningData: {
            status: this.state.status,
            plan: [...this.state.plan],
            thinking: this.state.thinking,
            content: this.state.content,
          },
          timestamp: Date.now(),
        } as Message)
      }
    }
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      status: 'analyzing',
      plan: [],
      thinking: '',
      content: '',
      messageId: null,
    }
  }
}
