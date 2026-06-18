import type { GeneratedImageInfo, MessageEntryView, MessageType, SSEEventData, Todo, WorkerStatus } from '../types'
import { isHiddenToolEvent, normalizeWorkerStatus, parseSSEContentString } from './sse'

/** util.ts 内部存储结构（含 Map 字段，不对外暴露） */
interface TopLevelEntry {
  text: string
  meta: Record<string, any>
  type: MessageType
  isThinking?: boolean
  start?: number
  end?: number
  status?: WorkerStatus
  workerEntries?: Map<string, TopLevelEntry>
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

  private _dirty = new Set<string>()
  private _cachedViews = new Map<string, MessageEntryView>()
  private _cachedResult: MessageEntryView[] | null = null
  private _orderChanged = false

  private finalizeTopLevelThinking(endTimestamp?: number): void {
    if (!this.currentThinkingId)
      return

    const entry = this.entries.get(this.currentThinkingId)
    if (entry?.isThinking) {
      entry.isThinking = false
      entry.end = endTimestamp ?? entry.end ?? entry.start
      this._dirty.add(this.currentThinkingId)
    }
    this.currentThinkingId = null
  }

  add(id: string, type: MessageType, data: unknown, timestamp?: number): void {
    // 非 thinking 事件到来时，结束当前进行中的 thinking
    if ((type !== 'thinking' || (type === 'thinking' && this.currentThinkingId !== id)) && this.currentThinkingId) {
      this.finalizeTopLevelThinking(timestamp)
    }

    const isNew = !this.entries.has(id)
    if (isNew) {
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
    else if (type === 'tool_call' || type === 'tool_result' || type === 'hitl_interrupt') {
      Object.assign(entry.meta, data)
      if (type === 'tool_call' && (entry.meta.status == null || entry.meta.status === 'pending')) {
        entry.meta.status = 'pending'
      }
    }
    else if (type === 'todo') {
      this.todos.push(data?.todos as Todo[])
    }
    else if (type === 'error' || type === 'interrupt') {
      entry.text = data as string
    }
    else if (type === 'image') {
      entry.meta.images = data as GeneratedImageInfo[]
    }

    if (!entry.start) {
      entry.start = timestamp
    }
    else {
      entry.end = timestamp
    }

    if (type === 'thinking') {
      entry.isThinking = true
      this.currentThinkingId = id
    }

    if (isNew)
      this._orderChanged = true
    this._dirty.add(id)
    this.order.add(id)
  }

  private formatType(type: MessageType): MessageType {
    if (type === 'worker_content')
      return 'content'
    if (type === 'worker_thinking')
      return 'thinking'
    return type
  }

  private finalizeWorkerThinking(workerId: string, endTimestamp?: number): void {
    const workerEntries = this.entries.get(workerId)?.workerEntries
    if (workerEntries) {
      for (const entry of workerEntries.values()) {
        if (entry.type === 'thinking' && entry.isThinking) {
          entry.isThinking = false
          entry.end = endTimestamp ?? entry.end ?? entry.start
          this._dirty.add(workerId)
        }
      }
    }
    this.currentWorkerThinkingMap.delete(workerId)
  }

  finalizeThinkingForEvent(workerId?: string, endTimestamp?: number): void {
    if (workerId) {
      this.finalizeWorkerThinking(workerId, endTimestamp)
      return
    }

    this.finalizeTopLevelThinking(endTimestamp)
  }

  addWorkerEntry(
    workerId: string,
    id: string,
    type: MessageType,
    data: unknown,
    timestamp?: number,
  ): void {
    const isNewWorker = !this.entries.has(workerId)
    if (isNewWorker) {
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
      this.finalizeWorkerThinking(workerId, timestamp)
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
    else if (storedType === 'tool_call' || storedType === 'tool_result' || storedType === 'hitl_interrupt') {
      Object.assign(entry.meta, data)
      if (workerEntry.status === 'failed' && storedType === 'tool_call' && (entry.meta.status == null || entry.meta.status === 'pending')) {
        entry.meta.status = 'failed'
      }
    }

    if (!entry.start) {
      entry.start = timestamp
    }
    else {
      entry.end = timestamp
    }

    if (storedType === 'thinking') {
      entry.isThinking = true
      this.currentWorkerThinkingMap.set(workerId, id)
    }

    workerOrder.add(id)
    if (isNewWorker)
      this._orderChanged = true
    this._dirty.add(workerId)
    this.order.add(workerId)
  }

  setWorkerStatus(workerId: string, status: WorkerStatus, endTimestamp?: number): void {
    if (!workerId)
      return

    const isNew = !this.entries.has(workerId)
    if (isNew) {
      this.entries.set(workerId, {
        text: '',
        meta: {},
        type: 'worker',
        workerEntries: new Map(),
        workerOrder: new Set(),
        status: 'pending',
      })
      this._orderChanged = true
    }

    this.entries.get(workerId)!.status = status
    this.finalizeWorkerThinking(workerId, endTimestamp)
    this.order.add(workerId)
    this._dirty.add(workerId)
  }

  /** 设置 worker 任务标题（worker_dispatch 事件）。merge-safe：仅写 meta.title，不替换整个 meta。 */
  setWorkerTitle(workerId: string, title: string): void {
    if (!workerId)
      return

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

    this.entries.get(workerId)!.meta.title = title
    this.order.add(workerId)
  }

  markWorkerPendingAsFailed(workerId: string): void {
    const workerEntry = this.entries.get(workerId)
    if (!workerEntry)
      return

    if (workerEntry.status === 'pending') {
      workerEntry.status = 'failed'
    }

    const workerEntries = workerEntry.workerEntries
    if (workerEntries) {
      for (const entry of workerEntries.values()) {
        if (entry.isThinking)
          entry.isThinking = false
        if (entry.type === 'tool_call' && (entry.meta.status == null || entry.meta.status === 'pending')) {
          entry.meta.status = 'failed'
        }
      }
    }
    this.currentWorkerThinkingMap.delete(workerId)
    this._dirty.add(workerId)
  }

  markPendingAsFailed(): void {
    this.currentThinkingId = null
    this.currentWorkerThinkingMap.clear()

    for (const [id, entry] of this.entries) {
      if (entry.isThinking)
        entry.isThinking = false

      if (entry.type === 'tool_call' && (entry.meta.status == null || entry.meta.status === 'pending')) {
        entry.meta.status = 'failed'
        this._dirty.add(id)
      }

      if (entry.type === 'worker') {
        this.markWorkerPendingAsFailed(id)
      }
    }
  }

  /** 流式更新单张图片占位（image_partial 事件） */
  setImageAtIndex(id: string, index: number, image: GeneratedImageInfo): void {
    if (!this.entries.has(id)) {
      this.entries.set(id, { text: '', meta: { images: [], isPending: true }, type: 'image' })
      this.order.add(id)
      this._orderChanged = true
    }
    const entry = this.entries.get(id)!
    const images: GeneratedImageInfo[] = Array.isArray(entry.meta.images) ? [...entry.meta.images] : []
    if (index < images.length)
      images[index] = image
    else
      images.push(image)
    entry.meta.images = images
    this._dirty.add(id)
  }

  /** 清除占位状态；传入 images 时替换列表（image_done 兼容），不传时仅移除剩余 pending 占位 */
  finalizeImages(id: string, images?: GeneratedImageInfo[]): void {
    if (!this.entries.has(id)) {
      if (!images?.length)
        return
      this.entries.set(id, { text: '', meta: {}, type: 'image' })
      this.order.add(id)
      this._orderChanged = true
    }
    const entry = this.entries.get(id)!
    if (images) {
      entry.meta.images = images
    }
    else {
      // 过滤掉仍处于 pending 状态的占位
      const existing = Array.isArray(entry.meta.images) ? entry.meta.images as GeneratedImageInfo[] : []
      entry.meta.images = existing.filter(img => !img.isPending)
    }
    entry.meta.isPending = false
    this._dirty.add(id)
  }

  remove(id: string): void {
    this.entries.delete(id)
    this.order.delete(id)
    this._cachedViews.delete(id)
    this._cachedResult = null
    this._orderChanged = true
  }

  /** 结束所有进行中的 thinking，用于流结束时调用 */
  finalize(endTimestamp?: number): void {
    this.currentThinkingId = null
    this.currentWorkerThinkingMap.clear()
    for (const [id, entry] of this.entries) {
      if (entry.isThinking) {
        entry.isThinking = false
        entry.end = endTimestamp ?? entry.end ?? entry.start
        this._dirty.add(id)
      }
      if (entry.workerEntries) {
        for (const we of entry.workerEntries.values()) {
          if (we.isThinking) {
            we.isThinking = false
            we.end = endTimestamp ?? we.end ?? we.start
          }
        }
        // workerEntries 内部变化通过 worker 顶层条目 dirty 触发重建
        if (entry.type === 'worker')
          this._dirty.add(id)
      }
    }
  }

  view(): MessageEntryView[] {
    // 只重建有变化的条目，其余复用缓存引用，让下游 props 浅比较命中
    for (const id of this._dirty) {
      const entry = this.entries.get(id)
      if (!entry) {
        this._cachedViews.delete(id)
        continue
      }
      const { workerEntries, workerOrder, ...rest } = entry
      const workers = workerOrder && workerEntries
        ? Array.from(workerOrder, wid => ({ id: wid, ...workerEntries.get(wid)! }))
        : []
      this._cachedViews.set(id, { id, ...rest, workers })
    }
    this._dirty.clear()

    // 顺序未变且已有缓存结果直接返回同一数组引用
    if (!this._orderChanged && this._cachedResult) {
      // 原地更新数组内容（保持引用稳定）而不是重建，避免虚拟列表认为整体换了
      for (let i = 0; i < this._cachedResult.length; i++) {
        const id = this._cachedResult[i].id
        const cached = this._cachedViews.get(id)
        if (cached)
          this._cachedResult[i] = cached
      }
      return this._cachedResult
    }

    // 顺序有变化：重建数组
    this._cachedResult = Array.from(this.order, id => this._cachedViews.get(id)!)
    this._orderChanged = false
    return this._cachedResult
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
        if (isHiddenToolEvent(block.data))
          break

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
      // case 'hitl_interrupt':
      //   messageViewer.add(block.data?.interruptsId || '', block.type, block.data, block.timestamp)
      //   break
      // case 'hitl_resume':
      //   // 复用已存在的 hitl_interrupt 条目，将 decisions 合并进 meta，用于历史回放
      //   if (block.data?.interruptsId) {
      //     messageViewer.add(block.data.interruptsId, 'hitl_interrupt', { decisions: block.data.decisions }, block.timestamp)
      //   }
      //   break
      case 'worker_content':
        messageViewer.addWorkerEntry(block.data?.taskId || '', block.data?.contentId || '', block.type, block.data?.text || '', block.timestamp)
        break
      case 'worker_thinking':
        messageViewer.addWorkerEntry(block.data?.taskId || '', block.data?.thinkingId || '', block.type, block.data?.text || '', block.timestamp)
        break
      case 'worker_dispatch':
        messageViewer.setWorkerTitle(block.data?.taskId || '', block.data?.title || '')
        break
      case 'worker_result':
        messageViewer.setWorkerStatus(block.data?.taskId || '', normalizeWorkerStatus(block.data?.status), block.timestamp)
        break
      case 'worker_stopped':
        messageViewer.setWorkerStatus(block.data?.taskId || '', 'failed', block.timestamp)
        messageViewer.markWorkerPendingAsFailed(block.data?.taskId || '')
        break
      case 'orchestrator_stopped':
        messageViewer.markPendingAsFailed()
        break
      case 'error':
      case 'interrupt':
        messageViewer.add(block.type, block.type, block.data, block.timestamp)
        break
      case 'image_generating': {
        const count = Math.min(Math.max(Number(block.data?.count) || 1, 1), 4)
        const pendingImages: GeneratedImageInfo[] = Array.from({ length: count }, (_, i) => ({
          fileId: `pending-${i}`,
          fileName: '',
          isPending: true,
        }))
        messageViewer.add('__images__', 'image', pendingImages)
        break
      }
      case 'image_partial': {
        const { index, image } = block.data ?? {}
        if (image != null && index != null) {
          messageViewer.setImageAtIndex('__images__', index, image)
        }
        break
      }
      case 'image_done': {
        if (Array.isArray(block.data?.images)) {
          messageViewer.finalizeImages('__images__', block.data.images)
        }
        break
      }
      // case 'done':
      default:
        break
    }
  })

  return messageViewer.view()
}

/**
 * 从图片生成的 SSE 文件内容中还原图片列表（用于历史回显）
 */
export function parseHistoryImageSSE(content: string): GeneratedImageInfo[] {
  const events = parseSSEContentString<SSEEventData>(content).map(e => e.json)
  const imageMap = new Map<number, GeneratedImageInfo>()

  for (const block of events) {
    if (!block)
      continue
    if (block.type === 'image_partial' && block.data?.image != null && block.data.index != null) {
      imageMap.set(block.data.index, block.data.image)
    }
    else if (block.type === 'image_done' && Array.isArray(block.data?.images)) {
      // image_done 包含最终有序列表，直接用它
      return block.data.images
    }
  }

  return Array.from(imageMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, img]) => img)
}
