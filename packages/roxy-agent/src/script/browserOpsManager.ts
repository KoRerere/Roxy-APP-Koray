import type {
  BrowserOpEvent,
  DomContext,
} from './types'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { agentPaths } from '@/core/storage/agentPaths'

/**
 * 会话浏览器操作录制管理器。
 *
 * 浏览器操作是"环境级捕获"（先于任何脚本工作台存在），故录制流落在会话级
 * `sessions/{convId}/recording.jsonl`（append-only），供 Agent 按需读取。
 */
interface RecordingState {
  eventSeq: number
  eventsFilePath: string
  primaryDirId?: string
  workDir: string
}

export class BrowserOpsManager {
  /** conversation → recording.jsonl 状态 */
  private sessions: Map<string, RecordingState> = new Map()

  /** conversation → recording.jsonl 写队列（串行写，避免并发写文件） */
  private writeQueues: Map<string, Promise<void>> = new Map()

  /**
   * 初始化会话录制流（幂等）。
   */
  async ensure(conversationId: string): Promise<RecordingState> {
    const existing = this.sessions.get(conversationId)
    if (existing) {
      return existing
    }

    const eventsFilePath = agentPaths.sessionRecordingLog(conversationId)
    fs.mkdirSync(path.dirname(eventsFilePath), { recursive: true })
    const existingEvents = await this.readEventsFromFile(eventsFilePath)

    const session: RecordingState = {
      eventSeq: existingEvents.length,
      eventsFilePath,
      primaryDirId: inferPrimaryDirId(existingEvents),
      workDir: agentPaths.sessionDir(conversationId),
    }

    this.sessions.set(conversationId, session)
    console.log(`[ConversationLog] Ready recording for conversation ${conversationId}`)
    return session
  }

  getSession(conversationId: string): RecordingState | null {
    return this.sessions.get(conversationId) ?? null
  }

  canAppendEvents(conversationId: string): boolean {
    return this.sessions.has(conversationId)
  }

  get sessionCount(): number {
    return this.sessions.size
  }

  async clearSession(conversationId: string): Promise<void> {
    const pending = this.writeQueues.get(conversationId)
    if (pending) {
      try {
        await pending
      }
      catch {}
    }
    this.sessions.delete(conversationId)
    this.writeQueues.delete(conversationId)
  }

  appendBrowserOp(conversationId: string, opts: {
    toolName: string
    input: Record<string, any>
    result: string
    success: boolean
    errorMessage?: string
    durationMs: number
    domContext?: DomContext
    dirId?: string
    workerId?: string
  }): void {
    const session = this.sessions.get(conversationId)
    if (!session) {
      return
    }

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
      timestamp: new Date().toISOString(),
      domContext: opts.domContext,
      dirId: opts.dirId,
      workerId: opts.workerId,
    }

    this.enqueueWrite(conversationId, async () => {
      await fsPromises.mkdir(session.workDir, { recursive: true })
      await fsPromises.appendFile(session.eventsFilePath, `${JSON.stringify(event)}\n`, 'utf-8')
    })
  }

  private async readEventsFromFile(filePath: string): Promise<BrowserOpEvent[]> {
    try {
      const raw = await fsPromises.readFile(filePath, 'utf-8')
      const lines = raw.split('\n').filter(line => line.trim())
      return lines.map(line => JSON.parse(line) as BrowserOpEvent)
    }
    catch (err: any) {
      if (err.code === 'ENOENT') {
        return []
      }
      throw err
    }
  }

  // ==================== 共用写队列 ====================

  private enqueueWrite(conversationId: string, task: () => Promise<void>): void {
    const prev = this.writeQueues.get(conversationId) ?? Promise.resolve()
    const next = prev.then(task).catch((err: any) => {
      console.error(`[ConversationLog] Failed to write for ${conversationId}:`, err?.message ?? err)
    })
    this.writeQueues.set(conversationId, next)
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
  if (str.length <= maxLen) {
    return str
  }
  return `${str.substring(0, maxLen)}...[truncated]`
}

function inferPrimaryDirId(events: BrowserOpEvent[]): string | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event?.dirId) {
      return event.dirId
    }
  }
  return undefined
}

export const browserOpsManager = new BrowserOpsManager()
