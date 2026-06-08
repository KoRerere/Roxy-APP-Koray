import { safeParseJSON } from '/@/utils'
import type { ContentBlock, MessageBlock, SSEEventData, SSEParseResult, ThinkingBlock, ToolCallBlock, WorkerStatus, WorkerTask } from '../types'

const HIDDEN_TOOL_NAMES = new Set(['search_artifacts', 'save_image_spec'])

export function isHiddenToolEvent(data: unknown): boolean {
  if (!data || typeof data !== 'object')
    return false

  const toolName = (data as { toolName?: unknown }).toolName
  return typeof toolName === 'string' && HIDDEN_TOOL_NAMES.has(toolName)
}

export interface SSEParsedEvent<T = unknown> {
  /** SSE: event: xxx （缺省则 message） */
  event: string
  /** SSE: id: xxx */
  id?: string
  /** 拼接后的 data: 多行 data 会用 \n 连接后再去掉末尾换行 */
  data: string
  /** data 尝试 JSON.parse 的结果（失败为 null） */
  json: T | null
  /** 事件原始块内容（便于调试，可选） */
  rawBlock?: string
}

/**
 * 解析单个 SSE 事件块
 */
export function parseSSEBlock<T>(rawBlock: string): { event: string, id?: string, data: string, json: T | null } {
  let curEvent = 'message'
  let curId: string | undefined
  let curData = ''

  const lines = rawBlock.split(/\r?\n/)
  for (const line of lines) {
    if (!line || line.startsWith(':'))
      continue

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let valueStr = colon === -1 ? '' : line.slice(colon + 1)
    if (valueStr.startsWith(' '))
      valueStr = valueStr.slice(1)

    switch (field) {
      case 'event':
        curEvent = valueStr || 'message'
        break
      case 'id':
        curId = valueStr || undefined
        break
      case 'data':
        curData += `${valueStr}\n`
        break
    }
  }

  const data = curData.endsWith('\n') ? curData.slice(0, -1) : curData
  const json = data.length === 0 ? null : safeParseJSON(data, null)

  return { event: curEvent, id: curId, data, json }
}

/**
 * 解析完整的 SSE 字符串，返回所有事件数组
 */
export function parseSSEContentString<T = unknown>(sseContent: string): SSEParsedEvent<T>[] {
  const events: SSEParsedEvent<T>[] = []
  const blocks = sseContent.split(/\r?\n\r?\n/)

  for (const rawBlock of blocks) {
    if (!rawBlock.trim())
      continue

    const { event, id, data, json } = parseSSEBlock<T>(rawBlock)
    events.push({ event, id, data, json, rawBlock })
  }

  return events
}

/**
 * SSE 事件处理器的上下文
 */
export interface SSEProcessContext {
  /** 有序的消息块数组 */
  messageBlocks: MessageBlock[]
  /** 消息块索引 Map，用于快速查找 */
  blockIndexMap: Map<string, number>
  /** Worker 任务 Map */
  workerTaskMap: Map<string, WorkerTask>
  /** Planning 文本累加器 */
  planningAccumulator: { value: string }
  /** Synthesis 文本累加器 (synthesis 只有一段) */
  textAccumulator: { value: string }
  /** 当前正在进行的 thinkingId */
  currentThinkingId: { value: string | null }
  /** Worker 事件顺序计数器 Map (每个 task 独立计数) */
  workerOrderMap: Map<string, number>
  /** 规划状态 */
  planningState: {
    isPlanning: boolean
    startTimestamp?: number
    endTimestamp?: number
  }
}

/**
 * 创建 SSE 处理上下文
 */
export function createSSEProcessContext(): SSEProcessContext {
  return {
    messageBlocks: [],
    blockIndexMap: new Map<string, number>(),
    workerTaskMap: new Map<string, WorkerTask>(),
    planningAccumulator: { value: '' },
    textAccumulator: { value: '' },
    currentThinkingId: { value: null },
    workerOrderMap: new Map<string, number>(),
    planningState: { isPlanning: false },
  }
}

/**
 * 获取并递增指定 task 的事件顺序号
 */
function getNextWorkerOrder(context: SSEProcessContext, taskId: string): number {
  const current = context.workerOrderMap.get(taskId) ?? 0
  context.workerOrderMap.set(taskId, current + 1)
  return current
}

