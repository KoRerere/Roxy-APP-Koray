import type { StreamEvent, TokenUsage } from '../types.js'
import { getGraph } from '../../agent'
// import { EventLogger } from '../eventLogger'
import { ChatLogger } from '../chatLogger'
import { PlanningPhaseHandler } from './phases/PlanningPhaseHandler.js'
import { SynthesisPhaseHandler } from './phases/SynthesisPhaseHandler.js'
import { WorkerPhaseHandler } from './phases/WorkerPhaseHandler.js'

/**
 * Orchestrator 事件转换器
 * 负责将 LangGraph 的原始事件转换为新的 SSE 事件类型
 */
export class OrchestratorEventConverter {
  private planningHandler: PlanningPhaseHandler
  private workerHandler: WorkerPhaseHandler
  private synthesisHandler: SynthesisPhaseHandler
  private workerIds: Set<string> = new Set()
  /**
   * 维护 runId 到 taskId 的映射，用于工具调用事件关联
   */
  private runIdToTaskId = new Map<string, string>()
  /**
   * 工具调用事件调试计数器
   */

  constructor() {
    this.planningHandler = new PlanningPhaseHandler()
    this.workerHandler = new WorkerPhaseHandler()
    this.synthesisHandler = new SynthesisPhaseHandler()
  }

