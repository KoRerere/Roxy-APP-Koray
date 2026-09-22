import type { StartedTaskRun } from './runner'
import type { UserTaskDto, UserTaskPage } from '@/api/agentApiClient'
import { CronExpressionParser } from 'cron-parser'
import { agentUserTasksApi } from '@/api/agentApiClient'
import { env } from '@/config'
import {
  MAX_TIMER_DELAY_MS,
  TASK_SYNC_INTERVAL_MS,
  TASK_TRIGGER_LEEWAY_MS,
} from './constants'
import { taskRunner } from './runner'

type ScheduledTask = UserTaskDto & {
  planType: 'once' | 'cron'
}

interface ScheduledEntry {
  task: ScheduledTask
  scheduledAt: string
  signature: string
  timer?: NodeJS.Timeout
}

export interface TaskSyncResult {
  registeredCount: number
  syncedAt: string
}

export interface TaskSchedulerDeps {
  userId: string | undefined
  listTasks: (limit: number, offset: number) => Promise<UserTaskPage>
  startTask: (taskId: number, trigger: { triggerType: 'once' | 'cron', scheduledAt: string }) => Promise<StartedTaskRun>
  recordMissed: (taskId: number, trigger: 'once' | 'cron', scheduledAt: string) => Promise<unknown>
  stopTasks: () => Promise<void>
  now: () => number
}

const defaultDeps: TaskSchedulerDeps = {
  userId: env.ROXY_USER_ID,
  listTasks: (limit, offset) => agentUserTasksApi.list({ limit, offset }),
  startTask: (taskId, trigger) => taskRunner.start(taskId, trigger),
  recordMissed: (taskId, trigger, scheduledAt) => taskRunner.recordMissed(taskId, trigger, scheduledAt),
  stopTasks: () => taskRunner.stopAll(),
  now: () => Date.now(),
}

function scheduleDefinitionSignature(task: UserTaskDto): string {
  return JSON.stringify({
    enabled: task.enabled,
    planType: task.planType,
    cron: task.cron,
    timezone: task.timezone,
    executeAt: task.executeAt,
  })
}

/**
 * 服务器保存计划定义，本地只根据计划和当前时钟计算；不读取服务器 nextExecuteAt。
 */
function nextOccurrence(task: ScheduledTask, after: number): string | null {
  if (task.planType === 'once') {
    const timestamp = task.executeAt ? Date.parse(task.executeAt) : Number.NaN
    return Number.isFinite(timestamp) && timestamp > after ? new Date(timestamp).toISOString() : null
  }
  if (!task.cron?.trim()) {
    return null
  }
  try {
    return CronExpressionParser.parse(task.cron, {
      currentDate: after,
      tz: task.timezone || 'UTC',
      hashSeed: `${task.workspaceId}:${task.id}`,
    }).next().toISOString()
  }
  catch (error) {
    console.warn(`[task-scheduler] Invalid schedule taskId=${task.id}:`, error)
    return null
  }
}

function schedulable(task: UserTaskDto, userId: string | undefined): task is ScheduledTask {
  return !!userId && task.creatorUserId === userId && task.enabled
    && (task.planType === 'once' || task.planType === 'cron')
}

export class TaskScheduler {
  private readonly entries = new Map<number, ScheduledEntry>()
  private syncTimer?: NodeJS.Timeout
  private syncPromise?: Promise<TaskSyncResult>
  private started = false
  private stopping = false

  constructor(private readonly deps: TaskSchedulerDeps = defaultDeps) {}

  async start(): Promise<void> {
    if (this.started) {
      return
    }

    this.started = true
    this.stopping = false
    try {
      const result = await this.sync()
      console.log(`[task-scheduler] started, registered ${result.registeredCount} task(s)`)
    }
    catch (error) {
      console.warn('[task-scheduler] Initial sync failed:', error)
    }
    this.syncTimer = setInterval(() => {
      void this.sync().catch(error => console.warn('[task-scheduler] Background sync failed:', error))
    }, TASK_SYNC_INTERVAL_MS)
    this.syncTimer.unref()
  }

  sync(): Promise<TaskSyncResult> {
    if (this.syncPromise) {
      return this.syncPromise
    }

    const promise = this.performSync().finally(() => {
      if (this.syncPromise === promise) {
        this.syncPromise = undefined
      }
    })
    this.syncPromise = promise
    return promise
  }

