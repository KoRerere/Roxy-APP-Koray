import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useWorkspaceStore } from '/@/stores/workspace'

export const LIST_CACHE_NAMESPACE = {
  BROWSER_LIST: 'browser-list',
  ACCOUNT_LIST: 'account-list',
  PROJECT_LIST: 'project-list',
  ECOMMERCE_ACCOUNT_LIST: 'ecommerce-account-list',
} as const

export type ListCacheNamespace = typeof LIST_CACHE_NAMESPACE[keyof typeof LIST_CACHE_NAMESPACE]

export const MAX_PROJECT_DETAIL_CACHES = 5

export interface ListCacheEntry {
  rows: unknown[]
  total: number
  outerParams: Record<string, unknown>
  paginator: { first: number, rows: number }
  meta: Record<string, unknown>
  lastAccessedAt: number
}

export function buildScopeKey(scope: Record<string, unknown>): string {
  const keys = Object.keys(scope).sort()
  const normalized: Record<string, unknown> = {}
  for (const key of keys)
    normalized[key] = scope[key]
  return JSON.stringify(normalized)
}

export function isProjectDetailScope(scope: Record<string, unknown>): boolean {
  const projectId = scope.projectId
  return projectId !== undefined && projectId !== null && String(projectId) !== ''
}

function isProjectDetailListCache(namespace: string) {
  return namespace === LIST_CACHE_NAMESPACE.BROWSER_LIST
    || namespace === LIST_CACHE_NAMESPACE.ECOMMERCE_ACCOUNT_LIST
}

function buildCacheKey(namespace: string, workspaceId: string, scope: Record<string, unknown>) {
  return `${namespace}:${workspaceId}:${buildScopeKey(scope)}`
}

function buildWorkspaceKey(namespace: string, workspaceId: string) {
  return `${namespace}:${workspaceId}`
}

export const useListCacheStore = defineStore('listCache', () => {
  const entries = ref(new Map<string, ListCacheEntry>())
  /** browser-list 项目详情 scope 的 LRU 顺序（末尾为最近访问） */
  const projectDetailLru = ref(new Map<string, string[]>())
  /** 与行缓存解耦：invalidate 行数据时保留，供编辑返回后还原虚拟列表偏移 */
  const scrollOffsets = ref(new Map<string, number>())

  function get(namespace: string, workspaceId: string, scope: Record<string, unknown>): ListCacheEntry | null {
    if (!workspaceId)
      return null
    const key = buildCacheKey(namespace, workspaceId, scope)
    return entries.value.get(key) ?? null
  }

  function hasValid(namespace: string, workspaceId: string, scope: Record<string, unknown>): boolean {
    return get(namespace, workspaceId, scope) !== null
  }

  function touch(namespace: string, workspaceId: string, scope: Record<string, unknown>) {
    const key = buildCacheKey(namespace, workspaceId, scope)
    const entry = entries.value.get(key)
    if (!entry)
      return

    entry.lastAccessedAt = Date.now()
    entries.value.set(key, entry)

    if (isProjectDetailListCache(namespace) && isProjectDetailScope(scope)) {
      const workspaceKey = buildWorkspaceKey(namespace, workspaceId)
      const order = projectDetailLru.value.get(workspaceKey) ?? []
      const index = order.indexOf(key)
      if (index >= 0)
        order.splice(index, 1)
      order.push(key)
      projectDetailLru.value.set(workspaceKey, order)
    }
  }

  function set(namespace: string, workspaceId: string, scope: Record<string, unknown>, entry: ListCacheEntry) {
    if (!workspaceId)
      return

    const key = buildCacheKey(namespace, workspaceId, scope)
    const nextEntry: ListCacheEntry = {
      ...entry,
      lastAccessedAt: Date.now(),
    }
    entries.value.set(key, nextEntry)

    if (isProjectDetailListCache(namespace) && isProjectDetailScope(scope)) {
      const workspaceKey = buildWorkspaceKey(namespace, workspaceId)
      const order = projectDetailLru.value.get(workspaceKey) ?? []
      const index = order.indexOf(key)
      if (index >= 0)
        order.splice(index, 1)
      order.push(key)
      projectDetailLru.value.set(workspaceKey, order)

      while (order.length > MAX_PROJECT_DETAIL_CACHES) {
        const evictKey = order.shift()
        if (evictKey)
          entries.value.delete(evictKey)
      }
    }
  }

  function invalidate(namespace: string, workspaceId: string, scope?: Record<string, unknown>) {
    if (!workspaceId)
      return

    if (scope) {
      const key = buildCacheKey(namespace, workspaceId, scope)
      entries.value.delete(key)

      if (isProjectDetailListCache(namespace) && isProjectDetailScope(scope)) {
        const workspaceKey = buildWorkspaceKey(namespace, workspaceId)
        const order = projectDetailLru.value.get(workspaceKey) ?? []
        projectDetailLru.value.set(workspaceKey, order.filter(item => item !== key))
      }
      return
    }

    const prefix = `${namespace}:${workspaceId}:`
    for (const key of [...entries.value.keys()]) {
      if (key.startsWith(prefix))
        entries.value.delete(key)
    }
    projectDetailLru.value.delete(buildWorkspaceKey(namespace, workspaceId))
  }

  function clearAll() {
    entries.value = new Map()
    projectDetailLru.value = new Map()
    scrollOffsets.value = new Map()
  }

  /** 离开列表时写入当前虚拟列表偏移；与 rows 是否仍有效无关 */
  function setScrollOffset(namespace: string, workspaceId: string, scope: Record<string, unknown>, offset: number) {
    if (!workspaceId)
      return
    scrollOffsets.value.set(buildCacheKey(namespace, workspaceId, scope), offset)
  }

  /** 只读快照；还原成功后再 clear，避免 spacer 未撑开时提前丢掉 */
  function peekScrollOffset(namespace: string, workspaceId: string, scope: Record<string, unknown>): number | null {
    if (!workspaceId)
      return null
    const key = buildCacheKey(namespace, workspaceId, scope)
    if (!scrollOffsets.value.has(key))
      return null
    return scrollOffsets.value.get(key) ?? 0
  }

  /** 主动丢弃滚动快照（如表格刷新按钮），不碰行缓存 */
  function clearScrollOffset(namespace: string, workspaceId: string, scope?: Record<string, unknown>) {
    if (!workspaceId)
      return
    if (scope) {
      scrollOffsets.value.delete(buildCacheKey(namespace, workspaceId, scope))
      return
    }
    const prefix = `${namespace}:${workspaceId}:`
    for (const key of [...scrollOffsets.value.keys()]) {
      if (key.startsWith(prefix))
        scrollOffsets.value.delete(key)
    }
  }

  return {
    get,
    set,
    touch,
    hasValid,
    invalidate,
    clearAll,
    setScrollOffset,
    peekScrollOffset,
    clearScrollOffset,
    buildScopeKey,
    isProjectDetailScope,
  }
})

export function useListCacheActions() {
  const listCacheStore = useListCacheStore()
  const workspaceStore = useWorkspaceStore()

  function invalidateCache(namespace: ListCacheNamespace, scope?: Record<string, unknown>) {
    const workspaceId = workspaceStore.currentWorkspace?.id
    if (!workspaceId)
      return
    listCacheStore.invalidate(namespace, String(workspaceId), scope)
  }

  return { invalidateCache }
}
