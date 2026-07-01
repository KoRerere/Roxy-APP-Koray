/**
 * 定时任务持久化层（schedules.db）。
 *
 * 结构镜像 src/database/conversations/index.ts：node:sqlite DatabaseSync + WAL +
 * 按 user_id/workspace_id 作用域 + 模块加载时 initDatabase() + 导出 closeSchedulesDatabase()。
 *
 * 两张表：
 * - schedules：定时任务定义（cron、prompt、enabled 等）
 * - schedule_runs：每次触发的运行历史（status、output_excerpt、error、duration_ms）
 *
 * 定时任务的"执行"不在此处——此处只负责调度元数据与运行历史的 CRUD。
 * 执行由 src/schedules/runner.ts（临时 agent）+ src/schedules/engine.ts（node-cron）完成。
 */

import type {
  CreateScheduleInput,
  ScheduleRecord,
  ScheduleRunCreateInput,
  ScheduleRunMarkInput,
  ScheduleRunRecord,
  ScheduleRunStatus,
  UpdateScheduleInput,
} from './types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { env } from '../../config'

// 从环境变量获取基础信息（与 conversations 模块一致）
const userId = env.ROXY_USER_ID
const workspaceId = env.ROXY_WORKSPACE_ID

if (!userId || !workspaceId) {
  throw new Error('Missing required environment variables: ROXY_USER_ID and ROXY_WORKSPACE_ID')
}

const safeUserId: string = userId
const safeWorkspaceId: string = workspaceId

/**
 * 将 SQLite CURRENT_TIMESTAMP 存储的 UTC 字符串（如 '2026-06-30 05:21:00'）
 * 转换为本地时区字符串（如 '2026-06-30 13:21:00'）。
 * 用于在返回给前端/LLM 前做显示转换，避免用户看到 UTC 时间产生困惑。
 * 无法解析则原样返回。与 conversations 模块的 utcToLocal 实现一致。
 */