/**
 * 获取或创建消息块的辅助函数
 */
function getOrCreateBlock<T extends MessageBlock>(
  context: SSEProcessContext,
  blockKey: string,
  createBlock: () => T,
): T {
  const { messageBlocks, blockIndexMap } = context
  const existingIndex = blockIndexMap.get(blockKey)

  if (existingIndex !== undefined) {
    return messageBlocks[existingIndex] as T
  }

  const block = createBlock()
  const index = messageBlocks.length
  messageBlocks.push(block)
  blockIndexMap.set(blockKey, index)
  return block
}

/**
 * 获取或创建 WorkerTask
 */
function getOrCreateWorkerTask(workerTaskMap: Map<string, WorkerTask>, taskId: string): WorkerTask {
  let task = workerTaskMap.get(taskId)
  if (!task) {
    task = { taskId, thinkings: [], toolCalls: [], contents: [], status: 'pending' }
    workerTaskMap.set(taskId, task)
  }
  return task
}

export function normalizeWorkerStatus(status: unknown): WorkerStatus {
  if (status === 'pending' || status === 'success')
    return status
  return 'failed'
}

/**
 * 结束指定任务的所有进行中的 thinking
 */
function finalizeTaskThinkings(task: WorkerTask, timestamp?: number): void {
  for (const t of task.thinkings) {
    if (t.isThinking) {
      t.isThinking = false
      if (timestamp && !t.endTimestamp) {
        t.endTimestamp = timestamp
      }
    }
  }
}

/**
 * 结束当前正在进行的 thinking（如果有的话）
 */
function finalizeCurrentThinking(context: SSEProcessContext, endTimestamp?: number, excludeId?: string): void {
  const { messageBlocks, currentThinkingId } = context
  if (!currentThinkingId.value || currentThinkingId.value === excludeId)
    return

  // 找到当前 thinking block 并标记为完成
  for (const block of messageBlocks) {
    if (block.type === 'thinking' && block.thinkingId === currentThinkingId.value) {
      block.isThinking = false
      // 如果提供了结束时间戳，记录它
      if (endTimestamp && !block.endTimestamp) {
        block.endTimestamp = endTimestamp
      }
      break
    }
  }
  currentThinkingId.value = null
}

/**
 * 处理单个 SSE 事件，更新消息块、Worker 任务和文本
 * 统一的事件处理逻辑，供实时流和历史解析共用
 */
