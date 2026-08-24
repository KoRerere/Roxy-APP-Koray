import type { StartedTaskRun } from './runner'
import type { UserTaskDto, UserTaskPage } from '@/api/agentApiClient'
import { agentUserTasksApi } from '@/api/agentApiClient'
import {
  MAX_TIMER_DELAY_MS,
  TASK_SYNC_INTERVAL_MS,
  TASK_TRIGGER_LEEWAY_MS,
} from './constants'
import { taskRunner } from './runner'

type ScheduledTask = UserTaskDto & {
  planType: 'once' | 'cron'
  nextExecuteAt: string
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
  listTasks: (limit: number, offset: number) => Promise<UserTaskPage>
  setEnabled: (taskId: number, enabled: boolean) => Promise<UserTaskDto>
  startTask: (taskId: number, trigger: { triggerType: 'once' | 'cron', scheduledAt: string }) => Promise<StartedTaskRun>
  recordMissed: (taskId: number, trigger: 'once' | 'cron', scheduledAt: string) => Promise<unknown>
  stopTasks: () => Promise<void>
  now: () => number
}

const defaultDeps: TaskSchedulerDeps = {
  listTasks: (limit, offset) => agentUserTasksApi.list({ limit, offset }),
  setEnabled: (taskId, enabled) => agentUserTasksApi.setEnabled(taskId, enabled),
  startTask: (taskId, trigger) => taskRunner.start(taskId, trigger),
  recordMissed: (taskId, trigger, scheduledAt) => taskRunner.recordMissed(taskId, trigger, scheduledAt),
  stopTasks: () => taskRunner.stopAll(),
  now: () => Date.now(),
}

function scheduleSignature(task: UserTaskDto): string {
  return JSON.stringify({
    enabled: task.enabled,
    planType: task.planType,
    cron: task.cron,
    timezone: task.timezone,
    executeAt: task.executeAt,
    nextExecuteAt: task.nextExecuteAt,
  })
}

function schedulable(task: UserTaskDto, now: number): task is ScheduledTask {
  if (!task.enabled || task.planType === 'manual' || !task.nextExecuteAt) {
    return false
  }

  const timestamp = Date.parse(task.nextExecuteAt)
  return Number.isFinite(timestamp) && timestamp > now
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
    const desired = new Map(tasks.filter(task =>
      schedulable(task, now)).map(task => [task.id, task]))
    for (const taskId of this.entries.keys()) {
      if (!desired.has(taskId)) {
        this.unregister(taskId)
      }
    }

    for (const task of desired.values()) {
      const signature = scheduleSignature(task)
      const existing = this.entries.get(task.id)
      if (existing?.signature === signature) {
        continue
      }

      this.unregister(task.id)
      const entry: ScheduledEntry = {
        task,
        scheduledAt: task.nextExecuteAt,
        signature,
      }
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

    this.entries.delete(entry.task.id)
    const lateness = this.deps.now() - Date.parse(entry.scheduledAt)
    let disableOnceAfterCompletion = false

    try {
      if (lateness > TASK_TRIGGER_LEEWAY_MS) {
        await this.deps.recordMissed(entry.task.id, entry.task.planType, entry.scheduledAt)
      }
      else {
        const started = await this.deps.startTask(entry.task.id, {
          triggerType: entry.task.planType,
          scheduledAt: entry.scheduledAt,
        })
        if (entry.task.planType === 'once') {
          disableOnceAfterCompletion = true
          void started.completion
            .catch(error =>
              console.error(`[task-scheduler] Task completion failed taskId=${entry.task.id}:`, error))
            .finally(async () => {
              await this.disableOnce(entry.task.id)
              if (!this.stopping) {
                await this.sync().catch(error =>
                  console.warn(`[task-scheduler] Failed to resync after once taskId=${entry.task.id}:`, error))
              }
            })
        }
        else {
          void started.completion.catch(error =>
            console.error(`[task-scheduler] Task completion failed taskId=${entry.task.id}:`, error))
        }
      }
    }
    catch (error) {
      console.error(`[task-scheduler] Failed to trigger taskId=${entry.task.id}:`, error)
    }
    finally {
      if (entry.task.planType === 'once' && !disableOnceAfterCompletion) {
        await this.disableOnce(entry.task.id)
      }
      if (!this.stopping) {
        await this.sync().catch(error =>
          console.warn(`[task-scheduler] Failed to resync after taskId=${entry.task.id}:`, error))
      }
    }
  }

  private async disableOnce(taskId: number): Promise<void> {
    try {
      await this.deps.setEnabled(taskId, false)
    }
    catch (error) {
      console.warn(`[task-scheduler] Failed to disable once taskId=${taskId}:`, error)
    }
  }
}

export const taskScheduler = new TaskScheduler()
