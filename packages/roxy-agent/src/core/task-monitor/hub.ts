import type {
  TaskMonitorBrowserAttachInput,
  TaskMonitorBrowserEvent,
  TaskMonitorBrowserEventInput,
  TaskMonitorBrowserFinishedInput,
  TaskMonitorIpcEvent,
  TaskMonitorSnapshot,
  TaskMonitorTask,
  TaskMonitorTaskInput,
} from './types'
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'
import { API } from '@/api'
import { env } from '@/config'

const MAX_BROWSER_EVENTS = 12
const BROWSER_DETAIL_PAGE_SIZE = 100
const BROWSER_DETAIL_RETRY_DELAY_MS = 10_000
const BROWSER_DETAIL_INVALIDATING_TOOLS = [
  'roxy_delete_browsers',
  'roxy_update_browser',
  'roxy_browser_update',
  'roxy_browser_delete',
  'roxy_browser_create',
]

type BrowserDetailRow = UserGetWindowInfoListListData['data']['rows'][number]

interface BrowserPlatformInfo {
  platformUrl?: string
  platformUserName?: string
  platformIcon?: string
}

interface BrowserWindowDetail {
  windowName?: string
  windowSortNum?: number
  platformUrl?: string
  platformUserName?: string
  platformIcon?: string
  countryCode?: string
}

interface InternalTask extends TaskMonitorTask {
  lastBrowserId?: string
}

const browserDetailCache = new Map<string, BrowserWindowDetail>()
const browserDetailRetryAfter = new Map<string, number>()
const pendingBrowserDetailDirIds = new Set<string>()
const cacheInvalidationEventIds = new Map<string, number>()
const CACHE_INVALIDATION_TTL_MS = 10 * 60 * 1000

function sweepExpiredInvalidationIds(now: number): void {
  for (const [key, createdAt] of cacheInvalidationEventIds) {
    if (now - createdAt > CACHE_INVALIDATION_TTL_MS) {
      cacheInvalidationEventIds.delete(key)
    }
  }
}

function createEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function truncateResult(value: string | undefined, max = 1000): string | undefined {
  if (!value)
    return value
  return value.length > max ? `${value.slice(0, max)}...[truncated]` : value
}

function canFetchBrowserDetails(): boolean {
  return Boolean(env.ROXY_SERVER_URL && env.ROXY_USER_TOKEN)
}

function readFirstPlatform(row: BrowserDetailRow): BrowserPlatformInfo | undefined {
  if (!Array.isArray(row.windowPlatformList))
    return undefined

  return row.windowPlatformList.find(item => item && typeof item === 'object') as BrowserPlatformInfo | undefined
}

function normalizeCountryCode(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : undefined
}

function normalizeBrowserDetail(row: BrowserDetailRow): BrowserWindowDetail {
  const platform = readFirstPlatform(row)
  return {
    windowName: row.windowName,
    windowSortNum: row.windowSortNum,
    platformUrl: platform?.platformUrl || row.platformUrl || row.platformUrlList?.[0],
    platformUserName: platform?.platformUserName || row.platformUserName,
    platformIcon: platform?.platformIcon,
    countryCode: normalizeCountryCode(row.lastCountry) || normalizeCountryCode(row.country),
  }
}

function collectDirIds(value: unknown, result = new Set<string>(), depth = 0): Set<string> {
  if (depth > 4 || value == null)
    return result

  if (typeof value === 'string' || typeof value === 'number') {
    String(value)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .forEach(item => result.add(item))
    return result
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectDirIds(item, result, depth + 1))
    return result
  }

  if (typeof value !== 'object')
    return result

  const record = value as Record<string, unknown>
  for (const key of ['dirId', 'dir_id', 'dirIds', 'dir_ids', 'browserId', 'browser_id', 'profileId', 'profile_id']) {
    if (key in record)
      collectDirIds(record[key], result, depth + 1)
  }

  for (const key of ['browser', 'browsers', 'window', 'windows', 'profile', 'profiles']) {
    if (key in record)
      collectDirIds(record[key], result, depth + 1)
  }

  return result
}

function clearBrowserDetailFields(browser: TaskMonitorTask['browsers'][number]): void {
  delete browser.windowName
  delete browser.windowSortNum
  delete browser.platformUrl
  delete browser.platformUserName
  delete browser.platformIcon
  delete browser.countryCode
}

