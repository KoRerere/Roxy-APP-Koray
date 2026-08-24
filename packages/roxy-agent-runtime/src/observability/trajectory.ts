import { appendFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { ITrajectoryRecorder, Message, TrajectoryEvent } from '../core/interfaces.ts'

export interface TrajectoryRecorderOptions {
  /** Optional JSONL file path to mirror events to disk. */
  filePath?: string
}

/** In-memory recorder for tests. */
export class InMemoryTrajectoryRecorder implements ITrajectoryRecorder {
  private readonly traces = new Map<string, TrajectoryEvent[]>()

  start(_input: Message[]): string {
    const id = randomUUID()
    this.traces.set(id, [])
    return id
  }

  emit(event: TrajectoryEvent): void {
    const list = this.traces.get(event.traceId)
    if (!list) {
      return
    }
    list.push({ ...event, ts: Date.now() })
  }

  end(_traceId: string): void {
    // Events remain accessible via getTrace after end; no special action needed.
  }

  getTrace(traceId: string): TrajectoryEvent[] {
    return this.traces.get(traceId) ?? []
  }
}

/** Line-buffered JSONL recorder for production/dev replay. */
export class JsonlTrajectoryRecorder implements ITrajectoryRecorder {
  private readonly traces = new Map<string, TrajectoryEvent[]>()
  private readonly filePath: string | undefined

  constructor(opts: TrajectoryRecorderOptions = {}) {
    this.filePath = opts.filePath
  }

  start(_input: Message[]): string {
    const id = randomUUID()
    this.traces.set(id, [])
    return id
  }

  emit(event: TrajectoryEvent): void {
    const list = this.traces.get(event.traceId)
    const stamped = { ...event, ts: Date.now() }
    if (list) {
      list.push(stamped)
    }
    if (this.filePath) {
      appendFileSync(this.filePath, JSON.stringify(stamped) + '\n', 'utf-8')
    }
  }

  end(_traceId: string): void {}

  getTrace(traceId: string): TrajectoryEvent[] {
    return this.traces.get(traceId) ?? []
  }
}