function utcToLocal(utcStr: string | null | undefined): string | null {
  if (!utcStr)
    return null
  const d = new Date(`${utcStr.replace(' ', 'T')}Z`)
  if (Number.isNaN(d.getTime()))
    return utcStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 数据库初始化
const dbPath = path.join(env.CHECKPOINT_DIR, 'schedules.db')
if (!fs.existsSync(env.CHECKPOINT_DIR)) {
  fs.mkdirSync(env.CHECKPOINT_DIR, { recursive: true })
}
const db = new DatabaseSync(dbPath)

// 启用 WAL 模式以提高并发性能
db.exec('PRAGMA journal_mode = \'WAL\'')
// 开启外键约束，使 schedule_runs 的 ON DELETE CASCADE 生效
db.exec('PRAGMA foreign_keys = ON')

initDatabase()

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      prompt TEXT NOT NULL,
      cron_expr TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      mode TEXT NOT NULL DEFAULT 'simple',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_run_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_schedules_user_workspace ON schedules(user_id, workspace_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);

    CREATE TABLE IF NOT EXISTS schedule_runs (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      output_excerpt TEXT,
      error TEXT,
      duration_ms INTEGER,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule ON schedule_runs(schedule_id, started_at DESC);
  `)
}

// ---------------------------------------------------------------------------
// 预编译语句
// ---------------------------------------------------------------------------

const statements = {
  insertSchedule: db.prepare(`
    INSERT INTO schedules (id, user_id, workspace_id, name, description, prompt, cron_expr, enabled, mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getScheduleById: db.prepare('SELECT * FROM schedules WHERE id = ? AND user_id = ? AND workspace_id = ?'),
  getScheduleByName: db.prepare('SELECT * FROM schedules WHERE user_id = ? AND workspace_id = ? AND name = ? LIMIT 1'),
  listSchedules: db.prepare('SELECT * FROM schedules WHERE user_id = ? AND workspace_id = ? ORDER BY created_at DESC'),
  listEnabledSchedules: db.prepare('SELECT * FROM schedules WHERE user_id = ? AND workspace_id = ? AND enabled = 1'),
  updateScheduleName: db.prepare(`
    UPDATE schedules SET name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),
  updateScheduleFull: db.prepare(`
    UPDATE schedules
    SET name = ?, description = ?, prompt = ?, cron_expr = ?, mode = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),
  setEnabled: db.prepare(`
    UPDATE schedules SET enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),
  touchLastRun: db.prepare(`
    UPDATE schedules SET last_run_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),
  deleteSchedule: db.prepare('DELETE FROM schedules WHERE id = ? AND user_id = ? AND workspace_id = ?'),

  insertRun: db.prepare(`
    INSERT INTO schedule_runs (id, schedule_id, status) VALUES (?, ?, ?)
  `),
  getRunById: db.prepare('SELECT * FROM schedule_runs WHERE id = ?'),
  markRunSuccess: db.prepare(`
    UPDATE schedule_runs SET status = 'success', ended_at = CURRENT_TIMESTAMP, output_excerpt = ?, duration_ms = ? WHERE id = ?
  `),
  markRunFailed: db.prepare(`
    UPDATE schedule_runs SET status = 'failed', ended_at = CURRENT_TIMESTAMP, error = ?, duration_ms = ? WHERE id = ?
  `),
  markRunSkipped: db.prepare(`
    UPDATE schedule_runs SET status = 'skipped', ended_at = CURRENT_TIMESTAMP, error = ? WHERE id = ?
  `),
  listRunsBySchedule: db.prepare(`
    SELECT * FROM schedule_runs WHERE schedule_id = ? ORDER BY started_at DESC, rowid DESC LIMIT ? OFFSET ?
  `),
  getLatestRun: db.prepare(`
    SELECT * FROM schedule_runs WHERE schedule_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1
  `),
}

// ---------------------------------------------------------------------------
// 行映射
// ---------------------------------------------------------------------------

function mapScheduleRow(row: any): ScheduleRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    workspace_id: row.workspace_id,
    name: row.name,
    description: row.description ?? null,
    prompt: row.prompt,
    cron_expr: row.cron_expr,
    enabled: Number(row.enabled),
    mode: row.mode,
    created_at: utcToLocal(row.created_at) ?? row.created_at,
    updated_at: utcToLocal(row.updated_at) ?? row.updated_at,
    last_run_at: utcToLocal(row.last_run_at),
  }
}

function mapRunRow(row: any): ScheduleRunRecord {
  return {
    id: row.id,
    schedule_id: row.schedule_id,
    status: row.status as ScheduleRunStatus,
    started_at: utcToLocal(row.started_at) ?? row.started_at,
    ended_at: utcToLocal(row.ended_at),
    output_excerpt: row.output_excerpt ?? null,
    error: row.error ?? null,
    duration_ms: row.duration_ms ?? null,
  }
}

// ---------------------------------------------------------------------------
// ScheduleStore
// ---------------------------------------------------------------------------

export class ScheduleStore {
  static create(input: CreateScheduleInput): ScheduleRecord {
    const id = `sch_${randomUUID()}`
    statements.insertSchedule.run(
      id,
      safeUserId,
      safeWorkspaceId,
      input.name,
      input.description ?? null,
      input.prompt,
      input.cron_expr,
      input.enabled === false ? 0 : 1,
      input.mode ?? 'simple',
    )
    const row = statements.getScheduleById.get(id, safeUserId, safeWorkspaceId)
    if (!row)
      throw new Error('Failed to create schedule record')
    return mapScheduleRow(row)
  }

  static list(): ScheduleRecord[] {
    const rows = statements.listSchedules.all(safeUserId, safeWorkspaceId)
    return (rows as any[]).map(mapScheduleRow)
  }

