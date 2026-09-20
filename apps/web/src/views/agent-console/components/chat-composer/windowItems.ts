import type { UserGetWindowInfoListListData } from '@roxy/backend-api'
import { API } from '/@/api'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'
import { getAgentOpenedWindowIds } from '../../opened-window-state'
import {
  getAgentWindowDisplay,
  mergeAgentWindowOpenStatus,
} from '../../window-display'
import type { AgentComposerItem } from './types'

type WindowRow = UserGetWindowInfoListListData['data']['rows'][number]

const WINDOW_PAGE_SIZE = 10
const SELECT_ALL_WINDOW_PAGE_SIZE = 100

function formatWindowFallback(row: WindowRow) {
  if (row.windowSortNum != null)
    return String(row.windowSortNum)

  return row.dirId || ''
}

function mapWindowComposerItem(row: WindowRow, workspaceName?: string): AgentComposerItem | undefined {
  if (!row.dirId)
    return undefined

  const display = getAgentWindowDisplay(row)
  const title = display.name || formatWindowFallback(row)
  const prefix = getWorkspaceNamePrefix(row.workspaceName || workspaceName)
  const windowCode = row.windowSortNum == null
    ? ''
    : prefix
      ? `${prefix}-${row.windowSortNum}`
      : String(row.windowSortNum)

  if (!title)
    return undefined

  return {
    id: row.dirId,
    kind: 'profile',
    title,
    label: title,
    description: display.remark,
    iconName: display.iconName,
    isOpen: display.isOpen,
    group: 'Windows',
    payload: {
      dirId: row.dirId,
      windowName: display.name,
      windowRemark: display.remark,
      lastCountry: row.lastCountry || '',
      projectId: row.projectId?.toString() || '',
      projectName: row.projectName || '',
      workspaceName: row.workspaceName || workspaceName || '',
      windowSortNum: row.windowSortNum?.toString() || '',
      displayLabel: windowCode || display.name || row.dirId,
    },
  }
}

export interface AgentComposerWindowsPage {
  items: AgentComposerItem[]
  total: number
  hasMore: boolean
}

export interface FetchAgentComposerWindowsPageOptions {
  pageIndex: number
  pageSize?: number
  keyword?: string
  projectId?: string
}

async function fetchWindowRowsPage(options: FetchAgentComposerWindowsPageOptions) {
  const pageSize = options.pageSize ?? WINDOW_PAGE_SIZE
  const query = options.keyword?.trim() ?? ''
  const response = await API.window.userGetWindowInfoListList({
    page_index: options.pageIndex,
    page_size: pageSize,
    isDelete: 0,
    orderName: 'createTime',
    orderType: 'desc',
    ...(query ? { windowName: query } : {}),
    ...(options.projectId ? { projectIds: options.projectId } : {}),
  })

  if (response.code !== 0)
    throw new Error(response.msg || 'Failed to load windows')

  const rows = response.data?.rows ?? []
  const total = response.data?.total ?? rows.length
  return {
    rows,
    total,
    hasMore: options.pageIndex * pageSize < total && rows.length > 0,
  }
}

function mapWindowRows(
  rows: readonly WindowRow[],
  openedWindowIds: ReadonlySet<string>,
  workspaceName?: string,
) {
  const items = rows
    .map(row => mapWindowComposerItem(
      mergeAgentWindowOpenStatus(row, openedWindowIds),
      workspaceName,
    ))
    .filter((item): item is AgentComposerItem => Boolean(item))

  return items
}

export async function fetchAgentComposerWindowsPage(
  options: FetchAgentComposerWindowsPageOptions,
  workspaceName?: string,
): Promise<AgentComposerWindowsPage> {
  const [page, openedWindowIds] = await Promise.all([
    fetchWindowRowsPage(options),
    getAgentOpenedWindowIds(),
  ])

  return {
    items: mapWindowRows(page.rows, openedWindowIds, workspaceName),
    total: page.total,
    hasMore: page.hasMore,
  }
}

export async function fetchAllAgentComposerWindows(
  keyword = '',
  workspaceName?: string,
  projectId = '',
) {
  const openedWindowIdsPromise = getAgentOpenedWindowIds()
  const rows: WindowRow[] = []
  let pageIndex = 1
  let total = 0

  do {
    const page = await fetchWindowRowsPage({
      pageIndex,
      pageSize: SELECT_ALL_WINDOW_PAGE_SIZE,
      keyword,
      projectId,
    })
    rows.push(...page.rows)
    total = page.total

    if (!page.hasMore)
      break

    pageIndex += 1
  } while (rows.length < total)

  return mapWindowRows(rows, await openedWindowIdsPromise, workspaceName)
}
