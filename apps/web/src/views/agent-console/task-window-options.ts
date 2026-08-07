import type {
  UserGetWindowInfoListListData,
  UserGetWindowInfoV2ListData,
} from '@roxy/backend-api'
import { API } from '/@/api'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'
import { getAgentOpenedWindowIds } from './opened-window-state'
import type { TaskWindowOption } from './task-manager'
import {
  getAgentWindowDisplay,
  mergeAgentWindowOpenStatus,
  sortAgentWindowsOpenedFirst,
} from './window-display'

interface BrowserItem {
  dirId?: string
  windowSortNum?: number
  windowName?: string
  windowRemark?: string
  projectId?: string | number
  projectName?: string
  country?: string
  lastCountry?: string
  openStatus?: boolean
}

type ListBrowserItem = UserGetWindowInfoListListData['data']['rows'][number]
type V2BrowserItem = UserGetWindowInfoV2ListData['data']['rows'][number]

const WINDOW_PAGE_SIZE = 100
const WINDOW_QUERY_BATCH_SIZE = 50
const WINDOW_QUERY_CONCURRENCY = 4

function formatWindowNumber(item: BrowserItem, width: number, workspaceName?: string) {
  if (item.windowSortNum === undefined)
    return ''

  const prefix = getWorkspaceNamePrefix(workspaceName)
  const sortNumber = `${item.windowSortNum}`.padStart(width, '0')
  return prefix ? `${prefix}-${sortNumber}` : sortNumber
}

function toTaskWindowOptions(
  rows: readonly BrowserItem[],
  workspaceName?: string,
  openedWindowIds: ReadonlySet<string> = new Set(),
) {
  const largestSortNumber = rows.reduce((max, item) => Math.max(max, item.windowSortNum ?? 0), 0)
  const width = Math.max(1, `${largestSortNumber}`.length)

  const options = rows.flatMap((item): TaskWindowOption[] => item.dirId
    ? [{
        id: item.dirId,
        code: formatWindowNumber(item, width, workspaceName),
        windowSortNum: item.windowSortNum,
        projectId: item.projectId?.toString(),
        projectName: item.projectName,
        ...getAgentWindowDisplay(mergeAgentWindowOpenStatus(item, openedWindowIds)),
      }]
    : [])

  return sortAgentWindowsOpenedFirst(options)
}

export function reformatTaskWindowOptions(
  options: readonly TaskWindowOption[],
  workspaceName?: string,
) {
  const largestSortNumber = options.reduce((max, item) => Math.max(max, item.windowSortNum ?? 0), 0)
  const width = Math.max(1, `${largestSortNumber}`.length)

  return options.map(item => ({
    ...item,
    code: item.windowSortNum === undefined
      ? item.code
      : formatWindowNumber(item, width, workspaceName),
  }))
}

async function fetchWindowInfoV2Batch(dirIds: string[]) {
  const response = await API.window.userGetWindowInfoV2List({
    page_index: 1,
    page_size: dirIds.length,
    dirIds: dirIds.join(','),
    isDelete: 0,
  })
  if (response.code !== 0)
    throw new Error(response.msg || 'Failed to load task windows')

  return response.data?.rows ?? []
}

export async function fetchTaskWindowOptionsByDirIds(
  dirIds: readonly string[],
  workspaceName?: string,
) {
  const openedWindowIdsPromise = getAgentOpenedWindowIds()
  const uniqueDirIds = Array.from(new Set(dirIds.filter(Boolean)))
  if (uniqueDirIds.length === 0)
    return []

  const batches: string[][] = []
  for (let index = 0; index < uniqueDirIds.length; index += WINDOW_QUERY_BATCH_SIZE)
    batches.push(uniqueDirIds.slice(index, index + WINDOW_QUERY_BATCH_SIZE))

  const rows: V2BrowserItem[] = []
  for (let index = 0; index < batches.length; index += WINDOW_QUERY_CONCURRENCY) {
    const batchRows = await Promise.all(
      batches
        .slice(index, index + WINDOW_QUERY_CONCURRENCY)
        .map(batch => fetchWindowInfoV2Batch(batch)),
    )
    rows.push(...batchRows.flat())
  }

  return toTaskWindowOptions(rows, workspaceName, await openedWindowIdsPromise)
}

export interface TaskWindowOptionsPage {
  items: TaskWindowOption[]
  total: number
  hasMore: boolean
}

interface FetchTaskWindowOptionsPageOptions {
  pageIndex: number
  pageSize?: number
  keyword?: string
  projectId?: string
}

export async function fetchTaskWindowOptionsPage(
  options: FetchTaskWindowOptionsPageOptions,
  workspaceName?: string,
): Promise<TaskWindowOptionsPage> {
  const pageSize = options.pageSize ?? 10
  const keyword = options.keyword?.trim() ?? ''
  const [response, openedWindowIds] = await Promise.all([
    API.window.userGetWindowInfoListList({
      page_index: options.pageIndex,
      page_size: pageSize,
      isDelete: 0,
      orderName: 'createTime',
      orderType: 'desc',
      ...(options.projectId ? { projectIds: options.projectId } : {}),
      ...(keyword
        ? {
            queryKey: 'name_remark',
            queryValue: keyword,
          }
        : {}),
    }),
    getAgentOpenedWindowIds(),
  ])
  if (response.code !== 0)
    throw new Error(response.msg || 'Failed to load task windows')

  const rows = response.data?.rows ?? []
  const total = response.data?.total ?? rows.length
  return {
    items: toTaskWindowOptions(rows, workspaceName, openedWindowIds),
    total,
    hasMore: options.pageIndex * pageSize < total,
  }
}

export async function fetchAllTaskWindowOptions(workspaceName?: string) {
  const openedWindowIdsPromise = getAgentOpenedWindowIds()
  const rows: ListBrowserItem[] = []
  let pageIndex = 1
  let total = 0

  do {
    const response = await API.window.userGetWindowInfoListList({
      page_index: pageIndex,
      page_size: WINDOW_PAGE_SIZE,
      isDelete: 0,
      orderName: 'createTime',
      orderType: 'desc',
    })
    if (response.code !== 0) {
      throw new Error(response.msg || 'Failed to load task windows')
    }

    const pageRows = response.data?.rows ?? []
    rows.push(...pageRows)
    total = response.data?.total ?? rows.length
    pageIndex++
    if (!pageRows.length)
      break
  } while (rows.length < total)

  return toTaskWindowOptions(rows, workspaceName, await openedWindowIdsPromise)
}
// Keep the legacy export for template and template-store consumers.
export const fetchTaskWindowOptions = fetchAllTaskWindowOptions
