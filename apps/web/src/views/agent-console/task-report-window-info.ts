import type { UserGetWindowInfoListListData } from '@roxy/backend-api'
import { API } from '/@/api'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'

export interface TaskReportWindowInfo {
  windowSortNum?: number
  workspaceName?: string
  countryCode?: string
  platformUserName?: string
}

type WindowInfoRow = UserGetWindowInfoListListData['data']['rows'][number]

type WindowInfoListLookupParams = Parameters<typeof API.window.userGetWindowInfoListList>[0] & {
  dirIds?: string
}

interface CachedWindowInfo {
  expiresAt: number
  info?: TaskReportWindowInfo
}

const WINDOW_QUERY_BATCH_SIZE = 50
const WINDOW_QUERY_CONCURRENCY = 4
const WINDOW_INFO_CACHE_TTL_MS = 10_000

const windowInfoCache = new Map<string, CachedWindowInfo>()
const pendingWindowInfoLoads = new Map<string, Promise<void>>()

function normalizeDirIds(dirIds: readonly string[]): string[] {
  return [...new Set(dirIds.map(dirId => dirId.trim()).filter(Boolean))]
}

function toWindowInfo(row: WindowInfoRow): TaskReportWindowInfo {
  return {
    ...(row.windowSortNum !== undefined ? { windowSortNum: row.windowSortNum } : {}),
    ...(row.workspaceName ? { workspaceName: row.workspaceName } : {}),
    ...((row.lastCountry || row.country)
      ? { countryCode: (row.lastCountry || row.country)?.toUpperCase() }
      : {}),
    ...(row.platformUserName ? { platformUserName: row.platformUserName } : {}),
  }
}

export function formatTaskReportWindowNumber(info: TaskReportWindowInfo): string {
  if (info.windowSortNum === undefined) {
    return ''
  }

  const prefix = getWorkspaceNamePrefix(info.workspaceName)
  return prefix ? `${prefix}-${info.windowSortNum}` : String(info.windowSortNum)
}

async function loadWindowInfoBatch(dirIds: readonly string[]): Promise<void> {
  const response = await API.window.userGetWindowInfoListList({
    page_index: 1,
    page_size: dirIds.length,
    dirIds: dirIds.join(','),
    isDelete: 0,
    orderName: 'createTime',
    orderType: 'desc',
  } as WindowInfoListLookupParams)
  if (response.code !== 0) {
    throw new Error(response.msg || 'Failed to load task report windows')
  }

  const expiresAt = Date.now() + WINDOW_INFO_CACHE_TTL_MS
  const requestedIds = new Set(dirIds)
  for (const row of response.data?.rows ?? []) {
    if (row.dirId && requestedIds.has(row.dirId)) {
      windowInfoCache.set(row.dirId, { expiresAt, info: toWindowInfo(row) })
      requestedIds.delete(row.dirId)
    }
  }
  for (const dirId of requestedIds) {
    windowInfoCache.set(dirId, { expiresAt })
  }
}

async function loadMissingWindowInfo(dirIds: readonly string[]): Promise<void> {
  const batches: string[][] = []
  for (let index = 0; index < dirIds.length; index += WINDOW_QUERY_BATCH_SIZE) {
    batches.push(dirIds.slice(index, index + WINDOW_QUERY_BATCH_SIZE))
  }

  for (let index = 0; index < batches.length; index += WINDOW_QUERY_CONCURRENCY) {
    await Promise.all(batches.slice(index, index + WINDOW_QUERY_CONCURRENCY).map(async (batch) => {
      const loadKey = batch.join(',')
      const pending = pendingWindowInfoLoads.get(loadKey) ?? loadWindowInfoBatch(batch)
      pendingWindowInfoLoads.set(loadKey, pending)
      try {
        await pending
      }
      finally {
        pendingWindowInfoLoads.delete(loadKey)
      }
    }))
  }
}

export async function fetchTaskReportWindowInfo(
  dirIds: readonly string[],
): Promise<ReadonlyMap<string, TaskReportWindowInfo>> {
  const uniqueDirIds = normalizeDirIds(dirIds)
  if (uniqueDirIds.length === 0) {
    return new Map()
  }

  const now = Date.now()
  const missingDirIds = uniqueDirIds.filter((dirId) => {
    const cached = windowInfoCache.get(dirId)
    return !cached || now >= cached.expiresAt
  })
  if (missingDirIds.length > 0) {
    await loadMissingWindowInfo(missingDirIds)
  }

  return new Map(uniqueDirIds.flatMap((dirId) => {
    const info = windowInfoCache.get(dirId)?.info
    return info ? [[dirId, info] as const] : []
  }))
}

export function clearTaskReportWindowInfoCache(): void {
  windowInfoCache.clear()
  pendingWindowInfoLoads.clear()
}
