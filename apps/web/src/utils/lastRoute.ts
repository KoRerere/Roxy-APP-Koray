import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'
import {
  LAST_APP_ROUTE,
  MP_DISTINCT_ID,
  OFFICIAL_SITE_INVITE_CODE,
} from '/@/constants/storage-key'
import { safeParseJSON } from '/@/utils/basic'
import { LOCALE_SWITCH_HANDOFF_TOKEN_QUERY } from '/@/constants/search-params-key'

interface LastAppRoute {
  userId: number
  fullPath: string
}

/** 不持久化的路由名 */
const EXCLUDED_ROUTE_NAMES = new Set([
  'login',
  'oauth2callback',
  'home',
  '500',
])

/** 守卫注入或营销跳转携带的 query，恢复时无需保留 */
const STRIPPED_QUERY_KEYS = [
  'theme',
  'language',
  '_title',
  'official-site-lang',
  OFFICIAL_SITE_INVITE_CODE,
  MP_DISTINCT_ID,
  LOCALE_SWITCH_HANDOFF_TOKEN_QUERY,
]

export function shouldPersistRoute(to: RouteLocationNormalized) {
  const routeName = to.name as string | undefined
  if (!routeName || EXCLUDED_ROUTE_NAMES.has(routeName))
    return false

  // 仅主 layout 下的业务页可恢复；baseRoutes 中的独立子窗口（MCP、同步器等）排除
  return to.matched[0]?.name === 'home'
}

function buildPersistedFullPath(to: RouteLocationNormalized) {
  const url = new URL(to.fullPath, 'http://local')
  STRIPPED_QUERY_KEYS.forEach(key => url.searchParams.delete(key))

  const search = url.search
  return `${url.pathname}${search}${url.hash}`
}

export function saveLastRoute(to: RouteLocationNormalized, userId?: number) {
  if (!userId || !shouldPersistRoute(to))
    return

  const payload: LastAppRoute = {
    userId,
    fullPath: buildPersistedFullPath(to),
  }
  localStorage.setItem(LAST_APP_ROUTE, JSON.stringify(payload))
}

export function getLastRoute(userId?: number) {
  if (!userId)
    return undefined

  const payload = safeParseJSON(localStorage.getItem(LAST_APP_ROUTE)) as LastAppRoute | undefined
  if (!payload || payload.userId !== userId)
    return undefined

  return payload.fullPath
}

export function clearLastRoute() {
  localStorage.removeItem(LAST_APP_ROUTE)
}

export function resolveLastRoute(fullPath: string, router: Router): RouteLocationRaw | undefined {
  const resolved = router.resolve(fullPath)
  if (!shouldPersistRoute(resolved))
    return undefined

  return {
    path: resolved.path,
    query: resolved.query,
    hash: resolved.hash,
  }
}