  static listEnabled(): ScheduleRecord[] {
    const rows = statements.listEnabledSchedules.all(safeUserId, safeWorkspaceId)
    return (rows as any[]).map(mapScheduleRow)
  }

  static getById(id: string): ScheduleRecord | null {
    const row = statements.getScheduleById.get(id, safeUserId, safeWorkspaceId)
    return row ? mapScheduleRow(row as any) : null
  }

  static getByName(name: string): ScheduleRecord | null {
    const row = statements.getScheduleByName.get(safeUserId, safeWorkspaceId, name)
    return row ? mapScheduleRow(row as any) : null
  }

  static update(id: string, patch: UpdateScheduleInput): ScheduleRecord | null {
    // 先读现有记录，仅更新提供的字段
    const existing = statements.getScheduleById.get(id, safeUserId, safeWorkspaceId) as any
    if (!existing)
      return null

    if (patch.enabled !== undefined) {
      statements.setEnabled.run(patch.enabled ? 1 : 0, id, safeUserId, safeWorkspaceId)
    }

    if (patch.name !== undefined || patch.description !== undefined || patch.prompt !== undefined || patch.cron_expr !== undefined || patch.mode !== undefined) {
      statements.updateScheduleFull.run(
        patch.name ?? existing.name,
        patch.description !== undefined ? patch.description : existing.description,
        patch.prompt ?? existing.prompt,
        patch.cron_expr ?? existing.cron_expr,
        patch.mode ?? existing.mode,
        id,
        safeUserId,
        safeWorkspaceId,
      )
    }

    const row = statements.getScheduleById.get(id, safeUserId, safeWorkspaceId)
    return row ? mapScheduleRow(row as any) : null
  }

  static setEnabled(id: string, enabled: boolean): ScheduleRecord | null {
    statements.setEnabled.run(enabled ? 1 : 0, id, safeUserId, safeWorkspaceId)
    const row = statements.getScheduleById.get(id, safeUserId, safeWorkspaceId)
    return row ? mapScheduleRow(row as any) : null
  }

  static touchLastRun(id: string): void {
    statements.touchLastRun.run(id, safeUserId, safeWorkspaceId)
  }

  static delete(id: string): boolean {
    const result = statements.deleteSchedule.run(id, safeUserId, safeWorkspaceId)
    return Number(result.changes) > 0
  }
}

// ---------------------------------------------------------------------------
// ScheduleRunStore
// ---------------------------------------------------------------------------

export class ScheduleRunStore {
  static create(input: ScheduleRunCreateInput): ScheduleRunRecord {
    const id = `schedrun_${randomUUID()}`
    statements.insertRun.run(id, input.schedule_id, input.status)
    const row = statements.getRunById.get(id)
    if (!row)
      throw new Error('Failed to create schedule_run record')
    return mapRunRow(row as any)
  }

  static markSuccess(id: string, input: ScheduleRunMarkInput): void {
    statements.markRunSuccess.run(input.output_excerpt ?? null, input.duration_ms ?? null, id)
  }

  static markFailed(id: string, input: ScheduleRunMarkInput): void {
    statements.markRunFailed.run(input.error ?? null, input.duration_ms ?? null, id)
  }

  static markSkipped(id: string, input: ScheduleRunMarkInput): void {
    statements.markRunSkipped.run(input.error ?? null, id)
  }

  static listBySchedule(scheduleId: string, opts?: { limit?: number, offset?: number }): ScheduleRunRecord[] {
    const limit = opts?.limit ?? 50
    const offset = opts?.offset ?? 0
    const rows = statements.listRunsBySchedule.all(scheduleId, limit, offset)
    return (rows as any[]).map(mapRunRow)
  }

  static getLatest(scheduleId: string): ScheduleRunRecord | null {
    const row = statements.getLatestRun.get(scheduleId)
    return row ? mapRunRow(row as any) : null
  }
}

/**
 * 关闭数据库连接（在应用退出时调用）
 */
export function closeSchedulesDatabase() {
  db.close()
}
