import { ECOMMERCE_DEFAULT_ROUTE, PRIVATE_DEFAULT_ROUTE } from '/@/domain/workspace-routing'

/** 普通模式专属路由 → 电商模式对应路由 */
export const NORMAL_TO_ECOMMERCE_ROUTE_MAP: Record<string, string> = {
  'browser': ECOMMERCE_DEFAULT_ROUTE,
  'browser-list': ECOMMERCE_DEFAULT_ROUTE,
  'browser-create': 'ecommerce-account-create',
  'browser-edit': 'ecommerce-account-edit',
  'projects': 'ecommerce-group-list',
  'project-list': 'ecommerce-group-list',
  'project-item': 'ecommerce-group-list',
  'agent-list': 'ecommerce-device-list',
  'agent-create': 'ecommerce-device-create',
  'extensions': 'ecommerce-plugin-list',
  'account-list': ECOMMERCE_DEFAULT_ROUTE,
  'account-create': 'ecommerce-account-create',
}

/** 电商模式专属路由 → 普通模式对应路由 */
export const ECOMMERCE_TO_NORMAL_ROUTE_MAP: Record<string, string> = {
  'ecommerce-account-list': 'browser-list',
  'ecommerce-account-create': 'browser-create',
  'ecommerce-account-edit': 'browser-edit',
  'ecommerce-groups': 'project-list',
  'ecommerce-group-list': 'project-list',
  'ecommerce-group-item': 'project-list',
  'ecommerce-devices': 'agent-list',
  'ecommerce-device-list': 'agent-list',
  'ecommerce-device-create': 'agent-create',
  'ecommerce-plugin-list': 'extensions',
  'ecommerce-resource': 'resource',
  'ecosystem-center': 'browser-list',
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
