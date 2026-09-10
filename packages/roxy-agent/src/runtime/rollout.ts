import type { ISessionStore, Message, RolloutEvent, SessionId, SessionMeta } from 'roxy-agent-runtime'
import { sanitizeId } from '@roxy/shared/agent-paths'
import fs from 'node:fs'
import path from 'node:path'

export type RoxyRolloutEvent = RolloutEvent | {
  type: 'roxy_window_used'
  dirId: string
  turnId: string
  ts: number
}

function isLegacyRuntimeMetadataMessage(message: Message): boolean {
  return message.visible === false
    && typeof message.content === 'string'
    && message.content.trimStart().startsWith('<metadata>')
}

function isReplayableRoxyEvent(event: RoxyRolloutEvent): event is RolloutEvent {
  if (event.type === 'roxy_window_used') {
    return false
  }
  if (event.type === 'user_input' && isLegacyRuntimeMetadataMessage(event.message)) {
    return false
  }
  return true
}

/** Roxy-owned append-only rollout store used by runtime-backed conversations. */
export class RoxyRolloutStore implements ISessionStore {
  constructor(
    private readonly rootDir: string,
    private readonly rolloutPath?: (sessionId: string) => string,
  ) {}

  private filePath(sessionId: string): string {
    if (this.rolloutPath) {
      return this.rolloutPath(sessionId)
    }
    return path.join(this.rootDir, sanitizeId(sessionId), 'rollout.jsonl')
  }

  async append(sessionId: SessionId, event: RolloutEvent): Promise<void> {
    this.appendEvent(sessionId, withTimestamp(event))
  }

  async receiveInput(sessionId: SessionId, message: Message): Promise<boolean> {
    const turnId = message.metadata?.turnId
    if (typeof turnId !== 'string' || !turnId) {
      throw new Error('Received input requires a turnId')
    }
    const events = await this.read(sessionId)
    if (events.some(event => event.type === 'user_input' && event.message.visible !== false
      && event.message.metadata?.turnId === turnId)) {
      return false
    }
    await this.append(sessionId, { type: 'user_input', message })
    return true
  }

  recordWindowUsed(sessionId: SessionId, turnId: string, dirId: string): void {
    this.appendEvent(sessionId, { type: 'roxy_window_used', dirId, turnId, ts: Date.now() })
  }

  private appendEvent(sessionId: SessionId, event: RoxyRolloutEvent): void {
    const filePath = this.filePath(sessionId)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, 'utf8')
  }

  async read(sessionId: SessionId): Promise<RolloutEvent[]> {
    return (await this.readEvents(sessionId)).filter(isReplayableRoxyEvent)
  }

  async readEvents(sessionId: SessionId): Promise<RoxyRolloutEvent[]> {
    const filePath = this.filePath(sessionId)
    if (!fs.existsSync(filePath)) {
      return []
    }
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean)
    const events: RoxyRolloutEvent[] = []
    for (const line of lines) {
      try {
        events.push(JSON.parse(line) as RoxyRolloutEvent)
      } catch {
        // A truncated final line must not make an otherwise valid conversation unusable.
        break
      }
    }
    return events
  }

  async list(): Promise<SessionMeta[]> {
    if (!fs.existsSync(this.rootDir)) {
      return []
    }
    const sessions: SessionMeta[] = []
    for (const sessionId of fs.readdirSync(this.rootDir)) {
      const meta = await this.meta(sessionId)
      if (meta) {
        sessions.push(meta)
      }
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async meta(sessionId: SessionId): Promise<SessionMeta | null> {
    const filePath = this.filePath(sessionId)
    if (!fs.existsSync(filePath)) {
      return null
    }
    const events = await this.read(sessionId)
    if (events.length === 0) {
      return null
    }
    const stat = fs.statSync(filePath)
    const first = events[0]
    return {
      sessionId,
      createdAt: first?.type === 'session_start' ? first.createdAt : stat.birthtimeMs,
      updatedAt: stat.mtimeMs,
      eventCount: events.length,
    }
  }

}

function withTimestamp(event: RolloutEvent): RolloutEvent {
  return typeof (event as { ts?: unknown }).ts === 'number' ? event : { ...event, ts: Date.now() }
}
