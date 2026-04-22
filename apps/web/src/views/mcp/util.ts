import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { safeParseJSON } from '/@/utils'
import type { ContentBlock, MessageBlock, MessageEntry, MessageEntryView, MessageType, SSEEventData, SSEParseResult, ThinkingBlock, Todo, TodoStatus, ToolCallBlock, WorkerEntryView, WorkerStatus, WorkerTask } from './types'

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

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

interface FetchSSEOptions<T = unknown> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: BodyInit | null
  signal?: AbortSignal
  onEvent?: (evt: SSEParsedEvent<T>) => void
  onError?: (err: unknown) => void
  parseJson?: (data: string) => T
  includeRawBlock?: boolean
}

/**
 * 解析单个 SSE 事件块
 */
function parseSSEBlock<T>(rawBlock: string): { event: string, id?: string, data: string, json: T | null } {
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
  if (!eventData?.data)
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
      if (data.text !== undefined) {
        planningAccumulator.value += data.text
      }
      break
    }
    case 'thinking': {
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
      const { taskId, status } = data
      if (!taskId)
        break

      const task = getOrCreateWorkerTask(workerTaskMap, taskId)
      finalizeTaskThinkings(task, timestamp)
      task.status = (status ?? 'success') as WorkerTask['status']
      break
    }
    case 'content': {
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
 * fetch + ReadableStream 解析 SSE
 */
export async function fetchSSE<T = unknown>(
  url: string,
  opts: FetchSSEOptions<T> = {},
): Promise<void> {
  const {
    method = 'GET',
    headers = {},
    body = null,
    signal,
    onEvent,
    onError,
    parseJson,
    includeRawBlock = false,
  } = opts

  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'text/event-stream',
      ...headers,
    },
    body,
    signal,
  })

  if (!res.ok)
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  if (!res.body)
    throw new Error('ReadableStream not supported in this environment')

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')

  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done)
        break

      buffer += decoder.decode(value, { stream: true })

      let splitIndex: number
      while (true) {
        splitIndex = buffer.search(/\r?\n\r?\n/)
        if (splitIndex === -1)
          break

        const rawBlock = buffer.slice(0, splitIndex)
        buffer = buffer.slice(splitIndex).replace(/^\r?\n\r?\n/, '')

        if (!rawBlock.trim())
          continue

        const { event, id, data, json: defaultJson } = parseSSEBlock<T>(rawBlock)
        const json = parseJson ? safeCallParse(parseJson, data) : defaultJson

        onEvent?.({
          event,
          id,
          data,
          json,
          rawBlock: includeRawBlock ? rawBlock : undefined,
        })
      }
    }
  }
  catch (err) {
    onError?.(err)
    throw err
  }
  finally {
    reader.releaseLock()
  }
}

function safeCallParse<T>(fn: (s: string) => T, s: string): T | null {
  try {
    return fn(s)
  }
  catch {
    return null
  }
}

export function withTimeout(ms: number) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  return { c, cleanup: () => clearTimeout(t) }
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

export function markedParse(text: string) {
  return DOMPurify.sanitize(marked.parse(text, { async: false }))
}

/** util.ts 内部存储结构（含 Map 字段，不对外暴露） */
interface TopLevelEntry extends MessageEntry {
  workerEntries?: Map<string, MessageEntry>
  workerOrder?: Set<string>
}

export class MessageViewer {
  private entries = new Map<string, TopLevelEntry>()
  private order = new Set<string>()
  private todos: Todo[][] = []
  /** 当前正在进行的顶层 thinking 条目 id */
  private currentThinkingId: string | null = null
  /** 每个 worker 当前正在进行的 thinking id */
  private currentWorkerThinkingMap = new Map<string, string>()

  add(id: string, type: MessageType, data: unknown, timestamp?: number): void {
    // 非 thinking 事件到来时，结束当前进行中的 thinking
    if (type !== 'thinking' && this.currentThinkingId) {
      const prev = this.entries.get(this.currentThinkingId)
      if (prev)
        prev.isThinking = false
      this.currentThinkingId = null
    }

    if (!this.entries.has(id)) {
      this.entries.set(id, {
        text: '',
        meta: {},
        type,
        isThinking: type === 'thinking' ? true : undefined,
      })
    }

    const entry = this.entries.get(id)!

    if (type === 'thinking' || type === 'content') {
      entry.text += data as string
    }
    else if (type === 'tool_call' || type === 'tool_result') {
      Object.assign(entry.meta, data)
    }
    else if (type === 'todo') {
      this.todos.push(data?.todos as Todo[])
    }
    else if (type === 'error' || type === 'interrupt') {
      entry.text = data as string
    }

    if (!entry.start) {
      entry.start = timestamp
    }
    else {
      entry.end = timestamp
    }

    if (type === 'thinking') {
      this.currentThinkingId = id
    }

    this.order.add(id)
  }

