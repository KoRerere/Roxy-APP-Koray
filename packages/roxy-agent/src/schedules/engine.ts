/**
 * 调度引擎：拥有所有 node-cron 定时任务，负责触发、重叠守卫、错误隔离、
 * 启动重载与优雅关闭。
 *
 * 单例 `schedulerEngine`（live-binding，同 mcpManager 模式）。
 *
 * 静态循环说明：chat.ts → scheduleTools → schedulerEngine（本文件）。
 * 因此本文件**不**在顶层 import runner（runner → createChatAgent → scheduleTools → 本文件），
 * 而是在 fire() 内懒加载 `await import('./runner')` 切断循环。
 */

import type { ScheduleRecord } from '@/database/schedules/types'
import type { ScheduledTask } from 'node-cron'
import cron from 'node-cron'
import { ScheduleRunStore, ScheduleStore } from '@/database/schedules'

export interface RegisterResult {
  ok: boolean
  error?: string
}

class SchedulerEngine {
  /** scheduleId → cron 任务 */
  private tasks = new Map<string, ScheduledTask>()
  /** 正在执行的 scheduleId（重叠守卫） */
  private running = new Set<string>()
  private started = false

  /**
   * 启动：从 SQLite 重载所有 enabled schedule 并注册。
   * 幂等。启动失败只 warn，不抛（不阻塞 server 启动）。
   */
  async start(): Promise<void> {
    if (this.started)
      return
    let count = 0
    try {
      const enabled = ScheduleStore.listEnabled()
      for (const s of enabled) {
        const r = this.register(s)
        if (r.ok)
          count++
        else
          console.warn(`[scheduler] skip schedule ${s.id} (${s.name}): ${r.error}`)
      }
      this.started = true
      console.log(`[scheduler] started, registered ${count} enabled schedule(s)`)
    }
    catch (err: any) {
      console.warn('[scheduler] start failed:', err instanceof Error ? err.message : String(err))
    }
  }

  /** 优雅关闭：停止所有 cron 任务。 */
  async stop(): Promise<void> {
    for (const task of this.tasks.values()) {
      try {
        task.stop()
      }
      catch {
        // ignore
      }
    }
    this.tasks.clear()
    this.running.clear()
    this.started = false
    console.log('[scheduler] stopped')
  }

  /**
   * 注册（或替换）某个 schedule 的 cron 任务。用于创建/更新/toggle 时实时同步。
   * - 先 unregister 旧任务
   * - 若 !enabled，仅停止（不调度）
   * - 校验 cron 表达式
   */
  register(schedule: ScheduleRecord): RegisterResult {
    this.unregister(schedule.id)
    if (!schedule.enabled) {
      return { ok: true }
    }
    if (!cron.validate(schedule.cron_expr)) {
      return { ok: false, error: `invalid cron expression: ${schedule.cron_expr}` }
    }
    const task = cron.schedule(schedule.cron_expr, () => {
      // cron 回调不 await；fire 内部自管错误隔离
      this.fire(schedule.id).catch((err) => {
        console.error(`[scheduler] fire() threw unexpectedly for ${schedule.id}:`, err)
      })
    }, { scheduled: true })
    this.tasks.set(schedule.id, task)
    return { ok: true }
  }

  /** 注销某个 schedule 的 cron 任务（停止 + 移除）。 */
  unregister(scheduleId: string): void {
    const task = this.tasks.get(scheduleId)
    if (task) {
      try {
        task.stop()
      }
      catch {
        // ignore
      }
      this.tasks.delete(scheduleId)
    }
  }

  /**
   * cron 触发回调：执行一次定时任务。
   * 自带 try/catch 错误隔离；单次失败不影响后续触发。
   */
  private async fire(scheduleId: string): Promise<void> {
    // 重叠守卫：上一次还没跑完则跳过
    if (this.running.has(scheduleId)) {
      console.warn(`[scheduler] overlapping run skipped for ${scheduleId}`)
      try {
        const skipped = ScheduleRunStore.create({ schedule_id: scheduleId, status: 'skipped' })
        ScheduleRunStore.markSkipped(skipped.id, { error: 'overlapping run skipped' })
      }
      catch (err: any) {
        console.warn(`[scheduler] failed to record skipped run for ${scheduleId}:`, err?.message)
      }
      return
    }

    this.running.add(scheduleId)
    const startedAt = Date.now()
    let runRecord: { id: string } | null = null

    try {
      // defense-in-depth：重读行，缺失或被禁用则不执行
      const schedule = ScheduleStore.getById(scheduleId)
      if (!schedule) {
        console.warn(`[scheduler] schedule ${scheduleId} not found, skip fire`)
        return
      }
      if (!schedule.enabled) {
        console.warn(`[scheduler] schedule ${scheduleId} disabled, skip fire`)
        return
      }

      runRecord = ScheduleRunStore.create({ schedule_id: scheduleId, status: 'running' })
      console.log(`[scheduler] firing schedule ${scheduleId} (${schedule.name}) runId=${runRecord.id}`)

      // 懒加载切断静态循环（engine → runner → createChatAgent → scheduleTools → engine）
      const { runScheduledTurn } = await import('./runner')
      const { output, error } = await runScheduledTurn(schedule)

      const durationMs = Date.now() - startedAt
      if (error) {
        ScheduleRunStore.markFailed(runRecord.id, { error, duration_ms: durationMs })
        console.warn(`[scheduler] run failed scheduleId=${scheduleId} runId=${runRecord.id}: ${error}`)
      }
      else {
        const excerpt = output.length > 2000 ? output.slice(0, 2000) : output
        ScheduleRunStore.markSuccess(runRecord.id, { output_excerpt: excerpt, duration_ms: durationMs })
        console.log(`[scheduler] run success scheduleId=${scheduleId} runId=${runRecord.id} duration=${durationMs}ms`)
      }
    }
    catch (err: any) {
      // runScheduledTurn 永不抛；此处兜底意外异常
      const errMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err)
      console.error(`[scheduler] fire() unexpected error for ${scheduleId}:`, errMsg)
      if (runRecord) {
        try {
          ScheduleRunStore.markFailed(runRecord.id, { error: errMsg, duration_ms: Date.now() - startedAt })
        }
        catch {
          // ignore
        }
      }
    }
    finally {
      try {
        ScheduleStore.touchLastRun(scheduleId)
      }
      catch {
        // ignore
      }
      this.running.delete(scheduleId)
    }
  }
}

export const schedulerEngine = new SchedulerEngine()