export function processSSEEvent(
  eventData: SSEEventData,
  context: SSEProcessContext,
): void {
  if (!eventData)
    return

  const { type, data, timestamp } = eventData
  const { workerTaskMap, planningAccumulator, currentThinkingId, planningState } = context

  // 非 thinking 事件时，结束当前 thinking
  if (type !== 'thinking') {
    finalizeCurrentThinking(context, timestamp)
  }

  // 非 planning 事件时，结束规划状态
  if (type !== 'planning' && planningState.isPlanning) {
    planningState.isPlanning = false
    planningState.endTimestamp = timestamp
  }

  switch (type) {
    case 'planning': {
      if (!data)
        break
      if (data.text !== undefined) {
        planningAccumulator.value += data.text
      }
      break
    }
    case 'thinking': {
      if (!data)
        break
      const { thinkingId, text, taskId } = data
      if (!thinkingId)
        break

      // 如果是新的 thinkingId，结束之前的 thinking
      if (currentThinkingId.value && currentThinkingId.value !== thinkingId) {
        finalizeCurrentThinking(context, timestamp, thinkingId)
      }

      const blockKey = `thinking:${thinkingId}`
      const thinkingBlock = getOrCreateBlock<ThinkingBlock>(context, blockKey, () => ({
        type: 'thinking',
        thinkingId,
        text: '',
        isThinking: true,
        startTimestamp: timestamp,
        taskId,
      }))

      if (text !== undefined) {
        thinkingBlock.text += text
      }

      // 更新最后的时间戳作为潜在的结束时间
      if (timestamp) {
        thinkingBlock.endTimestamp = timestamp
      }

      // 更新当前 thinkingId
      currentThinkingId.value = thinkingId
      break
    }
    case 'tool_call': {
      if (!data)
        break
      const { toolId, toolName, args, taskId } = data
      if (!toolId || !toolName)
        break

      const blockKey = `tool_call:${toolId}`
      const toolCallBlock = getOrCreateBlock<ToolCallBlock>(context, blockKey, () => ({
        type: 'tool_call',
        toolId,
        toolName,
        args: args || {},
        status: 'pending',
        taskId,
      }))

      // 如果有 taskId，关联到对应的 Worker 任务
      if (taskId) {
        const task = getOrCreateWorkerTask(workerTaskMap, taskId)
        // 结束该 task 的 thinking
        finalizeTaskThinkings(task, timestamp)
        // 避免重复添加
        if (!task.toolCalls.some(t => t.toolId === toolId)) {
          task.toolCalls.push({
            toolId: toolCallBlock.toolId,
            toolName: toolCallBlock.toolName,
            args: toolCallBlock.args,
            status: toolCallBlock.status,
            taskId: toolCallBlock.taskId,
            order: getNextWorkerOrder(context, taskId),
          })
        }
      }
      break
    }
    case 'tool_result': {
      if (!data)
        break
      const { toolId, toolName = '', result, et, status, taskId } = data
      if (!toolId)
        break

      const blockKey = `tool_call:${toolId}`
      const toolCallBlock = getOrCreateBlock<ToolCallBlock>(context, blockKey, () => ({
        type: 'tool_call',
        toolId,
        toolName,
        args: {},
        status: 'pending',
        taskId,
      }))

      // 更新状态
      const newStatus = (status ?? 'success') as ToolCallBlock['status']
      toolCallBlock.status = newStatus
      toolCallBlock.result = result
      toolCallBlock.elapsedTime = et

      // 同步更新 Worker 任务中的 toolCall
      const targetTaskId = taskId || toolCallBlock.taskId
      if (targetTaskId) {
        const task = workerTaskMap.get(targetTaskId)
        if (task) {
          // 结束该 task 的 thinking
          finalizeTaskThinkings(task, timestamp)
          const existingToolCall = task.toolCalls.find(t => t.toolId === toolId)
          if (existingToolCall) {
            existingToolCall.status = newStatus
            existingToolCall.result = result
            existingToolCall.elapsedTime = et
          }
        }
      }
      break
    }
    case 'worker_thinking': {
      if (!data)
        break
      const { taskId, thinkingId, text } = data
      if (!taskId || !thinkingId)
        break

      const task = getOrCreateWorkerTask(workerTaskMap, taskId)

      // 查找或创建 thinking
      let thinking = task.thinkings.find(t => t.thinkingId === thinkingId)
      if (!thinking) {
        // 结束该 task 之前的 thinking
        finalizeTaskThinkings(task, timestamp)

        thinking = {
          thinkingId,
          text: '',
          isThinking: true,
          startTimestamp: timestamp,
          order: getNextWorkerOrder(context, taskId),
        }
        task.thinkings.push(thinking)
      }

      if (text !== undefined) {
        thinking.text += text
      }

      // 更新最后的时间戳
      if (timestamp) {
        thinking.endTimestamp = timestamp
      }
      break
    }
    case 'worker_content': {
      if (!data)
        break
      const { taskId, contentId, text } = data
      if (!taskId)
        break

      const task = getOrCreateWorkerTask(workerTaskMap, taskId)
      finalizeTaskThinkings(task, timestamp)

      // 查找或创建 content
      let content = contentId ? task.contents.find(c => c.contentId === contentId) : undefined
      if (!content) {
        content = {
          contentId: contentId || `${taskId}_content_${task.contents.length}`,
          text: '',
          order: getNextWorkerOrder(context, taskId),
        }
        task.contents.push(content)
      }

      if (text !== undefined) {
        content.text += text
      }
      break
    }
    case 'worker_result': {
      if (!data)
        break
      const { taskId, status } = data
      if (!taskId)
        break

      const task = getOrCreateWorkerTask(workerTaskMap, taskId)
      finalizeTaskThinkings(task, timestamp)
      task.status = normalizeWorkerStatus(status)
      break
    }
    case 'worker_stopped': {
      if (!data)
        break
      const { taskId } = data
      if (!taskId)
        break

      const task = getOrCreateWorkerTask(workerTaskMap, taskId)
      finalizeTaskThinkings(task, timestamp)
      task.status = 'failed'
      task.toolCalls = markPendingAsFailed(task.toolCalls)
      break
    }
    case 'orchestrator_stopped': {
      for (const block of context.messageBlocks) {
        if (block.type === 'tool_call' && block.status === 'pending') {
          block.status = 'failed'
        }
      }
      for (const task of workerTaskMap.values()) {
        finalizeTaskThinkings(task, timestamp)
        if (task.status === 'pending') {
          task.status = 'failed'
        }
        task.toolCalls = markPendingAsFailed(task.toolCalls)
      }
      break
    }
    case 'content': {
      if (!data)
        break
      const { contentId, text, taskId } = data
      if (!contentId)
        break

      const blockKey = `content:${contentId}`
      const contentBlock = getOrCreateBlock<ContentBlock>(context, blockKey, () => ({
        type: 'content',
        contentId,
        text: '',
        startTimestamp: timestamp,
        taskId,
      }))

      if (text !== undefined) {
        contentBlock.text += text
      }
      break
    }
    case 'synthesis': {
      if (!data)
        break
      const { text } = data
      if (text !== undefined) {
        context.textAccumulator.value += text
      }
      break
    }
  }
}

