import type { Message } from '../../../types.js'

/**
 * 消息内容组件配置
 */
export interface MessageContentComponentConfig {
  /** 组件名称 */
  component: string
  /** 是否显示 */
  show: boolean
  /** 传递给组件的 props */
  props?: Record<string, any>
  /** 事件处理器（使用 Vue 事件命名，如 'view-detail'） */
  handlers?: Record<string, (...args: any[]) => void>
}

/**
 * 获取消息需要渲染的内容组件列表
 * 同一条消息可能包含多种内容类型，需要按顺序渲染
 */
export function getMessageContentComponents(
  message: Message,
  options?: {
    serverUrl?: string
    handlers?: {
      onViewWorkerDetail?: (taskId: string) => void
      onStopWorkerTask?: (taskId: string) => void
    }
  },
): MessageContentComponentConfig[] {
  // 调试日志
  console.log('[getMessageContentComponents] message:', message)
  console.log('[getMessageContentComponents] message.phase:', message.phase)
  console.log('[getMessageContentComponents] message.planningData:', message.planningData)
  console.log('[getMessageContentComponents] message.workerData:', message.workerData)
  console.log('[getMessageContentComponents] message.workers:', message.workers)
  console.log('[getMessageContentComponents] message.synthesisData:', message.synthesisData)

  // 收集所有需要显示的组件，并记录它们的顺序
  // 按照 MessageItem.vue 旧代码的逻辑：根据 phase 判断，有什么输出什么
  const componentEntries: Array<{ order: number, component: MessageContentComponentConfig }> = []

  // 1. 错误消息（优先级最高，不依赖 phase）
  if (message.eventType === 'error') {
    componentEntries.push({
      order: 0,
      component: {
        component: 'ErrorMessage',
        show: true,
        props: { message },
      },
    })
  }

  // 2. Planning 阶段：根据 phase === 'planning' 且 planningData 存在
  if (message.phase === 'planning' && message.planningData) {
    componentEntries.push({
      order: 1,
      component: {
        component: 'PlanningMessage',
        show: true,
        props: { message },
      },
    })
  }

  // 3. Worker 阶段：根据 phase === 'worker' 且 workerData 存在
  // 支持多个 worker，每个都显示
  if (message.phase === 'worker') {
    const workers = message.workers || (message.workerData ? [message.workerData] : [])
    if (workers.length > 0) {
      console.log('[getMessageContentComponents] 添加 WorkerMessage 组件，workers 数量:', workers.length)
      for (const worker of workers) {
        componentEntries.push({
          order: 2,
          component: {
            component: 'WorkerMessage',
            show: true,
            props: {
              message: {
                ...message,
                workerData: worker, // 为每个 worker 创建一个单独的消息对象
              },
              serverUrl: options?.serverUrl,
            },
          },
        })
      }
    }
  }

  // 4. Simple 模式：根据 phase === 'simple'
  // 只要有 content、rawText 或 toolCalls 就显示
  if (message.phase === 'simple') {
    const hasSimpleContent = (
      (message.content && message.content.trim().length > 0)
      || (message.rawText && message.rawText.trim().length > 0)
      || (message.toolCalls && message.toolCalls.length > 0)
    )

    if (hasSimpleContent) {
      const simpleMessage: Message = {
        ...message,
        content: message.content || message.rawText || '',
        rawText: message.rawText || message.content || '',
        // 移除其他阶段的数据，让 SimpleMessage 只显示 simple 阶段的内容
        planningData: undefined,
        workerData: undefined,
        workers: undefined,
        synthesisData: undefined,
      }

      componentEntries.push({
        order: 3,
        component: {
          component: 'SimpleMessage',
          show: true,
          props: { message: simpleMessage },
        },
      })
    }
  }

  // 5. Synthesis 阶段：根据 phase === 'synthesis' 且 synthesisData 存在
  if (message.phase === 'synthesis' && message.synthesisData) {
    componentEntries.push({
      order: 4,
      component: {
        component: 'SynthesisMessage',
        show: true,
        props: { message },
      },
    })
  }

  // 6. 默认消息（兜底）：只有在没有任何其他内容时才显示
  // 条件：不是错误、没有 phase、没有各阶段数据、但有内容
  if (
    componentEntries.length === 0
    && message.eventType !== 'error'
    && !message.phase
    && !message.planningData
    && !message.workerData
    && !message.workers
    && !message.synthesisData
    && (message.content || message.rawText)
  ) {
    componentEntries.push({
      order: 5,
      component: {
        component: 'DefaultMessage',
        show: true,
        props: { message },
      },
    })
  }

  // 按顺序排序并提取组件
  const sortedComponents = componentEntries
    .sort((a, b) => a.order - b.order)
    .map(entry => entry.component)
    .filter(c => c.show)

  console.log('[getMessageContentComponents] 返回的组件列表:', sortedComponents.map(c => c.component))
  return sortedComponents
}