  /**
   * 转换整个流
   */
  async convertStream(
    input: any,
    config: any,
    onStream: (event: StreamEvent) => void,
  ): Promise<void> {
    // 重置所有处理器状态
    this.planningHandler.reset()
    this.workerHandler.reset()
    this.synthesisHandler.reset()
    this.workerIds.clear()
    this.runIdToTaskId.clear()

    // 用于收集最终的 synthesis 响应
    let finalResponse = ''
    let finalThinking = ''

    const chatLogger = new ChatLogger(config.configurable.thread_id)

    // 发送初始状态：plan_status: 'analyzing'
    // onStream({
    //   type: 'plan_status',
    //   data: { status: 'analyzing' },
    //   timestamp: Date.now(),
    // })

    const graph = await getGraph()

    try {
      const stream = await graph.stream(input, config)
      console.log('stream::>>>', stream)
      // @ts-ignore
      for await (const [mode, event] of stream) {
        if (mode === 'custom') {
          onStream(event)
          chatLogger.addEvent(event)
        }

        // continue;
        // if (eventType === 'on_custom_stream') {
        //   originalEventLogger.addEvent(event)
        // }
        // const tags = event.tags || []

        // // 使用 PlanningPhaseHandler 处理 Planning 阶段事件
        // const planningEvents = this.planningHandler.handleEvent(event, input.enableThinking)
        // for (const planningEvent of planningEvents) {
        //   onStream(planningEvent)

        //   // 如果 plan 已生成，将任务信息传递给 WorkerPhaseHandler
        //   if (planningEvent.type === 'plan' && planningEvent.data?.task) {
        //     const task = planningEvent.data.task
        //     this.workerHandler.setPlanTasks([{
        //       taskId: task.taskId,
        //       task: task.task,
        //     }])
        //   }
        // }

        // // --- Worker Phase: 复用 CLI 的逻辑，直接从 LangGraph 事件中提取并发送到 EventBridge ---
        // // 方法1: 从 tags 中提取 worker_ tag
        // let taskId: string | null = null
        // const workerIdTag = tags.find((t: string) => t.startsWith('worker_'))
        // if (workerIdTag) {
        //   taskId = workerIdTag.replace('worker_', '')
        // }
        // // 方法2: 如果没有 tag，尝试从 event.data.input 中提取（worker 节点的事件）
        // else if (event.name === 'worker' || event.name === 'generalWorker') {
        //   const input = event.data?.input
        //   if (input?.task) {
        //     taskId = String(input.task.id || input.task.taskId || '')
        //   }
        //   else if (input?.workerId) {
        //     taskId = input.workerId.replace('worker_', '')
        //   }
        // }

        // // 维护 runId 到 taskId 的映射（用于工具调用事件关联）
        // const runId = (event as any).run_id
        // const parentRunId = (event as any).parent_run_id

        // // 记录 runId 映射（所有有 taskId 的事件都记录）
        // if (runId && taskId) {
        //   this.runIdToTaskId.set(runId, taskId)
        // }

        // // 也记录 parent_run_id 到 taskId 的映射（工具调用可能使用 parent_run_id）
        // if (parentRunId && taskId) {
        //   this.runIdToTaskId.set(parentRunId, taskId)
        // }

        // // 对于 worker 节点本身的事件，特别记录（工具调用的 parent_run_id 可能是 worker 节点的 runId）
        // if (taskId && (event.name === 'worker' || event.name === 'generalWorker')) {
        //   if (runId && !this.runIdToTaskId.has(runId)) {
        //     this.runIdToTaskId.set(runId, taskId)
        //   }
        // }

        // // 对于 worker 相关的所有事件，都尝试记录 runId 映射
        // // 特别是 on_chat_model_start，这是 worker 真正开始执行的地方
        // if (taskId && (eventType === 'on_chat_model_start' || eventType === 'on_chain_start')) {
        //   if (runId && !this.runIdToTaskId.has(runId)) {
        //     this.runIdToTaskId.set(runId, taskId)
        //   }
        // }

        // const rawEvent: any = event

        // if (eventType === 'on_tool_start' || eventType === 'on_tool_end') {
        //   // 对于工具调用事件，尝试从多个来源获取 taskId
        //   let toolTaskId: string | null = taskId
        //   const toolRunId = rawEvent.run_id || runId
        //   // 尝试多个可能的 parent_run_id 位置
        //   const toolParentRunId = rawEvent.parent_run_id
        //     || rawEvent.data?.parent_run_id
        //     || (rawEvent.data as any)?.parent_run_id
        //     || (event as any).parent_run_id

        //   // 如果当前事件没有 taskId，尝试通过 parent_run_id 查找
        //   if (!toolTaskId && toolParentRunId) {
        //     toolTaskId = this.runIdToTaskId.get(toolParentRunId) || null
        //   }

        //   // 如果还是没有，尝试从 run_id 查找（工具调用可能直接使用 worker 的 run_id）
        //   if (!toolTaskId && toolRunId) {
        //     toolTaskId = this.runIdToTaskId.get(toolRunId) || null
        //   }

        //   // 如果还是没有找到，尝试从 tags 中查找（工具调用可能继承 worker 的 tags）
        //   if (!toolTaskId) {
        //     const toolWorkerTag = tags.find((t: string) => t.startsWith('worker_'))
        //     if (toolWorkerTag) {
        //       toolTaskId = toolWorkerTag.replace('worker_', '')
        //     }
        //   }

        //   // 如果还是没有找到，尝试通过最近活跃的 worker 来关联
        //   // 工具调用通常发生在 worker 执行过程中，可以通过时间顺序来推断
        //   if (!toolTaskId && this.workerIds.size > 0) {
        //     // 使用最近活跃的 worker（通常工具调用发生在当前活跃的 worker 中）
        //     const activeWorkers = Array.from(this.workerIds)
        //     // 如果有多个 worker，优先选择状态为 running 的
        //     // 这里我们使用最后一个 worker（通常是最近创建的）
        //     toolTaskId = activeWorkers[activeWorkers.length - 1]
        //   }

        //   const toolName
        //     = rawEvent.name
        //       || rawEvent.data?.name
        //       || rawEvent.data?.tool_name
        //       || 'unknown_tool'

        //   if (eventType === 'on_tool_start') {
        //     const args
        //       = rawEvent.data?.input
        //         ?? rawEvent.data?.tool_input
        //         ?? rawEvent.data?.args
        //         ?? {}

        //     onStream({
        //       type: 'tool_call',
        //       data: {
        //         toolName,
        //         args,
        //         taskId: toolTaskId || undefined,
        //         status: 'calling', // 工具调用开始
        //       },
        //       timestamp: Date.now(),
        //     })
        //   }

        //   if (eventType === 'on_tool_end') {
        //     const result
        //       = rawEvent.data?.output
        //         ?? rawEvent.data?.result
        //         ?? rawEvent.data

        //     const executionTime
        //       = typeof rawEvent.data?.execution_time === 'number'
        //         ? rawEvent.data.execution_time
        //         : undefined

        //     // 检查是否是错误结果
        //     const isError = result && typeof result === 'string' && result.startsWith('Error executing tool:')
        //     const status = isError ? 'error' : 'success'

        //     onStream({
        //       type: 'tool_result',
        //       data: {
        //         toolName,
        //         result,
        //         executionTime,
        //         taskId: toolTaskId || undefined,
        //         status, // 成功或失败状态
        //       },
        //       timestamp: Date.now(),
        //     })
        //   }
        // }

        // // 使用 WorkerPhaseHandler 处理 Worker 阶段事件（生成 worker_start 等）
        // const workerEvents = this.workerHandler.handleEvent(event, undefined, input.enableThinking)
        // for (const workerEvent of workerEvents) {
        //   onStream(workerEvent)
        // }

        // // 处理 worker 的流式内容（thinking 和 content）
        // // 直接发送 SSE 事件，不需要通过 EventBridge 订阅机制
        // if (taskId) {
        //   this.workerIds.add(taskId)

        //   if (eventType === 'on_chat_model_stream') {
        //     const chunk = event.data?.chunk
        //     if (chunk) {
        //       // 提取 content
        //       const content = this.extractContent(chunk)
        //       if (content) {
        //         onStream({
        //           type: 'worker_content',
        //           data: {
        //             taskId,
        //             text: content,
        //           },
        //           timestamp: Date.now(),
        //         })
        //       }
        //     }
        //   }

        //   // 处理 worker 完成
        //   if (eventType === 'on_chain_end' && (event.name === 'worker' || event.name === 'generalWorker')) {
        //     const results = event.data?.output?.worker_results
        //     if (results && Array.isArray(results) && results.some((r: any) => r.taskId === taskId)) {
        //       onStream({
        //         type: 'worker_complete',
        //         data: {
        //           taskId,
        //         },
        //         timestamp: Date.now(),
        //       })
        //     }
        //   }
        // }

        // // 使用 SynthesisPhaseHandler 处理 Synthesis 阶段事件
        // const synthesisEvents = this.synthesisHandler.handleEvent(event, input.enableThinking)
        // for (const synthesisEvent of synthesisEvents) {
        //   onStream(synthesisEvent)

        //   // 收集 synthesis 内容用于保存
        //   if (synthesisEvent.type === 'synthesis_thinking' && synthesisEvent.data?.text) {
        //     finalThinking += synthesisEvent.data.text
        //   }
        //   if (synthesisEvent.type === 'synthesis_content' && synthesisEvent.data?.text) {
        //     finalResponse += synthesisEvent.data.text
        //   }
        // }

        // // 从最终输出中提取响应和 token 使用信息（如果 synthesis 阶段已完成）
        // if (event.event === 'on_chain_end' && event.name === 'orchestrator') {
        //   const finalAnswer = event.data?.output?.final_answer
        //   // finalAnswer 可能是字符串或对象，需要处理
        //   if (finalAnswer) {
        //     let answerText = ''
        //     if (typeof finalAnswer === 'string') {
        //       answerText = finalAnswer
        //     }
        //     else if (typeof finalAnswer === 'object' && finalAnswer !== null) {
        //       // 如果是对象，尝试提取文本内容
        //       answerText = JSON.stringify(finalAnswer)
        //     }

        //     // 优先使用 finalAnswer（如果存在），因为它是最完整的响应
        //     if (answerText) {
        //       finalResponse = answerText
        //     }
        //   }
        // }
      }
    }
    catch (error: any) {
      console.error('Error in OrchestratorEventConverter:', error)
      onStream({
        type: 'error',
        data: {
          message: error.message || 'Orchestrator stream failed',
          details: error.stack,
        },
        timestamp: Date.now(),
      })
      throw error
    }
    finally {
      chatLogger.saveToFile()
      // 清理 Worker 订阅
      this.workerHandler.cleanup()
    }
  }

  /**
   * 提取内容文本（复用 CLI 的逻辑）
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
}
