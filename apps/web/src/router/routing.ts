import { ECOMMERCE_DEFAULT_ROUTE, PRIVATE_DEFAULT_ROUTE } from '/@/domain/workspace-routing'

/** 普通模式专属路由 → 电商模式对应路由 */
export const NORMAL_TO_ECOMMERCE_ROUTE_MAP: Record<string, string> = {
  'browser': ECOMMERCE_DEFAULT_ROUTE,
  'browser-list': ECOMMERCE_DEFAULT_ROUTE,
  'browser-create': ECOMMERCE_DEFAULT_ROUTE,
  'browser-edit': ECOMMERCE_DEFAULT_ROUTE,
  'projects': 'ecommerce-group-list',
  'project-list': 'ecommerce-group-list',
  'project-item': 'ecommerce-group-list',
  'agent-list': 'ecommerce-device-list',
  'agent-create': 'ecommerce-device-list',
  'extensions': 'ecommerce-plugin-list',
  'account-list': ECOMMERCE_DEFAULT_ROUTE,
  'account-create': ECOMMERCE_DEFAULT_ROUTE,
}

/** 电商模式专属路由 → 普通模式对应路由 */
export const ECOMMERCE_TO_NORMAL_ROUTE_MAP: Record<string, string> = {
  'ecommerce-account-list': 'browser-list',
  'ecommerce-groups': 'project-list',
  'ecommerce-group-list': 'project-list',
  'ecommerce-group-item': 'project-list',
  'ecommerce-device-list': 'agent-list',
  'ecommerce-plugin-list': 'extensions',
  'ecosystem-center': 'browser-list',
  'cross-border-marketing': 'browser-list',
}

export function resolveCrossModeRoute(routeName: string | symbol | null | undefined, isEcommerce: boolean) {
  if (!routeName || typeof routeName !== 'string')
    return undefined

  const map = isEcommerce ? NORMAL_TO_ECOMMERCE_ROUTE_MAP : ECOMMERCE_TO_NORMAL_ROUTE_MAP
  return map[routeName]
}

export function getCrossModeFallbackRoute(isEcommerce: boolean) {
  return isEcommerce ? ECOMMERCE_DEFAULT_ROUTE : PRIVATE_DEFAULT_ROUTE
}
