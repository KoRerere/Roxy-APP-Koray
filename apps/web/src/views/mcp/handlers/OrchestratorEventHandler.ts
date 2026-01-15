import type { Message, StreamEvent } from '../types.js'
import { PlanningPhaseHandler } from './phases/PlanningPhaseHandler.js'
import { SynthesisPhaseHandler } from './phases/SynthesisPhaseHandler.js'
import { WorkerPhaseHandler } from './phases/WorkerPhaseHandler.js'

/**
 * Orchestrator 事件处理器
 * 处理 Orchestrator 模式的所有事件
 */
export class OrchestratorEventHandler {
  private planningHandler: PlanningPhaseHandler
  private workerHandler: WorkerPhaseHandler
  private synthesisHandler: SynthesisPhaseHandler

  constructor() {
    this.planningHandler = new PlanningPhaseHandler()
    this.workerHandler = new WorkerPhaseHandler()
    this.synthesisHandler = new SynthesisPhaseHandler()
  }

  /**
   * 处理事件
   */
  handleEvent(event: StreamEvent, onMessageUpdate: (message: Message) => void): void {
    const { type, data } = event

    // Planning 阶段事件
    if (
      type === 'plan_status'
      || type === 'planning_thinking'
      || type === 'planning_content'
      || type === 'plan'
    ) {
      this.planningHandler.handleEvent(event, onMessageUpdate)
      return
    }

    // Worker 阶段事件
    if (
      type === 'worker_start'
      || type === 'worker_thinking'
      || type === 'worker_content'
      || type === 'worker_status'
      || type === 'worker_complete'
      || type === 'tool_call'
      || type === 'tool_result'
    ) {
      // 工具调用事件：如果有 taskId，则属于 worker 阶段；否则可能属于其他阶段
      if (type === 'tool_call' || type === 'tool_result') {
        const taskId = data?.taskId as string | undefined
        if (taskId) {
          // Worker 中的工具调用，由 WorkerPhaseHandler 处理
          this.workerHandler.handleEvent(event, onMessageUpdate)
        }
        else {
          // 没有 taskId 的工具调用，可能是 planning 或 synthesis 阶段的
          // 暂时也由 WorkerPhaseHandler 处理（因为它已经有处理逻辑）
          // 或者可以创建独立的工具调用处理器
          this.workerHandler.handleEvent(event, onMessageUpdate)
        }
      }
      else {
        // 处理 worker 事件
        this.workerHandler.handleEvent(event, onMessageUpdate)
      }

      // 同步更新 planning 消息中的任务状态
      const taskId = data?.taskId as string | undefined
      if (taskId) {
        if (type === 'worker_start' || type === 'worker_thinking' || type === 'worker_content' || type === 'worker_status') {
          // Worker 开始执行，更新任务状态为 running
          this.planningHandler.updateTaskStatus(taskId, 'running', onMessageUpdate)
        }
        else if (type === 'worker_complete') {
          // Worker 完成，更新任务状态为 completed
          this.planningHandler.updateTaskStatus(taskId, 'completed', onMessageUpdate)
        }
      }

      return
    }

    // Synthesis 阶段事件
    if (
      type === 'synthesis_status'
      || type === 'synthesis_thinking'
      || type === 'synthesis_content'
    ) {
      this.synthesisHandler.handleEvent(event, onMessageUpdate)
    }
  }

  /**
   * 获取当前阶段
   */
  getCurrentPhase(): 'planning' | 'worker' | 'synthesis' | null {
    // 根据各处理器的状态判断当前阶段
    if (this.synthesisHandler.getStatus() !== 'started' || this.synthesisHandler.getMessageId()) {
      return 'synthesis'
    }

    if (this.workerHandler.getWorkers().length > 0) {
      return 'worker'
    }

    if (this.planningHandler.getStatus() !== 'analyzing' || this.planningHandler.getMessageId()) {
      return 'planning'
    }

    return null
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.planningHandler.reset()
    this.workerHandler.reset()
    this.synthesisHandler.reset()
  }
}
