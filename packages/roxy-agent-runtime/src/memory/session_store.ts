import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ISessionStore, RolloutEvent, SessionId, SessionMeta } from '../core/interfaces.ts'

export interface JsonlSessionStoreOptions {
  /** Directory holding `<sessionId>.rollout.jsonl` files. */
  dir: string
}

/** Append-only JSONL session store. One file per session. */
export class JsonlSessionStore implements ISessionStore {
  private readonly dir: string

  constructor(opts: JsonlSessionStoreOptions) {
    this.dir = opts.dir
    mkdirSync(this.dir, { recursive: true })
  }

  async append(sessionId: SessionId, event: RolloutEvent): Promise<void> {
    const path = this.filePath(sessionId)
    appendFileSync(path, JSON.stringify(withTimestamp(event)) + '\n', 'utf-8')
  }

  async read(sessionId: SessionId): Promise<RolloutEvent[]> {
    const path = this.filePath(sessionId)
    if (!existsSync(path)) {
      return []
    }
    const raw = readFileSync(path, 'utf-8')
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RolloutEvent)
  }

  async list(): Promise<SessionMeta[]> {
    if (!existsSync(this.dir)) {
      return []
    }
    const files = readdirSync(this.dir).filter((f) => f.endsWith('.rollout.jsonl'))
    const metas: SessionMeta[] = []
    for (const file of files) {
      const sessionId = file.replace('.rollout.jsonl', '')
      const m = await this.meta(sessionId)
      if (m) {
        metas.push(m)
      }
    }
    return metas.toSorted((a, b) => b.updatedAt - a.updatedAt)
  }

  async meta(sessionId: SessionId): Promise<SessionMeta | null> {
    const path = this.filePath(sessionId)
    if (!existsSync(path)) {
      return null
    }
    const events = await this.read(sessionId)
    if (events.length === 0) {
      return null
    }
    const stat = statSync(path)
    const first = events[0]
    const createdAt = first?.type === 'session_start' ? first.createdAt : stat.birthtimeMs
    return {
      sessionId,
      createdAt,
      updatedAt: stat.mtimeMs,
      eventCount: events.length,
    }
  }

  private filePath(sessionId: SessionId): string {
    return join(this.dir, `${sessionId}.rollout.jsonl`)
  }
}

function withTimestamp(event: RolloutEvent): RolloutEvent {
  return typeof (event as { ts?: unknown }).ts === 'number' ? event : { ...event, ts: Date.now() }
}
