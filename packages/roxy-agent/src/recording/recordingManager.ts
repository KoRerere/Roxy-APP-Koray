import type {
  BrowserOpEvent,
  DomContext,
  RecordingEvent,
  RecordingSession,
  UserMessageEvent,
} from './types'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { env } from '@/config'

function nowISO(): string {
  return new Date().toISOString()
}

function generateId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export class RecordingManager {
  /** conversation → active/processing session */
  private sessions: Map<string, RecordingSession> = new Map()

  /** NDJSON 写入队列（避免并发写文件） */
  private writeQueues: Map<string, Promise<void>> = new Map()

  /** conversation → AbortController（用于取消处理流程） */
  private abortControllers: Map<string, AbortController> = new Map()

  /** 录制工作目录根路径 */
  private get rootDir(): string {
    return path.join(env.CHECKPOINT_DIR!, 'recordings')
  }

  async start(conversationId: string): Promise<RecordingSession> {
    const existing = this.sessions.get(conversationId)
    if (existing && existing.status === 'active') {
      return existing
    }

    const id = generateId()
    const workDir = path.join(this.rootDir, id)
    const eventsFilePath = path.join(workDir, 'events.jsonl')

    await fsPromises.mkdir(workDir, { recursive: true })

    const session: RecordingSession = {
      id,
      conversationId,
      status: 'active',
      eventSeq: 0,
      eventsFilePath,
      createdAt: Date.now(),
      workDir,
    }

    this.sessions.set(conversationId, session)
    console.log(`[Recording] Started session ${id} for conversation ${conversationId}`)
    return session
  }

  stop(conversationId: string): RecordingSession | null {
    const session = this.sessions.get(conversationId)
    if (!session || session.status !== 'active') {
      return session ?? null
    }

    session.status = 'processing'
    session.stoppedAt = Date.now()

    // 创建 AbortController 以支持后续取消处理流程
    const controller = new AbortController()
    this.abortControllers.set(conversationId, controller)

    console.log(`[Recording] Stopped session ${session.id}. Events: ${session.eventSeq}`)
    return session
  }

  getSession(conversationId: string): RecordingSession | null {
    return this.sessions.get(conversationId) ?? null
  }

  getActiveSession(conversationId: string): RecordingSession | null {
    const session = this.sessions.get(conversationId)
    return session?.status === 'active' ? session : null
  }

  isRecording(conversationId: string): boolean {
    return this.getActiveSession(conversationId) !== null
  }

  updateSession(conversationId: string, patch: Partial<RecordingSession>): void {
    const session = this.sessions.get(conversationId)
    if (!session)
      return
    Object.assign(session, patch)
  }

  cleanup(conversationId: string): void {
    this.sessions.delete(conversationId)
    this.writeQueues.delete(conversationId)
    this.abortControllers.delete(conversationId)
  }

  /** 取消正在进行的录制处理流程 */
  cancelProcessing(conversationId: string): boolean {
    const controller = this.abortControllers.get(conversationId)
    if (!controller) {
      return false
    }
    controller.abort('User cancelled generation')
    this.abortControllers.delete(conversationId)

    const session = this.sessions.get(conversationId)
    if (session && session.status === 'processing') {
      session.status = 'cancelled'
      console.log(`[Recording] Processing cancelled for session ${session.id}`)
    }
    return true
  }

  /** 获取录制处理流程的 AbortSignal */
  getAbortSignal(conversationId: string): AbortSignal | undefined {
    return this.abortControllers.get(conversationId)?.signal
  }

  /**
   * 重试脚本生成：复用同一录制 session 的工作区，重新启动 enhance agent
   * 仅允许在终态（cancelled / failed / done）下重试。
   */
  retryProcessing(conversationId: string): RecordingSession | null {
    const session = this.sessions.get(conversationId)
    if (!session)
      return null

    if (session.status !== 'cancelled' && session.status !== 'failed' && session.status !== 'done') {
      return null
    }

    // 重置为 processing，清空终态字段，保留 id/workDir/eventsFilePath/primaryDirId 等录制上下文
    session.status = 'processing'
    session.phase = undefined
    session.errorMessage = undefined
    session.completedAt = undefined
    session.finalScriptPath = undefined
    session.finalScriptFileId = undefined
    session.finalScriptOssUrl = undefined
    session.enhancedScriptPath = undefined

    // 创建新的 AbortController 支持本次重试可被取消
    const controller = new AbortController()
    this.abortControllers.set(conversationId, controller)

    console.log(`[Recording] Retrying processing for session ${session.id} (conversation ${conversationId})`)
    return session
  }

  appendBrowserOp(
    conversationId: string,
    opts: {
      toolName: string
      input: Record<string, any>
      result: string
      success: boolean
      errorMessage?: string
      durationMs: number
      domContext?: DomContext
      dirId?: string
      workerId?: string
    },
  ): void {
    const session = this.getActiveSession(conversationId)
    if (!session)
      return

    session.eventSeq++

    if (opts.dirId && !session.primaryDirId) {
      session.primaryDirId = opts.dirId
    }

    const event: BrowserOpEvent = {
      type: 'browser_op',
      seq: session.eventSeq,
      toolName: opts.toolName,
      input: sanitizeInput(opts.input),
      result: truncate(opts.result, 2000),
      success: opts.success,
      errorMessage: opts.errorMessage,
      durationMs: opts.durationMs,
      timestamp: nowISO(),
      domContext: opts.domContext,
      dirId: opts.dirId,
      workerId: opts.workerId,
    }

    this._appendEvent(session, event)
  }

  appendUserMessage(conversationId: string, content: string): void {
    const session = this.getActiveSession(conversationId)
    if (!session)
      return

    session.eventSeq++

    const event: UserMessageEvent = {
      type: 'user_message',
      seq: session.eventSeq,
      content,
      timestamp: nowISO(),
    }

    this._appendEvent(session, event)
  }

  async readEvents(session: RecordingSession): Promise<RecordingEvent[]> {
    try {
      const raw = await fsPromises.readFile(session.eventsFilePath, 'utf-8')
      const lines = raw.split('\n').filter(line => line.trim())
      return lines.map(line => JSON.parse(line) as RecordingEvent)
    }
    catch (err: any) {
      if (err.code === 'ENOENT')
        return []
      throw err
    }
  }

  private _appendEvent(session: RecordingSession, event: RecordingEvent): void {
    const key = session.conversationId
    const prev = this.writeQueues.get(key) ?? Promise.resolve()
    const next = prev.then(() =>
      fsPromises.appendFile(session.eventsFilePath, `${JSON.stringify(event)}\n`, 'utf-8'),
    ).catch((err: any) => {
      console.error(`[Recording] Failed to write event for ${session.id}:`, err.message)
    })
    this.writeQueues.set(key, next)
  }
}

/** 对敏感字段脱敏（token、password、cookie 等） */
function sanitizeInput(input: Record<string, any>): Record<string, any> {
  const SENSITIVE_KEYS = /password|token|cookie|authorization|secret|apikey|api_key/i
  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(input)) {
    result[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : v
  }
  return result
}

/** 截断长字符串 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen)
    return str
  return `${str.substring(0, maxLen)}...[truncated]`
}

export const recordingManager = new RecordingManager()