  private formatType(type: MessageType): MessageType {
    if (type === 'worker_content')
      return 'content'
    if (type === 'worker_thinking')
      return 'thinking'
    return type
  }

  addWorkerEntry(
    workerId: string,
    id: string,
    type: MessageType,
    data: unknown,
    timestamp?: number,
  ): void {
    if (!this.entries.has(workerId)) {
      this.entries.set(workerId, {
        text: '',
        meta: {},
        type: 'worker',
        workerEntries: new Map(),
        workerOrder: new Set(),
        status: 'pending',
      })
    }

    const workerEntry = this.entries.get(workerId)!
    const workerEntries = workerEntry.workerEntries!
    const workerOrder = workerEntry.workerOrder!

    const storedType = this.formatType(type)

    // 非 thinking 事件到来时，结束该 worker 当前进行中的 thinking
    if (storedType !== 'thinking' && this.currentWorkerThinkingMap.has(workerId)) {
      const prevId = this.currentWorkerThinkingMap.get(workerId)!
      const prevEntry = workerEntries.get(prevId)
      if (prevEntry)
        prevEntry.isThinking = false
      this.currentWorkerThinkingMap.delete(workerId)
    }

    if (!workerEntries.has(id)) {
      workerEntries.set(id, {
        type: storedType,
        text: '',
        meta: {},
        isThinking: storedType === 'thinking' ? true : undefined,
      })
    }

    const entry = workerEntries.get(id)!

    if (storedType === 'thinking' || storedType === 'content') {
      entry.text += data as string
    }
    else if (storedType === 'tool_call' || storedType === 'tool_result') {
      Object.assign(entry.meta, data)
    }

    if (!entry.start) {
      entry.start = timestamp
    }
    else {
      entry.end = timestamp
    }

    if (storedType === 'thinking') {
      this.currentWorkerThinkingMap.set(workerId, id)
    }

    workerOrder.add(id)
    this.order.add(workerId)
  }

  setWorkerStatus(workerId: string, status: WorkerStatus): void {
    if (!this.entries.has(workerId)) {
      this.entries.set(workerId, {
        text: '',
        meta: {},
        type: 'worker',
        workerEntries: new Map(),
        workerOrder: new Set(),
        status: 'pending',
      })
    }

    this.entries.get(workerId)!.status = status
  }

  /** 结束所有进行中的 thinking，用于流结束时调用 */
  finalize(): void {
    this.currentThinkingId = null
    this.currentWorkerThinkingMap.clear()
    for (const entry of this.entries.values()) {
      if (entry.isThinking)
        entry.isThinking = false
      if (entry.workerEntries) {
        for (const we of entry.workerEntries.values()) {
          if (we.isThinking)
            we.isThinking = false
        }
      }
    }
  }

  view(): MessageEntryView[] {
    return Array.from(this.order, (id) => {
      const { workerEntries, workerOrder, ...rest } = this.entries.get(id)!
      const workers: WorkerEntryView[] = workerOrder && workerEntries
        ? Array.from(workerOrder, wid => ({ id: wid, ...workerEntries.get(wid)! }))
        : []
      return { id, ...rest, workers }
    })
  }

  viewTodo(): Todo[] {
    return this.todos[this.todos.length - 1] as Todo[]
  }
}

export function parseHistorySSE2(content: string) {
  const events = parseSSEContentString<SSEEventData>(content).map(item => item.json)
  const messageViewer = new MessageViewer()
  events.forEach((block) => {
    if (!block)
      return
    switch (block.type) {
      case 'session':
        break

      case 'tool_call':
      case 'tool_result':
        if (block.data?.taskId) {
          messageViewer.addWorkerEntry(block.data?.taskId || '', block.data?.toolId || '', block.type, block.data)
        }
        else {
          messageViewer.add(block.data?.toolId || '', block.type, block.data)
        }

        break
      case 'thinking':
        messageViewer.add(block.data?.thinkingId || '', block.type, block.data?.text || '', block.timestamp)
        break
      case 'content':
        if (!block.data?.contentId) {
          console.log(block)
        }
        messageViewer.add(block.data?.contentId || '', block.type, block.data?.text || '', block.timestamp)
        break
      case 'worker_content':
        messageViewer.addWorkerEntry(block.data?.taskId || '', block.data?.contentId || '', block.type, block.data?.text || '', block.timestamp)
        break
      case 'worker_thinking':
        messageViewer.addWorkerEntry(block.data?.taskId || '', block.data?.thinkingId || '', block.type, block.data?.text || '', block.timestamp)
        break
      case 'worker_result':
        messageViewer.setWorkerStatus(block.data?.taskId || '', block.data?.status)
        break
      case 'error':
      case 'interrupt':
        messageViewer.add(block.type, block.type, block.data, block.timestamp)
        break
      // case 'done':
      default:
        console.log('unknown event', block)
    }
  })

  return messageViewer.view()
}
