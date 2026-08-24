import type {
  CreateTaskLogInput,
  FinishTaskLogInput,
  ListTaskLogsInput,
  TaskLog,
  TaskLogPage,
  TaskLogStatus,
  TaskLogStoreEvent,
  TaskScriptRun,
  UpdateTaskLogAssociationsInput,
  UpdateTaskLogExecutionInput,
} from './types'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { agentPaths } from '@/core/storage/agentPaths'

export * from './types'

interface TaskLogRow {
  id: string
  user_id: string
  workspace_id: string
  task_id: number
  task_name: string
  template_id: number
  template_name: string
  template_type: TaskLog['template_type']
  trigger_type: TaskLog['trigger_type']
  occurrence_id: string | null
  scheduled_at: string | null
  input_json: string
  window_dir_ids_json: string
  script_runs: string
  conversation_id: string | null
  file_ids_json: string
  status: TaskLogStatus
  started_at: string
  ended_at: string | null
  end_reason_code: string | null
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  }
  catch {
    return fallback
  }
}

function mapTaskLog(row: TaskLogRow): TaskLog {
  return {
    id: row.id,
    user_id: row.user_id,
    workspace_id: row.workspace_id,
    task_id: Number(row.task_id),
    task_name: row.task_name,
    template_id: Number(row.template_id),
    template_name: row.template_name,
    template_type: row.template_type,
    trigger_type: row.trigger_type,
    occurrence_id: row.occurrence_id,
    scheduled_at: row.scheduled_at,
    input: parseJson(row.input_json, null),
    window_dir_ids: parseJson<string[]>(row.window_dir_ids_json, []),
    script_runs: parseJson<TaskScriptRun[]>(row.script_runs, []),
    conversation_id: row.conversation_id,
    file_ids: parseJson<string[]>(row.file_ids_json, []),
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at,
    end_reason_code: row.end_reason_code,
  }
}

export class TaskLogStore {
  private db?: DatabaseSync
  private readonly subscribers = new Set<(event: TaskLogStoreEvent) => void>()

  constructor(private readonly dbPath: string = agentPaths.tasksDb) {}

  /** Initialize the task database after startup migrations have completed. */
  initialize(): void {
    this.ensureDb()
  }

