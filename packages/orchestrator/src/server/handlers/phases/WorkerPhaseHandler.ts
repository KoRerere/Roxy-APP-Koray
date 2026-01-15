import type { StreamEvent } from '../../types.js'

/**
 * Worker 阶段事件处理器
 * 处理 Worker 阶段的所有事件转换
 */
export class WorkerPhaseHandler {
  private activeWorkers = new Map<string, WorkerState>()
  private eventBridgeSubscriptions = new Map<string, any>()

  /**
   * 处理 LangGraph 事件
   * @param event - LangGraph 原始事件
   * @param _eventBridge - EventBridge 实例，用于发送 worker 事件（已由 OrchestratorEventConverter 处理）
   * @param _enableThinking - 是否启用思考模式（已由 OrchestratorEventConverter 处理）
   * @returns 转换后的 SSE 事件数组
   */
  handleEvent(event: any, _eventBridge?: any, _enableThinking: boolean = false): StreamEvent[] {
    const events: StreamEvent[] = []
    const eventType = event.event
    const tags = event.tags || []

    // 方法1: 从 tags 中提取
    let taskId: string | null = null
    const workerIdTag = tags.find((t: string) => t.startsWith('worker_'))
    if (workerIdTag) {
      taskId = workerIdTag.replace('worker_', '')
    }
    // 方法2: 如果没有 tag，尝试从 event.data.input 中提取（worker 节点的事件）
    else if (event.name === 'worker' || event.name === 'generalWorker') {
      const input = event.data?.input
      if (input?.task) {
        taskId = String(input.task.id || input.task.taskId || '')
      }
      else if (input?.workerId) {
        taskId = input.workerId.replace('worker_', '')
      }
    }
    if (taskId) {
      // 1. 处理 worker_start (首次检测到 worker 真正开始时)
      // 注意：worker 可能在 setPlanTasks 时已经添加到 activeWorkers（状态为 pending，started: false）
      // 所以需要检查是否已经真正开始，而不是仅检查是否存在
      const existingWorker = this.activeWorkers.get(taskId)
      const shouldSendStartEvent = !existingWorker || !existingWorker.started

      if (shouldSendStartEvent) {
        // 从 plan 中获取 task 信息，如果没有则使用 taskId
        const task = this.getTaskDescription(taskId) || `Task ${taskId}`
        // 只在首次检测到 worker 真正开始时打印详细信息
        console.log(`[WorkerPhaseHandler] 🎯 Worker 开始执行: taskId=${taskId}, task="${task}", eventType=${eventType}, name=${event.name || 'N/A'}, tags=[${tags.join(', ')}]`)
        if (event.data?.input) {
          console.log(`[WorkerPhaseHandler]   input.task:`, JSON.stringify(event.data.input.task || event.data.input, null, 2))
        }

        // 如果 worker 不存在，先添加它
        if (!existingWorker) {
          this.addWorker(taskId, task)
        }

        const workerStartEvent = {
          type: 'worker_start',
          data: {
            taskId,
            task,
          },
          timestamp: Date.now(),
        } as StreamEvent

        const workerStatusEvent = {
          type: 'worker_status',
          data: {
            taskId,
            status: 'running',
          },
          timestamp: Date.now(),
        } as StreamEvent

        events.push(workerStartEvent)
        events.push(workerStatusEvent)

        this.updateWorkerStatus(taskId, 'running')
      }

      // 注意：worker 的 thinking 和 content 现在由 OrchestratorEventConverter 直接通过 EventBridge 发送
      // 这里不再重复处理，避免重复发送

      // 3. 处理 worker_complete (on_chain_end + worker/generalWorker)
      if (eventType === 'on_chain_end' && (event.name === 'worker' || event.name === 'generalWorker')) {
        const results = event.data?.output?.worker_results
        if (results && Array.isArray(results)) {
          const workerResult = results.find((r: any) => r.taskId === taskId)
          if (workerResult) {
            // EventBridge.complete 会触发 complete 事件，这里不需要额外处理
            // 但我们可以发送 worker_complete 事件（实际上会在 EventBridge 监听中发送）
            // 这里只更新状态
            this.updateWorkerStatus(taskId, 'completed')
          }
        }
      }
    }

    return events
  }

  /**
   * 添加 Worker
   */
  addWorker(taskId: string, task: string): void {
    this.activeWorkers.set(taskId, {
      taskId,
      task,
      status: 'pending',
      started: false,
    })
  }

  /**
   * 更新 Worker 状态
   */
  updateWorkerStatus(taskId: string, status: WorkerState['status']): void {
    const worker = this.activeWorkers.get(taskId)
    if (worker) {
      worker.status = status
      if (status === 'running') {
        worker.started = true
      }
    }
  }

  /**
   * 设置计划任务信息（从 PlanningPhaseHandler 获取）
   */
  setPlanTasks(tasks: Array<{ taskId: string, task: string }>): void {
    console.log(`[WorkerPhaseHandler] 📝 设置计划任务: 数量=${tasks.length}`)
    for (const task of tasks) {
      if (!this.activeWorkers.has(task.taskId)) {
        this.activeWorkers.set(task.taskId, {
          taskId: task.taskId,
          task: task.task,
          status: 'pending',
          started: false,
        })
        console.log(`[WorkerPhaseHandler]   - taskId=${task.taskId}: "${task.task}"`)
      }
    }
  }

  /**
   * 获取任务描述
   */
  getTaskDescription(taskId: string): string | undefined {
    const worker = this.activeWorkers.get(taskId)
    return worker?.task
  }

  /**
   * 获取 Worker 状态（供外部访问）
   */
  getWorker(taskId: string): WorkerState | undefined {
    return this.activeWorkers.get(taskId)
  }

  /**
   * 提取思考内容
   */
  private extractThinking(chunk: any): string | undefined {
    if (!chunk) {
      return undefined
    }

    // 尝试从不同位置提取 thinking
    const reasoning = chunk.additional_kwargs?.reasoning
      || (chunk.additional_kwargs as any)?.reasoning_content
      || (chunk as any).response_metadata?.reasoning

    if (reasoning) {
      return typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning)
    }

    return undefined
  }

  /**
   * 提取内容文本
   */
  private extractContent(chunk: any): string {
    if (!chunk) {
      return ''
    }

    if (typeof chunk.content === 'string') {
      return chunk.content
    }

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
   * 清理所有订阅
   */
  cleanup(): void {
    for (const subscription of this.eventBridgeSubscriptions.values()) {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe()
      }
    }
    this.eventBridgeSubscriptions.clear()
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.cleanup()
    this.activeWorkers.clear()
  }
}

interface WorkerState {
  taskId: string
  task: string
  status: 'pending' | 'running' | 'completed' | 'error'
  started: boolean
}
