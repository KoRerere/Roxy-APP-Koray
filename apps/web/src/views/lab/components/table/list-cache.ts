import type { SortOrderNumber } from '/@/utils'

/** 一次列表访问留下的视图。滚动和行在同一条记录里，刷新时一起丢掉 */
export interface LabTableMemory {
  rows: unknown[]
  total: number
  page: { first: number, size: number }
  params: Record<string, unknown>
  filters: Record<string, unknown>
  sort: { field: string, order: SortOrderNumber }
  scrollTop: number
}

/** 只留最近用过的列表，避免实验页和多项目来回切时无限涨 */
const MAX_TABLE_MEMORIES = 24

const memories = new Map<string, LabTableMemory>()

function remember(key: string, entry: LabTableMemory) {
  memories.delete(key)
  memories.set(key, entry)
  while (memories.size > MAX_TABLE_MEMORIES) {
    const oldest = memories.keys().next().value
    if (oldest === undefined) {
      return
    }
    memories.delete(oldest)
  }
}

export function readTableMemory(key?: string) {
  if (!key) {
    return null
  }
  const entry = memories.get(key)
  if (!entry) {
    return null
  }
  remember(key, entry)
  return entry
}

/** 写入当前页。沿用这条记录上还没被取走的滚动，避免翻页把离开位置盖掉 */
export function writeTableMemory(key: string | undefined, view: Omit<LabTableMemory, 'scrollTop'>) {
  if (!key) {
    return
  }
  const prev = memories.get(key)
  remember(key, { ...view, scrollTop: prev?.scrollTop ?? 0 })
}

export function writeTableScroll(key: string | undefined, scrollTop: number) {
  if (!key) {
    return
  }
  const prev = memories.get(key)
  if (!prev) {
    return
  }
  remember(key, { ...prev, scrollTop })
}

export function peekTableScroll(key?: string) {
  if (!key) {
    return 0
  }
  return memories.get(key)?.scrollTop ?? 0
}

/** 滚动已经套上之后再清，套失败时下一次渲染还能再试 */
export function clearTableScroll(key?: string) {
  const entry = key ? memories.get(key) : undefined
  if (entry) {
    entry.scrollTop = 0
  }
}

export function dropTableMemory(key?: string) {
  if (!key) {
    return
  }
  memories.delete(key)
}