  async stop(): Promise<void> {
    this.stopping = true
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }
    this.syncTimer = undefined
    for (const entry of this.entries.values()) {
      if (entry.timer) {
        clearTimeout(entry.timer)
      }
    }
    this.entries.clear()
    await this.deps.stopTasks()
    this.started = false
    console.log('[task-scheduler] stopped')
  }

  getRegisteredCount(): number {
    return this.entries.size
  }

  private async performSync(): Promise<TaskSyncResult> {
    const tasks: UserTaskDto[] = []
    const limit = 200

    let offset = 0
    while (true) {
      const page = await this.deps.listTasks(limit, offset)
      tasks.push(...page.items)
      offset += page.items.length

      if (page.items.length === 0 || offset >= page.total) {
        break
      }
    }

    if (this.stopping) {
      return {
        registeredCount: this.entries.size,
        syncedAt: new Date(this.deps.now()).toISOString(),
      }
    }

    const now = this.deps.now()
    const desired = new Map<number, ScheduledTask>()
    for (const task of tasks) {
      const existing = this.entries.get(task.id)
      const enabledTask = { ...task, enabled: true }
      // 旧客户端领取单次租约会自动关闭计划。已在本机到点的同次计划归本地 timer 处理，
      // 不因云端 enabled 变化而撤销；到点前暂停、修改计划或删除任务仍正常生效。
      if (!task.enabled && existing?.task.planType === 'once'
        && Date.parse(existing.scheduledAt) <= now
        && schedulable(enabledTask, this.deps.userId)
        && existing.signature === scheduleDefinitionSignature(enabledTask)) {
        desired.set(task.id, enabledTask)
        continue
      }
      if (schedulable(task, this.deps.userId)) {
        desired.set(task.id, task)
      }
    }
    for (const taskId of this.entries.keys()) {
      if (!desired.has(taskId)) {
        this.unregister(taskId)
      }
    }

    for (const task of desired.values()) {
      const signature = scheduleDefinitionSignature(task)
      const existing = this.entries.get(task.id)
      // 同步只处理定义变化；保留已到期的 timer，让迟到检查记录错过的计划。
      if (existing?.signature === signature) {
        continue
      }

      this.unregister(task.id)
      const scheduledAt = nextOccurrence(task, now)
      if (!scheduledAt) {
        continue
      }
      const entry: ScheduledEntry = { task, scheduledAt, signature }
      this.entries.set(task.id, entry)
      this.arm(entry)
    }

    return {
      registeredCount: this.entries.size,
      syncedAt: new Date(now).toISOString(),
    }
  }

  private unregister(taskId: number): void {
    const entry = this.entries.get(taskId)
    if (entry?.timer) {
      clearTimeout(entry.timer)
    }
    this.entries.delete(taskId)
  }

  private arm(entry: ScheduledEntry): void {
    const remaining = Date.parse(entry.scheduledAt) - this.deps.now()
    if (remaining > MAX_TIMER_DELAY_MS) {
      entry.timer = setTimeout(() => this.arm(entry), MAX_TIMER_DELAY_MS)
      entry.timer.unref()
      return
    }

    entry.timer = setTimeout(() => void this.fire(entry), Math.max(remaining, 0))
    entry.timer.unref()
  }

  private async fire(entry: ScheduledEntry): Promise<void> {
    if (this.stopping || this.entries.get(entry.task.id) !== entry) {
      return
    }

    // 系统时间回拨时重新等待，不能提前执行。
    if (Date.parse(entry.scheduledAt) > this.deps.now()) {
      this.arm(entry)
      return
    }

    this.entries.delete(entry.task.id)
    // 先在本地续排，避免同步失败、执行准备缓慢或失败阻断后续计划。
    if (entry.task.planType === 'cron') {
      const scheduledAt = nextOccurrence(entry.task, this.deps.now())
      if (scheduledAt) {
        const nextEntry: ScheduledEntry = { ...entry, scheduledAt, timer: undefined }
        this.entries.set(entry.task.id, nextEntry)
        this.arm(nextEntry)
      }
    }
    const lateness = this.deps.now() - Date.parse(entry.scheduledAt)

    try {
      if (lateness > TASK_TRIGGER_LEEWAY_MS) {
        await this.deps.recordMissed(entry.task.id, entry.task.planType, entry.scheduledAt)
      }
      else {
        const started = await this.deps.startTask(entry.task.id, {
          triggerType: entry.task.planType,
          scheduledAt: entry.scheduledAt,
        })
        void started.completion.catch(error =>
          console.error(`[task-scheduler] Task completion failed taskId=${entry.task.id}:`, error))
      }
    }
    catch (error) {
      console.error(`[task-scheduler] Failed to trigger taskId=${entry.task.id}:`, error)
    }
  }
}

export const taskScheduler = new TaskScheduler()
