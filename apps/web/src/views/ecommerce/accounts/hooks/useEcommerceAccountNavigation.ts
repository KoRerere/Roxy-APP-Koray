import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router'
import { useRouter } from 'vue-router'
import { useBackRoute } from '/@/router/navigation'
import { LIST_CACHE_NAMESPACE, useListCacheActions } from '/@/stores/listCache'
import { emitter } from '/@/utils/eventBus'

const ECOMMERCE_GROUP_BACK_PATTERN = /^\/ecommerce\/groups\/(\d+)/
const ECOMMERCE_ACCOUNT_FORM_PATHS = ['/ecommerce/accounts/create', '/ecommerce/accounts/edit']

interface EcommerceAccountBackMeta {
  projectId?: number
  projectName?: string
}

function pickListQuery(query: Record<string, unknown>): LocationQueryRaw {
  const result: LocationQueryRaw = {}
  if (query.page_index != null)
    result.page_index = String(query.page_index)
  if (query.activeTabId != null)
    result.activeTabId = String(query.activeTabId)
  if (query.customFilterParams != null)
    result.customFilterParams = String(query.customFilterParams)
  return result
}

export function useEcommerceAccountNavigation() {
  const router = useRouter()
  const backRoute = useBackRoute()
  const { invalidateCache } = useListCacheActions()

  function invalidateEcommerceAccountListCache(projectId?: string | number) {
    invalidateCache(LIST_CACHE_NAMESPACE.ECOMMERCE_ACCOUNT_LIST, { projectId: '' })
    if (projectId != null && String(projectId) !== '')
      invalidateCache(LIST_CACHE_NAMESPACE.ECOMMERCE_ACCOUNT_LIST, { projectId: String(projectId) })
  }

  /** 已绑定账号的设备变更后，需清空全部 scope 的账号列表缓存 */
  function invalidateAllEcommerceAccountListCaches() {
    invalidateCache(LIST_CACHE_NAMESPACE.ECOMMERCE_ACCOUNT_LIST)
  }

  /** 已绑定账号的设备变更后，失效账号列表缓存并通知已挂载列表刷新 */
  function refreshEcommerceAccountListAfterDeviceChange() {
    invalidateAllEcommerceAccountListCaches()
    emitter.emit('refreshProfileList')
  }

  function resolveEcommerceAccountBackTarget(meta: EcommerceAccountBackMeta = {}): RouteLocationRaw {
    const { path, query } = backRoute
    const normalizedPath = path?.split('?')[0] ?? ''

    if (normalizedPath && !ECOMMERCE_ACCOUNT_FORM_PATHS.includes(normalizedPath)) {
      const match = normalizedPath.match(ECOMMERCE_GROUP_BACK_PATTERN)
      if (match) {
        return {
          name: 'ecommerce-group-item',
          params: { id: match[1] },
          query: {
            ...pickListQuery(query),
            title: meta.projectName ?? query.title,
          },
        }
      }
    }

    return {
      name: 'ecommerce-account-list',
      query: pickListQuery(query),
    }
  }

  function navigateBackAfterSave(meta: EcommerceAccountBackMeta = {}) {
    router.replace(resolveEcommerceAccountBackTarget(meta))
  }

  return {
    invalidateEcommerceAccountListCache,
    invalidateAllEcommerceAccountListCaches,
    refreshEcommerceAccountListAfterDeviceChange,
    navigateBackAfterSave,
  }
}
