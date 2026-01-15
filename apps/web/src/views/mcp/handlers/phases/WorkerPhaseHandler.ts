import type { Message, StreamEvent, ToolCall, WorkerState } from '../../types.js'

/**
 * Worker 阶段事件处理器
 * 处理 Worker 阶段的所有事件转换
 */
export class WorkerPhaseHandler {
  private workers = new Map<string, WorkerState>()
  /**
   * taskId -> messageId
   */
  private workerMessages = new Map<string, string>()

  /**
   * 获取所有 workers 数据（用于合并到消息中）
   */
  private getAllWorkers() {
    return Array.from(this.workers.values()).map(w => ({
      taskId: w.taskId,
      task: w.task,
      status: w.status,
      thinking: w.thinking,
      content: w.content,
      toolCalls: w.toolCalls || [],
    }))
  }

  /**
   * 处理事件
   * @param event - SSE 事件
   * @param onMessageUpdate - 消息更新回调
   */
  handleEvent(event: StreamEvent, onMessageUpdate: (message: Message) => void): void {
    const { type, data } = event

    switch (type) {
      case 'worker_start': {
        const taskId = data.taskId as string
        const task = data.task as string

        if (!taskId) {
          return
        }

        // 创建 worker 状态
        const worker: WorkerState = {
          taskId,
          task,
          status: 'pending',
          thinking: '',
          content: '',
          toolCalls: [],
        }

        this.workers.set(taskId, worker)

        // 创建 worker 消息
        const messageId = this.generateMessageId()
        this.workerMessages.set(taskId, messageId)

        // 获取所有 workers（包括刚创建的）
        const allWorkers = this.getAllWorkers()

        const message: Message = {
          id: messageId,
          type: 'ai',
          content: '',
          phase: 'worker',
          eventType: 'worker_start',
          workerData: {
            taskId,
            task,
            status: 'pending',
            thinking: '',
            content: '',
          },
          workers: allWorkers, // 包含所有 workers
          timestamp: event.timestamp || Date.now(),
        }

        onMessageUpdate(message)
        break
      }

      case 'worker_thinking': {
        const taskId = data.taskId as string
        const text = data.text || ''

        if (!taskId) {
          return
        }

        const worker = this.workers.get(taskId)
        if (worker) {
          worker.thinking += text
          worker.status = 'running'

          const messageId = this.workerMessages.get(taskId)
          if (messageId) {
            // 将所有 workers 包含在消息中，确保多个 worker 都能显示
            const allWorkers = this.getAllWorkers()

            onMessageUpdate({
              id: messageId,
              type: 'ai',
              content: worker.content,
              rawText: worker.content,
              phase: 'worker',
              eventType: 'worker_thinking',
              workerData: {
                taskId,
                task: worker.task,
                status: worker.status,
                thinking: worker.thinking,
                content: worker.content,
              },
              workers: allWorkers, // 包含所有 workers
              toolCalls: worker.toolCalls,
              timestamp: event.timestamp || Date.now(),
            } as Message)
          }
        }
        break
      }

      case 'worker_content': {
        const taskId = data.taskId as string
        const text = data.text || ''

        if (!taskId) {
          return
        }

        const worker = this.workers.get(taskId)
        if (worker) {
          worker.content += text
          worker.status = 'running'

          const messageId = this.workerMessages.get(taskId)
          if (messageId) {
            // 将所有 workers 包含在消息中，确保多个 worker 都能显示
            const allWorkers = this.getAllWorkers()

            onMessageUpdate({
              id: messageId,
              type: 'ai',
              content: worker.content,
              rawText: worker.content,
              phase: 'worker',
              eventType: 'worker_content',
              workerData: {
                taskId,
                task: worker.task,
                status: worker.status,
                thinking: worker.thinking,
                content: worker.content,
              },
              workers: allWorkers, // 包含所有 workers
              toolCalls: worker.toolCalls,
              timestamp: event.timestamp || Date.now(),
            } as Message)
          }
        }
        break
      }

      case 'worker_status': {
        const taskId = data.taskId as string
        const status = data.status as 'running' | 'completed' | 'error'

        if (!taskId) {
          return
        }

        const worker = this.workers.get(taskId)
        if (worker) {
          worker.status = status

          const messageId = this.workerMessages.get(taskId)
          if (messageId) {
            // 将所有 workers 包含在消息中，确保多个 worker 都能显示
            const allWorkers = this.getAllWorkers()

            onMessageUpdate({
              id: messageId,
              type: 'ai',
              content: worker.content,
              rawText: worker.content,
              phase: 'worker',
              eventType: 'worker_status',
              workerData: {
                taskId,
                task: worker.task,
                status,
                thinking: worker.thinking,
                content: worker.content,
              },
              workers: allWorkers, // 包含所有 workers
              toolCalls: worker.toolCalls,
              timestamp: event.timestamp || Date.now(),
            } as Message)
          }
        }
        break
      }

      case 'worker_complete': {
        const taskId = data.taskId as string

        if (!taskId) {
          return
        }

        const worker = this.workers.get(taskId)
        if (worker) {
          worker.status = 'completed'

          const messageId = this.workerMessages.get(taskId)
          if (messageId) {
            // 将所有 workers 包含在消息中，确保多个 worker 都能显示
            const allWorkers = this.getAllWorkers()

            onMessageUpdate({
              id: messageId,
              type: 'ai',
              content: worker.content,
              rawText: worker.content,
              phase: 'worker',
              eventType: 'worker_complete',
              workerData: {
                taskId,
                task: worker.task,
                status: 'completed',
                thinking: worker.thinking,
                content: worker.content,
              },
              workers: allWorkers, // 包含所有 workers
              toolCalls: worker.toolCalls,
              timestamp: event.timestamp || Date.now(),
            } as Message)
          }
        }
        break
      }

      case 'tool_call': {
        const taskId = data.taskId as string | undefined
        const toolName = data.toolName as string
        const args = data.args

        // 如果有 taskId，直接使用
        // 如果没有 taskId，尝试找到最近活跃的 worker（可能是工具调用事件到达时 worker 还没有完全初始化）
        let targetTaskId = taskId
        if (!targetTaskId) {
          // 尝试找到最近创建的 worker（按时间戳排序，取最新的）
          const workers = Array.from(this.workers.entries())
          if (workers.length > 0) {
            // 如果有多个 worker，选择状态为 running 的，或者选择第一个
            const runningWorker = workers.find(([_, w]) => w.status === 'running')
            const firstWorker = workers[0]
            targetTaskId = runningWorker ? runningWorker[0] : (firstWorker ? firstWorker[0] : undefined)
            if (targetTaskId) {
              console.log(`[WorkerPhaseHandler] tool_call: 没有 taskId，使用最近活跃的 worker: taskId=${targetTaskId}`)
            }
          }
        }

        if (targetTaskId) {
          // Worker 中的工具调用
          let worker = this.workers.get(targetTaskId)

          // 如果 worker 不存在，自动创建一个（处理只有 tool_call 和 tool_result 的情况）
          if (!worker) {
            console.log(`[WorkerPhaseHandler] tool_call: 自动创建 worker for taskId=${targetTaskId}`)
            worker = {
              taskId: targetTaskId,
              task: `Task ${targetTaskId}`, // 默认任务名称，后续可以通过 worker_start 更新
              status: 'running',
              thinking: '',
              content: '',
              toolCalls: [],
            }
            this.workers.set(targetTaskId, worker)

            // 创建 worker 消息
            const messageId = this.generateMessageId()
            this.workerMessages.set(targetTaskId, messageId)

            // 立即创建消息，确保 worker 消息存在
            // 获取所有 workers（包括刚创建的）
            const allWorkers = this.getAllWorkers()

            onMessageUpdate({
              id: messageId,
              type: 'ai',
              content: '',
              phase: 'worker',
              eventType: 'tool_call',
              workerData: {
                taskId: targetTaskId,
                task: worker.task,
                status: worker.status,
                thinking: '',
                content: '',
              },
              workers: allWorkers, // 包含所有 workers
              toolCalls: [],
              timestamp: event.timestamp || Date.now(),
            } as Message)
          }

          if (worker) {
            if (!worker.toolCalls) {
              worker.toolCalls = []
            }

            const toolCall: ToolCall = {
              toolName,
              args: args || {},
              taskId: targetTaskId,
            }

            worker.toolCalls.push(toolCall)

            const messageId = this.workerMessages.get(targetTaskId)
            if (messageId) {
              // 将所有 workers 包含在消息中，确保多个 worker 都能显示
              const allWorkers = this.getAllWorkers()

              onMessageUpdate({
                id: messageId,
                type: 'ai',
                content: worker.content,
                rawText: worker.content,
                phase: 'worker',
                eventType: 'tool_call',
                workerData: {
                  taskId: targetTaskId,
                  task: worker.task,
                  status: worker.status,
                  thinking: worker.thinking,
                  content: worker.content,
                },
                workers: allWorkers, // 包含所有 workers
                toolCalls: [...worker.toolCalls],
                timestamp: event.timestamp || Date.now(),
              } as Message)
            }
            else {
              console.warn(`[WorkerPhaseHandler] tool_call: No messageId found for taskId=${targetTaskId}`)
            }
          }
        }
        else {
          console.warn('[WorkerPhaseHandler] tool_call: No taskId provided and no active workers found')
        }
        break
      }

      case 'tool_result': {
        const taskId = data.taskId as string | undefined
        const toolName = data.toolName as string
        const result = data.result
        const executionTime = data.executionTime as number | undefined


        // 如果有 taskId，直接使用
        // 如果没有 taskId，尝试在所有 worker 中查找对应的 tool_call
        let targetTaskId = taskId
        if (!targetTaskId) {
          // 遍历所有 worker，查找是否有对应的未完成的 tool_call
          for (const [tid, worker] of this.workers.entries()) {
            if (worker.toolCalls && worker.toolCalls.some(tc => tc.toolName === toolName && !tc.result)) {
              targetTaskId = tid
              console.log(`[WorkerPhaseHandler] tool_result: 通过 toolName 找到对应的 worker: taskId=${targetTaskId}`)
              break
            }
          }

          // 如果还是没找到，使用最近活跃的 worker
          if (!targetTaskId) {
            const workers = Array.from(this.workers.entries())
            if (workers.length > 0) {
              const runningWorker = workers.find(([_, w]) => w.status === 'running')
              const firstWorker = workers[0]
              targetTaskId = runningWorker ? runningWorker[0] : (firstWorker ? firstWorker[0] : undefined)
              if (targetTaskId) {
                console.log(`[WorkerPhaseHandler] tool_result: 没有 taskId，使用最近活跃的 worker: taskId=${targetTaskId}`)
              }
            }
          }
        }

        if (targetTaskId) {
          // Worker 中的工具结果
          let worker = this.workers.get(targetTaskId)

          // 如果 worker 不存在，自动创建一个（处理只有 tool_result 的情况）
          if (!worker) {
            console.log(`[WorkerPhaseHandler] tool_result: 自动创建 worker for taskId=${targetTaskId}`)
            worker = {
              taskId: targetTaskId,
              task: `Task ${targetTaskId}`, // 默认任务名称
              status: 'running',
              thinking: '',
              content: '',
              toolCalls: [],
            }
            this.workers.set(targetTaskId, worker)

            // 创建 worker 消息
            const messageId = this.generateMessageId()
            this.workerMessages.set(targetTaskId, messageId)

            // 立即创建消息，确保 worker 消息存在
            // 获取所有 workers（包括刚创建的）
            const allWorkers = this.getAllWorkers()

            onMessageUpdate({
              id: messageId,
              type: 'ai',
              content: '',
              phase: 'worker',
              eventType: 'tool_result',
              workerData: {
                taskId: targetTaskId,
                task: worker.task,
                status: worker.status,
                thinking: '',
                content: '',
              },
              workers: allWorkers, // 包含所有 workers
              toolCalls: [],
              timestamp: event.timestamp || Date.now(),
            } as Message)
          }

          if (worker) {
            if (!worker.toolCalls) {
              worker.toolCalls = []
            }

            // 查找对应的 tool_call
            let toolCall = worker.toolCalls.find(tc => tc.toolName === toolName && !tc.result)

            // 如果没有找到对应的 tool_call，创建一个新的（处理 tool_result 先到达的情况）
            if (!toolCall && toolName) {
              console.log(`[WorkerPhaseHandler] tool_result: 创建新的 tool_call for toolName=${toolName}`)
              toolCall = {
                toolName,
                args: {},
                taskId: targetTaskId,
              }
              worker.toolCalls.push(toolCall)
            }

            if (toolCall) {
              toolCall.result = result
              toolCall.executionTime = executionTime

              const messageId = this.workerMessages.get(targetTaskId)
              if (messageId) {
                // 将所有 workers 包含在消息中，确保多个 worker 都能显示
                const allWorkers = this.getAllWorkers()

                onMessageUpdate({
                  id: messageId,
                  type: 'ai',
                  content: worker.content,
                  rawText: worker.content,
                  phase: 'worker',
                  eventType: 'tool_result',
                  workerData: {
                    taskId: targetTaskId,
                    task: worker.task,
                    status: worker.status,
                    thinking: worker.thinking,
                    content: worker.content,
                  },
                  workers: allWorkers, // 包含所有 workers
                  toolCalls: [...worker.toolCalls],
                  timestamp: event.timestamp || Date.now(),
                } as Message)
              }
              else {
                console.warn(`[WorkerPhaseHandler] tool_result: No messageId found for taskId=${targetTaskId}`)
              }
            }
            else {
              console.warn(`[WorkerPhaseHandler] tool_result: No toolName provided, cannot create tool_call`)
            }
          }
        }
        else {
          console.warn('[WorkerPhaseHandler] tool_result: No taskId provided and no active workers found')
        }
        break
      }
    }
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `worker_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 获取所有 worker 状态
   */
  getWorkers(): WorkerState[] {
    return Array.from(this.workers.values())
  }

  /**
   * 获取特定 worker 的状态
   */
  getWorker(taskId: string): WorkerState | null {
    return this.workers.get(taskId) || null
  }

  /**
   * 获取 worker 消息 ID
   */
  getWorkerMessageId(taskId: string): string | null {
    return this.workerMessages.get(taskId) || null
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.workers.clear()
    this.workerMessages.clear()
  }
}
