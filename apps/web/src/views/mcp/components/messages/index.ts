import DefaultMessage from './message-types/default-message.vue'
import ErrorMessage from './message-types/error-message.vue'
import PlanningMessage from './message-types/planning-message.vue'
import SimpleMessage from './message-types/simple-message.vue'
import SynthesisMessage from './message-types/synthesis-message.vue'
import UserMessage from './message-types/user-message.vue'
import WorkerMessage from './message-types/worker-message.vue'
import TokenUsage from './message-units/token-usage.vue'
import type { Message } from '../../types.js'

/**
 * 根据消息类型返回对应的组件名
 */
export function getMessageComponent(message: Message): string {
  // 用户消息
  if (message.type === 'user') {
    return 'UserMessage'
  }

  // 错误消息
  if (message.eventType === 'error') {
    return 'ErrorMessage'
  }

  // Planning 阶段
  if (message.phase === 'planning' && message.planningData) {
    return 'PlanningMessage'
  }

  // Worker 阶段
  if (message.phase === 'worker' && message.workerData) {
    return 'WorkerMessage'
  }

  // Synthesis 阶段
  if (message.phase === 'synthesis' && message.synthesisData) {
    return 'SynthesisMessage'
  }

  // Simple 模式
  if (message.phase === 'simple') {
    return 'SimpleMessage'
  }

  // 默认消息（兜底）
  return 'DefaultMessage'
}

/**
 * 导出所有消息类型组件
 */
export {
  DefaultMessage,
  ErrorMessage,
  PlanningMessage,
  SimpleMessage,
  SynthesisMessage,
  TokenUsage,
  UserMessage,
  WorkerMessage,
}