  private ensureDb(): DatabaseSync {
    if (this.db) {
      return this.db
    }

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true })
    const db = new DatabaseSync(this.dbPath)

    db.exec('PRAGMA journal_mode = \'WAL\'')
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_logs (
        id                      TEXT PRIMARY KEY,
        user_id                 TEXT NOT NULL,
        workspace_id            TEXT NOT NULL,
        task_id                 INTEGER NOT NULL,
        task_name               TEXT NOT NULL,
        template_id             INTEGER NOT NULL,
        template_name           TEXT NOT NULL,
        template_type           TEXT NOT NULL,
        trigger_type            TEXT NOT NULL,
        occurrence_id           TEXT,
        scheduled_at            DATETIME,
        input_json              TEXT NOT NULL DEFAULT '{}',
        window_dir_ids_json     TEXT NOT NULL DEFAULT '[]',
        script_runs             TEXT NOT NULL DEFAULT '[]',
        conversation_id         TEXT,
        file_ids_json           TEXT NOT NULL DEFAULT '[]',
        status                  TEXT NOT NULL DEFAULT 'preparing',
        started_at              DATETIME NOT NULL,
        ended_at                DATETIME,
        end_reason_code         TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_task_logs_workspace_started
        ON task_logs(user_id, workspace_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_task_logs_task_started
        ON task_logs(task_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_task_logs_status_started
        ON task_logs(status, started_at DESC);
    `)

    const columns = db.prepare('PRAGMA table_info(task_logs)').all() as unknown as Array<{ name: string }>
    if (!columns.some(column => column.name === 'script_runs')) {
      db.exec(`
        ALTER TABLE task_logs ADD COLUMN script_runs TEXT NOT NULL DEFAULT '[]';
      `)
    }

    this.db = db
    return db
  }

  create(input: CreateTaskLogInput): TaskLog {
    const db = this.ensureDb()
    db.prepare(`
      INSERT INTO task_logs (
        id, user_id, workspace_id, task_id, task_name, template_id,
        template_name, template_type, trigger_type, scheduled_at,
        input_json, status, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'preparing', ?)
    `).run(
      input.id,
      input.userId,
      input.workspaceId,
      input.taskId,
      input.taskName,
      input.templateId,
      input.templateName,
      input.templateType,
      input.triggerType,
      input.scheduledAt ?? null,
      JSON.stringify(input.input ?? null),
      input.startedAt ?? nowIso(),
    )
    return this.emitChanged(this.getRequired(input.id))
  }

  markRunning(id: string, input: UpdateTaskLogExecutionInput = {}): TaskLog {
    const db = this.ensureDb()
    const result = db.prepare(`
      UPDATE task_logs
      SET status = 'running',
          occurrence_id = COALESCE(?, occurrence_id),
          window_dir_ids_json = COALESCE(?, window_dir_ids_json),
          script_runs = CASE
            WHEN template_type = 'script' THEN COALESCE(?, script_runs)
            ELSE script_runs
          END
      WHERE id = ? AND status = 'preparing'
    `).run(
      input.occurrenceId ?? null,
      input.windowDirIds === undefined ? null : JSON.stringify(input.windowDirIds),
      input.scriptRuns === undefined ? null : JSON.stringify(input.scriptRuns),
      id,
    )
    if (Number(result.changes) === 0) {
      throw new Error(`Task log ${id} is not preparing`)
    }
    return this.emitChanged(this.getRequired(id))
  }

  updateAssociations(id: string, input: UpdateTaskLogAssociationsInput): TaskLog {
    const db = this.ensureDb()
    const result = db.prepare(`
      UPDATE task_logs
      SET conversation_id = COALESCE(?, conversation_id),
          file_ids_json = COALESCE(?, file_ids_json)
      WHERE id = ? AND template_type != 'script'
        AND status IN ('preparing', 'running')
    `).run(
      input.conversationId ?? null,
      input.fileIds === undefined ? null : JSON.stringify(input.fileIds),
      id,
    )
    if (Number(result.changes) === 0) {
      throw new Error(`Task log ${id} is not active`)
    }
    return this.emitChanged(this.getRequired(id))
  }

  finish(id: string, input: FinishTaskLogInput): TaskLog {
    const db = this.ensureDb()
    const result = db.prepare(`
      UPDATE task_logs
      SET status = ?, ended_at = ?, end_reason_code = ?,
          script_runs = CASE
            WHEN template_type = 'script' THEN COALESCE(?, script_runs)
            ELSE script_runs
          END,
          conversation_id = CASE
            WHEN template_type != 'script' THEN COALESCE(?, conversation_id)
            ELSE conversation_id
          END,
          file_ids_json = CASE
            WHEN template_type != 'script' THEN COALESCE(?, file_ids_json)
            ELSE file_ids_json
          END
      WHERE id = ? AND status IN ('preparing', 'running')
    `).run(
      input.status,
      input.endedAt ?? nowIso(),
      input.endReasonCode ?? null,
      input.scriptRuns === undefined ? null : JSON.stringify(input.scriptRuns),
      input.conversationId ?? null,
      input.fileIds === undefined ? null : JSON.stringify(input.fileIds),
      id,
    )
    if (Number(result.changes) === 0) {
      throw new Error(`Task log ${id} is not active`)
    }
    return this.emitChanged(this.getRequired(id))
  }

  recoverInterrupted(): number {
    const db = this.ensureDb()
    const result = db.prepare(`
      UPDATE task_logs
      SET status = 'interrupted', ended_at = ?,
          end_reason_code = 'AGENT_RESTARTED'
      WHERE status IN ('preparing', 'running')
    `).run(nowIso())
    return Number(result.changes)
  }

  getById(id: string, userId?: string, workspaceId?: string): TaskLog | null {
    const db = this.ensureDb()
    const scoped = userId !== undefined && workspaceId !== undefined
    const row = scoped
      ? db.prepare('SELECT * FROM task_logs WHERE id = ? AND user_id = ? AND workspace_id = ?')
          .get(id, userId, workspaceId)
      : db.prepare('SELECT * FROM task_logs WHERE id = ?').get(id)
    return row ? mapTaskLog(row as unknown as TaskLogRow) : null
  }

  list(input: ListTaskLogsInput): TaskLogPage {
    const db = this.ensureDb()
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 200)
    const offset = Math.max(input.offset ?? 0, 0)
    const clauses = ['user_id = ?', 'workspace_id = ?']
    const params: Array<string | number> = [input.userId, input.workspaceId]
    if (input.taskId !== undefined) {
      clauses.push('task_id = ?')
      params.push(input.taskId)
    }
    if (input.status !== undefined) {
      clauses.push('status = ?')
      params.push(input.status)
    }
    if (input.triggerType !== undefined) {
      clauses.push('trigger_type = ?')
      params.push(input.triggerType)
    }
    const where = clauses.join(' AND ')
    const rows = db.prepare(`
      SELECT * FROM task_logs WHERE ${where}
      ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as unknown as TaskLogRow[]
    const count = db.prepare(`SELECT COUNT(*) AS total FROM task_logs WHERE ${where}`)
      .get(...params) as unknown as { total: number }
    return {
      items: rows.map(mapTaskLog),
      total: Number(count.total),
      limit,
      offset,
    }
  }

  delete(id: string, userId: string, workspaceId: string): 'deleted' | 'not_found' | 'active' {
    const db = this.ensureDb()
    const result = db.prepare(`
      DELETE FROM task_logs
      WHERE id = ? AND user_id = ? AND workspace_id = ?
        AND status NOT IN ('preparing', 'running')
    `).run(id, userId, workspaceId)
    if (Number(result.changes) > 0) {
      this.emit({ type: 'deleted', logId: id })
      return 'deleted'
    }

    return this.getById(id, userId, workspaceId) ? 'active' : 'not_found'
  }

  close(): void {
    if (!this.db) {
      return
    }
    this.db.close()
    this.db = undefined
  }

  subscribe(callback: (event: TaskLogStoreEvent) => void): () => void {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  private emitChanged(log: TaskLog): TaskLog {
    this.emit({ type: 'changed', log })
    return log
  }

  private emit(event: TaskLogStoreEvent): void {
    for (const callback of this.subscribers) {
      try {
        callback(event)
      }
      catch {
        // Store writes must not fail because an observer is unavailable.
      }
    }
  }

  private getRequired(id: string): TaskLog {
    const row = this.getById(id)
    if (!row) {
      throw new Error(`Task log ${id} not found`)
    }
    return row
  }
}

export const taskLogStore = new TaskLogStore()

export function initializeTasksDatabase(): void {
  taskLogStore.initialize()
}

export function closeTasksDatabase(): void {
  taskLogStore.close()
}