function cloneTask(task: InternalTask): TaskMonitorTask {
  return {
    id: task.id,
    title: task.title,
    sourceType: task.sourceType,
    status: task.status,
    conversationId: task.conversationId,
    runId: task.runId,
    startedAt: task.startedAt,
    updatedAt: task.updatedAt,
    browsers: task.browsers
      .map(browser => ({
        ...browser,
        events: [...browser.events],
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt),
  }
}

class TaskMonitorHub {
  private readonly tasks = new Map<string, InternalTask>()
  private readonly subscribers = new Set<(snapshot: TaskMonitorSnapshot) => void>()

  private mergeCachedBrowserDetails(): void {
    for (const task of this.tasks.values()) {
      for (const browser of task.browsers) {
        if (!browser.dirId)
          continue

        const detail = browserDetailCache.get(browser.dirId)
        if (!detail)
          continue

        Object.assign(browser, detail)
      }
    }
  }

  private invalidateBrowserDetailCache(event: TaskMonitorBrowserEventInput, browserDirId?: string): void {
    const now = Date.now()
    sweepExpiredInvalidationIds(now)
    const eventKey = `${event.taskId}:${event.browserId ?? ''}:${event.toolName}:${event.stage}:${event.timestamp ?? ''}`
    if (cacheInvalidationEventIds.has(eventKey))
      return

    const toolName = event.toolName.toLowerCase()
    if (!BROWSER_DETAIL_INVALIDATING_TOOLS.some(name => toolName.includes(name)))
      return

    cacheInvalidationEventIds.set(eventKey, now)
    const dirIds = collectDirIds(event.input)
    if (browserDirId)
      dirIds.add(browserDirId)

    if (dirIds.size === 0) {
      browserDetailCache.clear()
      for (const task of this.tasks.values())
        task.browsers.forEach(clearBrowserDetailFields)
      return
    }

    for (const dirId of dirIds) {
      browserDetailCache.delete(dirId)
      for (const task of this.tasks.values())
        task.browsers.filter(browser => browser.dirId === dirId).forEach(clearBrowserDetailFields)
    }
  }

  private ensureBrowserDetails(dirIds: Array<string | undefined>): void {
    if (!canFetchBrowserDetails())
      return

    const now = Date.now()
    const missingDirIds = Array.from(new Set(dirIds.filter(Boolean) as string[]))
      .filter(dirId =>
        !browserDetailCache.has(dirId)
        && !pendingBrowserDetailDirIds.has(dirId)
        && (browserDetailRetryAfter.get(dirId) ?? 0) <= now)

    if (missingDirIds.length === 0)
      return

    missingDirIds.forEach(dirId => pendingBrowserDetailDirIds.add(dirId))

    void (async () => {
      const unresolvedDirIds = new Set(missingDirIds)
      try {
        let pageIndex = 1
        let fetchedCount = 0

        while (unresolvedDirIds.size > 0) {
          const response = await API.window.userGetWindowInfoListList({
            page_index: pageIndex,
            page_size: BROWSER_DETAIL_PAGE_SIZE,
            isDelete: 0,
            orderName: 'createTime',
            orderType: 'desc',
          })

          if (response.code !== 0) {
            throw new Error(response.msg || 'Failed to fetch browser details')
          }

          const rows = response.data?.rows ?? []
          for (const row of rows) {
            if (!row.dirId)
              continue

            browserDetailCache.set(row.dirId, normalizeBrowserDetail(row))
            browserDetailRetryAfter.delete(row.dirId)
            unresolvedDirIds.delete(row.dirId)
          }

          fetchedCount += rows.length
          const total = response.data?.total ?? fetchedCount
          if (rows.length === 0 || fetchedCount >= total)
            break

          pageIndex++
        }

        const retryAfter = Date.now() + BROWSER_DETAIL_RETRY_DELAY_MS
        unresolvedDirIds.forEach(dirId => browserDetailRetryAfter.set(dirId, retryAfter))
        this.mergeCachedBrowserDetails()
        this.broadcast()
      }
      catch (error) {
        console.warn('[task-monitor] browser detail fetch failed', {
          dirIds: missingDirIds,
          error: error instanceof Error ? error.message : String(error),
        })
        const retryAfter = Date.now() + BROWSER_DETAIL_RETRY_DELAY_MS
        missingDirIds.forEach(dirId => browserDetailRetryAfter.set(dirId, retryAfter))
      }
      finally {
        missingDirIds.forEach(dirId => pendingBrowserDetailDirIds.delete(dirId))
      }
    })()
  }

  startTask(input: TaskMonitorTaskInput): void {
    const now = Date.now()
    const existing = this.tasks.get(input.taskId)
    if (existing) {
      existing.title = input.title || existing.title
      existing.sourceType = input.sourceType
      existing.conversationId = input.conversationId ?? existing.conversationId
      existing.runId = input.runId ?? existing.runId
      existing.updatedAt = now
      this.broadcast()
      return
    }

    this.tasks.set(input.taskId, {
      id: input.taskId,
      title: input.title || 'Agent task',
      sourceType: input.sourceType,
      status: 'running',
      conversationId: input.conversationId,
      runId: input.runId,
      startedAt: now,
      updatedAt: now,
      browsers: [],
    })
    this.broadcast()
  }

  finishTask(taskId: string): void {
    if (!this.tasks.delete(taskId)) {
      return
    }
    this.broadcast()
  }

  attachBrowser(input: TaskMonitorBrowserAttachInput): void {
    const task = this.tasks.get(input.taskId)
    if (!task) {
      return
    }

    const now = Date.now()
    const existing = task.browsers.find(browser => browser.id === input.browserId)
    if (existing) {
      existing.dirId = input.dirId ?? existing.dirId
      existing.label = input.label ?? existing.label
      existing.ws = input.ws ?? existing.ws
      existing.browserType = input.browserType ?? existing.browserType
      existing.updatedAt = now
    }
    else {
      task.browsers.push({
        id: input.browserId,
        dirId: input.dirId,
        label: input.label ?? input.dirId ?? input.browserId,
        ws: input.ws,
        browserType: input.browserType,
        startedAt: now,
        updatedAt: now,
        events: [],
      })
    }

    task.lastBrowserId = input.browserId
    task.updatedAt = now
    const attachedBrowser = task.browsers.find(browser => browser.id === input.browserId)
    this.mergeCachedBrowserDetails()
    this.ensureBrowserDetails([attachedBrowser?.dirId])
    this.broadcast()
  }

  recordBrowserEvent(input: TaskMonitorBrowserEventInput): void {
    const task = this.tasks.get(input.taskId)
    if (!task) {
      return
    }

    const browserId = input.browserId ?? task.lastBrowserId
    if (!browserId) {
      return
    }

    let browser = task.browsers.find(candidate => candidate.id === browserId)
    const now = input.timestamp ?? Date.now()
    if (!browser) {
      browser = {
        id: browserId,
        dirId: input.dirId,
        label: input.dirId ?? browserId,
        startedAt: now,
        updatedAt: now,
        events: [],
      }
      task.browsers.push(browser)
    }

    const event: TaskMonitorBrowserEvent = {
      id: createEventId(),
      stage: input.stage,
      toolName: input.toolName,
      input: input.input,
      result: truncateResult(input.result),
      success: input.success,
      errorMessage: input.errorMessage,
      durationMs: input.durationMs,
      timestamp: now,
      workerId: input.workerId,
      conversationId: input.conversationId,
    }

    browser.events.push(event)
    if (browser.events.length > MAX_BROWSER_EVENTS)
      browser.events.splice(0, browser.events.length - MAX_BROWSER_EVENTS)

    browser.dirId = input.dirId ?? browser.dirId
    browser.updatedAt = now
    task.lastBrowserId = browserId
    task.updatedAt = now
    this.invalidateBrowserDetailCache(input, browser.dirId)
    this.mergeCachedBrowserDetails()
    this.ensureBrowserDetails([browser.dirId])
    this.broadcast()
  }

  finishBrowser(input: TaskMonitorBrowserFinishedInput): void {
    const task = this.tasks.get(input.taskId)
    if (!task) {
      return
    }

    const browserIndex = task.browsers.findIndex((browser) => {
      if (input.browserId && browser.id === input.browserId) {
        return true
      }
      return Boolean(input.dirId && browser.dirId === input.dirId)
    })
    if (browserIndex < 0) {
      return
    }

    task.browsers.splice(browserIndex, 1)
    task.lastBrowserId = task.browsers.at(-1)?.id
    task.updatedAt = Date.now()
    this.broadcast()
  }

  applyEvent(event: TaskMonitorIpcEvent): void {
    if (event.type === 'task_started') {
      this.startTask(event.data)
    }
    else if (event.type === 'task_finished') {
      this.finishTask(event.data.taskId)
    }
    else if (event.type === 'browser_attached') {
      this.attachBrowser(event.data)
    }
    else if (event.type === 'browser_event') {
      this.recordBrowserEvent(event.data)
    }
    else if (event.type === 'browser_finished') {
      this.finishBrowser(event.data)
    }
  }

  getSnapshot(): TaskMonitorSnapshot {
    const tasks = Array.from(this.tasks.values())
      .filter(task => task.browsers.length > 0)
      .map(cloneTask)
      .sort((a, b) => b.updatedAt - a.updatedAt)

    return {
      type: 'snapshot',
      data: {
        generatedAt: Date.now(),
        tasks,
      },
    }
  }

  subscribe(callback: (snapshot: TaskMonitorSnapshot) => void): () => void {
    this.subscribers.add(callback)
    callback(this.getSnapshot())
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /** 当前跟踪的任务数（资源监控用） */
  get taskCount(): number {
    return this.tasks.size
  }

  /** 浏览器详情失效缓存条目数（资源监控用，观察是否单调增长） */
  get invalidationCacheSize(): number {
    return cacheInvalidationEventIds.size
  }

  clear(): void {
    this.tasks.clear()
    browserDetailCache.clear()
    browserDetailRetryAfter.clear()
    pendingBrowserDetailDirIds.clear()
    cacheInvalidationEventIds.clear()
    this.broadcast()
  }

  private broadcast(): void {
    const snapshot = this.getSnapshot()
    for (const callback of this.subscribers) {
      try {
        callback(snapshot)
      }
      catch {
        // Subscriber already handles its own lifecycle.
      }
    }
  }
}

export const taskMonitorHub = new TaskMonitorHub()
