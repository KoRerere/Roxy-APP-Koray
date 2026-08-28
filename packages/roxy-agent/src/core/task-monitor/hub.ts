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
import type {
  AgentProfileMonitorProfile,
  AgentProfileMonitorSnapshot,
} from '@roxy/shared/channel'
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

interface InternalTask {
  id: string
  title: string
  sourceType: TaskMonitorTask['sourceType']
  conversationId?: string
  runId?: string
  startedAt: number
  updatedAt: number
}

type ProfileSession = TaskMonitorTask['browsers'][number]

interface InternalProfile extends ProfileSession {
  taskId: string
  lastEventAt?: number
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
  if (!value) {
    return value
  }
  return value.length > max ? `${value.slice(0, max)}...[truncated]` : value
}

function canFetchBrowserDetails(): boolean {
  return Boolean(env.ROXY_SERVER_URL && env.ROXY_USER_TOKEN)
}

function readFirstPlatform(row: BrowserDetailRow): BrowserPlatformInfo | undefined {
  if (!Array.isArray(row.windowPlatformList)) {
    return undefined
  }

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
  if (depth > 4 || value == null) {
    return result
  }

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

  if (typeof value !== 'object') {
    return result
  }

  const record = value as Record<string, unknown>
  for (const key of ['dirId', 'dir_id', 'dirIds', 'dir_ids', 'browserId', 'browser_id', 'profileId', 'profile_id']) {
    if (key in record) {
      collectDirIds(record[key], result, depth + 1)
    }
  }

  for (const key of ['browser', 'browsers', 'window', 'windows', 'profile', 'profiles']) {
    if (key in record) {
      collectDirIds(record[key], result, depth + 1)
    }
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

/**
 * Frontend browser monitor. The authoritative state is indexed by controlled
 * profile sessions, while task records only contain conversation metadata.
 * This mirrors the runtime profile scheduler and prevents browser lifecycle
 * updates from mutating an unrelated task's browser list.
 */
export class ProfileMonitorHub {
  private readonly tasks = new Map<string, InternalTask>()
  private readonly profiles = new Map<string, InternalProfile>()
  private readonly lastProfileByTask = new Map<string, string>()
  private readonly subscribers = new Set<(snapshot: TaskMonitorSnapshot) => void>()
  private readonly openProfiles = new Map<string, AgentProfileMonitorProfile>()
  private readonly profileSubscribers = new Set<(snapshot: AgentProfileMonitorSnapshot) => void>()

  private profileKey(taskId: string, browserId: string): string {
    return `${taskId}:${browserId}`
  }

  private profilesForTask(taskId: string): InternalProfile[] {
    return [...this.profiles.values()].filter(profile => profile.taskId === taskId)
  }

  private mergeCachedBrowserDetails(): void {
    for (const task of this.tasks.values()) {
      for (const browser of this.profilesForTask(task.id)) {
        if (!browser.dirId) {
          continue
        }

        const detail = browserDetailCache.get(browser.dirId)
        if (!detail) {
          continue
        }

        Object.assign(browser, detail)
      }
    }
    for (const profile of this.openProfiles.values()) {
      const detail = browserDetailCache.get(profile.dirId)
      if (detail) Object.assign(profile, detail)
    }
  }

  private invalidateBrowserDetailCache(event: TaskMonitorBrowserEventInput, browserDirId?: string): void {
    const now = Date.now()
    sweepExpiredInvalidationIds(now)
    const eventKey = `${event.taskId}:${event.browserId ?? ''}:${event.toolName}:${event.stage}:${event.timestamp ?? ''}`
    if (cacheInvalidationEventIds.has(eventKey)) {
      return
    }

    const toolName = event.toolName.toLowerCase()
    if (!BROWSER_DETAIL_INVALIDATING_TOOLS.some(name => toolName.includes(name))) {
      return
    }

    cacheInvalidationEventIds.set(eventKey, now)
    const dirIds = collectDirIds(event.input)
    if (browserDirId) {
      dirIds.add(browserDirId)
    }

    if (dirIds.size === 0) {
      browserDetailCache.clear()
      for (const profile of this.profiles.values()) {
        clearBrowserDetailFields(profile)
      }
      return
    }

    for (const dirId of dirIds) {
      browserDetailCache.delete(dirId)
      for (const profile of this.profiles.values()) {
        if (profile.dirId === dirId) {
          clearBrowserDetailFields(profile)
        }
      }
    }
  }

  private ensureBrowserDetails(dirIds: Array<string | undefined>): void {
    if (!canFetchBrowserDetails()) {
      return
    }

    const now = Date.now()
    const missingDirIds = Array.from(new Set(dirIds.filter(Boolean) as string[]))
      .filter(dirId =>
        !browserDetailCache.has(dirId)
        && !pendingBrowserDetailDirIds.has(dirId)
        && (browserDetailRetryAfter.get(dirId) ?? 0) <= now)

    if (missingDirIds.length === 0) {
      return
    }

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
            if (!row.dirId) {
              continue
            }

            browserDetailCache.set(row.dirId, normalizeBrowserDetail(row))
            browserDetailRetryAfter.delete(row.dirId)
            unresolvedDirIds.delete(row.dirId)
          }

          fetchedCount += rows.length
          const total = response.data?.total ?? fetchedCount
          if (rows.length === 0 || fetchedCount >= total) {
            break
          }

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
      conversationId: input.conversationId,
      runId: input.runId,
      startedAt: now,
      updatedAt: now,
    })
    this.broadcast()
  }

  finishTask(taskId: string): void {
    const now = Date.now()
    for (const profile of this.openProfiles.values()) {
      if (profile.owner?.taskId === taskId) {
        profile.status = 'idle'
        profile.owner = undefined
        profile.idleSince = now
        profile.updatedAt = now
      }
    }
    this.tasks.delete(taskId)
    this.lastProfileByTask.delete(taskId)
    for (const [key, profile] of this.profiles) {
      if (profile.taskId === taskId) {
        this.profiles.delete(key)
      }
    }
    this.broadcast()
  }

  attachBrowser(input: TaskMonitorBrowserAttachInput): void {
    const task = this.tasks.get(input.taskId)
    if (!task) {
      return
    }

    const now = Date.now()
    const key = this.profileKey(input.taskId, input.browserId)
    const existing = this.profiles.get(key)
    if (existing) {
      existing.dirId = input.dirId ?? existing.dirId
      existing.label = input.label ?? existing.label
      existing.ws = input.ws ?? existing.ws
      existing.browserType = input.browserType ?? existing.browserType
      existing.updatedAt = now
    }
    else {
      this.profiles.set(key, {
        taskId: input.taskId,
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

    task.updatedAt = now
    this.lastProfileByTask.set(input.taskId, input.browserId)
    const attachedBrowser = this.profiles.get(key)
    const dirId = input.dirId
    if (!dirId) {
      this.mergeCachedBrowserDetails()
      this.broadcast()
      return
    }
    const inventory = this.openProfiles.get(dirId)
    this.openProfiles.set(dirId, {
      dirId,
      status: 'running',
      endpoint: input.ws ?? inventory?.endpoint,
      browserType: input.browserType ?? inventory?.browserType,
      connectedAt: inventory?.connectedAt ?? now,
      updatedAt: now,
      owner: {
        taskId: task.id,
        title: task.title,
        sourceType: task.sourceType,
        conversationId: task.conversationId,
        runId: task.runId,
        workerId: input.workerId,
        startedAt: task.startedAt,
      },
      events: inventory?.events ?? [],
      ...browserDetailCache.get(dirId),
    })
    this.mergeCachedBrowserDetails()
    this.ensureBrowserDetails([attachedBrowser?.dirId])
    this.broadcast()
  }

  recordBrowserEvent(input: TaskMonitorBrowserEventInput): void {
    const task = this.tasks.get(input.taskId)
    if (!task) {
      return
    }

    const browserId = input.browserId ?? this.lastProfileByTask.get(input.taskId)
    if (!browserId) {
      return
    }

    const key = this.profileKey(input.taskId, browserId)
    let browser = this.profiles.get(key)
    const now = input.timestamp ?? Date.now()
    if (!browser) {
      browser = {
        taskId: input.taskId,
        id: browserId,
        dirId: input.dirId,
        label: input.dirId ?? browserId,
        startedAt: now,
        updatedAt: now,
        events: [],
      }
      this.profiles.set(key, browser)
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
    if (browser.events.length > MAX_BROWSER_EVENTS) {
      browser.events.splice(0, browser.events.length - MAX_BROWSER_EVENTS)
    }

    browser.dirId = input.dirId ?? browser.dirId
    if (browser.dirId) {
      const inventory = this.openProfiles.get(browser.dirId)
      if (inventory) {
        inventory.events.push(event)
        if (inventory.events.length > MAX_BROWSER_EVENTS) {
          inventory.events.splice(0, inventory.events.length - MAX_BROWSER_EVENTS)
        }
        inventory.updatedAt = now
      }
    }
    browser.updatedAt = now
    this.lastProfileByTask.set(input.taskId, browserId)
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

    const profiles = this.profilesForTask(input.taskId)
    const browser = profiles.find(candidate =>
      (input.browserId && candidate.id === input.browserId)
      || Boolean(input.dirId && candidate.dirId === input.dirId))
    if (!browser) {
      return
    }
    this.profiles.delete(this.profileKey(input.taskId, browser.id))
    if (this.lastProfileByTask.get(input.taskId) === browser.id) {
      this.lastProfileByTask.delete(input.taskId)
    }
    task.updatedAt = Date.now()
    if (browser.dirId) {
      this.markIdle(browser.dirId)
    }
    else {
      this.broadcast()
    }
  }

  syncConnections(connections: Array<{
    dirId: string
    endpoint: string
    browserType: string
    connectedAt: number
    windowName?: string
    windowSortNum?: number
  }>): void {
    const now = Date.now()
    const openDirIds = new Set(connections.map(connection => connection.dirId))
    for (const [dirId, profile] of this.openProfiles) {
      if (!openDirIds.has(dirId) && !profile.owner) this.openProfiles.delete(dirId)
    }
    for (const connection of connections) {
      const existing = this.openProfiles.get(connection.dirId)
      this.openProfiles.set(connection.dirId, {
        dirId: connection.dirId,
        status: existing?.status ?? 'idle',
        endpoint: connection.endpoint,
        browserType: connection.browserType,
        windowName: connection.windowName ?? existing?.windowName,
        windowSortNum: connection.windowSortNum ?? existing?.windowSortNum,
        platformUrl: existing?.platformUrl,
        platformUserName: existing?.platformUserName,
        platformIcon: existing?.platformIcon,
        countryCode: existing?.countryCode,
        connectedAt: existing?.endpoint === connection.endpoint
          ? existing.connectedAt
          : connection.connectedAt,
        updatedAt: now,
        idleSince: existing?.status === 'running' ? undefined : (existing?.idleSince ?? now),
        owner: existing?.owner,
        events: existing?.events ?? [],
      })
    }
    this.mergeCachedBrowserDetails()
    this.ensureBrowserDetails(connections.map(connection => connection.dirId))
    this.broadcast()
  }

  markIdle(dirId: string): void {
    const profile = this.openProfiles.get(dirId)
    if (!profile) return
    const now = Date.now()
    profile.status = 'idle'
    profile.owner = undefined
    profile.idleSince = now
    profile.updatedAt = now
    this.broadcast()
  }

  removeProfile(dirId: string): void {
    if (this.openProfiles.delete(dirId)) this.broadcast()
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
    const tasks: TaskMonitorTask[] = []
    for (const task of this.tasks.values()) {
      const browsers = this.profilesForTask(task.id)
        .map(profile => ({ ...profile, events: [...profile.events] }))
        .sort((a, b) => b.updatedAt - a.updatedAt)
      if (browsers.length > 0) {
        tasks.push({
          id: task.id,
          title: task.title,
          sourceType: task.sourceType,
          status: 'running' as const,
          conversationId: task.conversationId,
          runId: task.runId,
          startedAt: task.startedAt,
          updatedAt: task.updatedAt,
          browsers,
        })
      }
    }
    tasks.sort((a, b) => b.updatedAt - a.updatedAt)

    return {
      type: 'snapshot',
      data: {
        generatedAt: Date.now(),
        tasks,
      },
    }
  }

  getProfileSnapshot(): AgentProfileMonitorSnapshot {
    return {
      type: 'snapshot',
      data: {
        generatedAt: Date.now(),
        profiles: [...this.openProfiles.values()]
          .map(profile => ({ ...profile, owner: profile.owner ? { ...profile.owner } : undefined, events: [...profile.events] }))
          .sort((a, b) => {
            if (a.status !== b.status) return a.status === 'running' ? -1 : 1
            return b.updatedAt - a.updatedAt
          }),
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

  subscribeProfiles(callback: (snapshot: AgentProfileMonitorSnapshot) => void): () => void {
    this.profileSubscribers.add(callback)
    callback(this.getProfileSnapshot())
    return () => this.profileSubscribers.delete(callback)
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
    this.profiles.clear()
    this.lastProfileByTask.clear()
    this.openProfiles.clear()
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
    const profileSnapshot = this.getProfileSnapshot()
    for (const callback of this.profileSubscribers) {
      try {
        callback(profileSnapshot)
      }
      catch {
        // Subscriber already handles its own lifecycle.
      }
    }
  }
}

export const profileMonitorHub = new ProfileMonitorHub()
