import type { StreamEvent } from '../../types.js'

/**
 * Planning 阶段事件处理器
 * 处理规划阶段的所有事件转换
 */
export class PlanningPhaseHandler {
  private state = {
    planGenerated: false,
    planningStatus: 'analyzing' as 'analyzing' | 'drafting' | 'generated',
    planningContentDisplayed: false,
  }

  /**
   * 处理 LangGraph 事件
   * @param event - LangGraph 原始事件
   * @param enableThinking - 是否启用思考模式
   * @returns 转换后的 SSE 事件数组
   */
  handleEvent(event: any, enableThinking: boolean = false): StreamEvent[] {
    const events: StreamEvent[] = []
    const eventType = event.event
    const tags = event.tags || []

    // 1. 处理 planning_thinking (on_custom_event + reasoning_chunk + orchestrator_planning)
    if (
      eventType === 'on_custom_event'
      && event.name === 'reasoning_chunk'
      && tags.includes('orchestrator_planning')
      && !this.state.planGenerated
      && enableThinking
    ) {
      const thinkingText = (event.data as any)?.text
      if (thinkingText) {
        events.push({
          type: 'planning_thinking',
          data: { text: thinkingText },
          timestamp: Date.now(),
        })
      }
    }

    // 2. 处理 planning_content (on_chat_model_stream + orchestrator_planning)
    if (
      eventType === 'on_chat_model_stream'
      && tags.includes('orchestrator_planning')
      && !this.state.planGenerated
    ) {
      const chunk = event.data?.chunk
      const content = this.extractContent(chunk)

      if (content && content.length > 0) {
        // 首次收到内容时，发送 plan_status: 'drafting'
        if (!this.state.planningContentDisplayed) {
          events.push({
            type: 'plan_status',
            data: { status: 'drafting' },
            timestamp: Date.now(),
          })
          this.state.planningStatus = 'drafting'
          this.state.planningContentDisplayed = true
        }

        // 发送内容片段
        events.push({
          type: 'planning_content',
          data: { text: content },
          timestamp: Date.now(),
        })
      }
    }

    // 3. 处理 plan (on_chain_end + orchestrator + plan)
    if (eventType === 'on_chain_end' && event.name === 'orchestrator') {
      const plan = event.data?.output?.plan

      if (plan && Array.isArray(plan) && plan.length > 0 && !this.state.planGenerated) {
        console.log(`[PlanningPhaseHandler] 📋 生成计划: 任务数量=${plan.length}`)
        // 流式发送每个任务项
        for (const task of plan) {
          const taskId = task.taskId || task.id || String(Date.now())
          const taskDescription = task.task || task.description || ''
          console.log(`[PlanningPhaseHandler]   - taskId=${taskId}: "${taskDescription}"`)

          events.push({
            type: 'plan',
            data: {
              task: {
                taskId,
                task: taskDescription,
                dependencies: task.dependencies || [],
              },
            },
            timestamp: Date.now(),
          })
        }

        // 发送 plan_status: 'generated'
        events.push({
          type: 'plan_status',
          data: { status: 'generated' },
          timestamp: Date.now(),
        })

        this.state.planGenerated = true
        this.state.planningStatus = 'generated'
      }
    }

    return events
  }

  /**
   * 提取内容文本
   */
  private extractContent(chunk: any): string {
    if (!chunk) {
      return ''
    }

    // 如果是字符串，直接返回
    if (typeof chunk.content === 'string') {
      return chunk.content
    }

    // 如果是数组，提取文本
    if (Array.isArray(chunk.content)) {
      return chunk.content
        .map((c: any) => {
          if (typeof c === 'string') {
            return c
          }
          return c?.text || ''
        })
        .join('')
    }

    return ''
  }

  /**
   * 获取当前状态
   */
  getState() {
    return { ...this.state }
  }

  /**
   * 检查计划是否已生成
   */
  isPlanGenerated(): boolean {
    return this.state.planGenerated
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      planGenerated: false,
      planningStatus: 'analyzing',
      planningContentDisplayed: false,
    }
  }
}
