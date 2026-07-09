import '/@/router/types'
import type { RouteRecordRaw } from 'vue-router'
import { ecommerceMenuRoutes } from './menu-ecommerce'
import { normalMenuRoutes } from './menu-normal'
import { sharedMenuRoutes } from './menu-shared'

export { ecommerceMenuRoutes, normalMenuRoutes, sharedMenuRoutes }

/** 按 route name 去重，保留首次出现的路由 */
function dedupeRoutesByName(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  const seen = new Set<string | symbol>()
  return routes.filter((route) => {
    if (route.name === undefined)
      return true
    if (seen.has(route.name))
      return false
    seen.add(route.name)
    return true
  })
}

/** 注册到 router 的完整菜单路由树（普通 + 电商 + 共用，共用路由只注册一次） */
export const menuRoutes = dedupeRoutesByName([
  ...normalMenuRoutes,
  ...ecommerceMenuRoutes,
  ...sharedMenuRoutes,
])