/**
 * 解析历史 SSE 消息内容
 */
export function parseHistorySSE(content: string): SSEParseResult {
  const context = createSSEProcessContext()

  const events = parseSSEContentString<SSEEventData>(content)

  let endStatus: SSEParseResult['endStatus']
  let errorMessage: string | undefined

  for (const event of events) {
    if (event.json) {
      processSSEEvent(event.json, context)

      // 检查结束事件
      if (event.json.type === 'done' || event.json.type === 'error' || event.json.type === 'interrupt') {
        endStatus = event.json.type
        if (event.json.type !== 'done' && event.json.data?.message) {
          errorMessage = event.json.data.message
        }
      }
    }
  }

  // error/interrupt 时将 pending 的 workerTask、toolCall 标记为 failed
  const isAbnormalEnd = endStatus === 'error' || endStatus === 'interrupt'
  const messageBlocks = context.messageBlocks.map((block) => {
    if (block.type === 'tool_call' && isAbnormalEnd && block.status === 'pending') {
      return { ...block, status: 'failed' as const }
    }
    return block
  })
  const workerTasks = Array.from(context.workerTaskMap.values()).map(task => ({
    ...task,
    status: isAbnormalEnd && task.status === 'pending' ? 'failed' as const : task.status,
    toolCalls: task.toolCalls.map(t => ({
      ...t,
      status: isAbnormalEnd && t.status === 'pending' ? 'failed' as const : t.status,
    })),
  }))

  return {
    messageBlocks,
    workerTasks,
    planningText: context.planningAccumulator.value,
    synthesisText: context.textAccumulator.value,
    endStatus,
    errorMessage,
  }
}

/**
 * 将 pending 状态标记为 failed（用于异常结束时）
 */
export function markPendingAsFailed<T extends { status: string }>(
  items: T[],
): T[] {
  return items.map(item =>
    item.status === 'pending' ? { ...item, status: 'failed' as const } : item,
  )
}

/**
 * 处理消息块的最终状态（标记 thinking 完成，处理异常状态）
 */
export function finalizeMessageBlocks(
  blocks: MessageBlock[],
  isAbnormalEnd: boolean,
): MessageBlock[] {
  return blocks.map((block) => {
    if (block.type === 'thinking') {
      return { ...block, isThinking: false }
    }
    if (block.type === 'tool_call' && isAbnormalEnd && block.status === 'pending') {
      return { ...block, status: 'failed' as const }
    }
    return block
  })
}

/**
 * 处理 Worker 任务的最终状态
 */
export function finalizeWorkerTasks(
  tasks: WorkerTask[],
  isAbnormalEnd: boolean,
): WorkerTask[] {
  return tasks.map(task => ({
    ...task,
    status: isAbnormalEnd && task.status === 'pending' ? 'failed' as const : task.status,
    thinkings: task.thinkings.map(t => ({ ...t, isThinking: false })),
    toolCalls: isAbnormalEnd ? markPendingAsFailed(task.toolCalls) : task.toolCalls,
  }))
}
