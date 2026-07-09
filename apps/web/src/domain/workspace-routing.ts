import { Role, WorkspaceType } from '/@/enums'

/** 普通模式默认 landing */
export const PRIVATE_DEFAULT_ROUTE = 'browser-list' as const

/** 电商模式默认 landing */
export const ECOMMERCE_DEFAULT_ROUTE = 'ecommerce-account-list' as const

/**
 * @legacy WorkspaceType.Public / `shared` 命名路由
 *
 * 当前版本未使用 Public 工作区，`shared` 路由亦未在 menu 中注册。
 * 保留前后端引用以便未来可能回归；导航与菜单统一 fallback，避免重定向死循环。
 */

/** @legacy 历史 shared 页路由名（当前未注册） */
export const LEGACY_SHARED_ROUTE_NAME = 'shared'

/** Public 非 Owner 登录/切换工作区时的 landing（shared 未注册时 fallback） */
export const LEGACY_PUBLIC_MEMBER_LANDING_ROUTE = 'browser-list' as const

export function isLegacyPublicWorkspace(workspaceType?: WorkspaceType) {
  return workspaceType === WorkspaceType.Public
}

/** @legacy Public 工作区中非 Owner 成员 */
export function isLegacyPublicMember(workspaceType?: WorkspaceType, role?: Role) {
  return isLegacyPublicWorkspace(workspaceType) && role !== Role.OWNER
}

export function getLegacyPublicMemberLandingRoute() {
  return LEGACY_PUBLIC_MEMBER_LANDING_ROUTE
}

function isEcommerceWorkspace(type?: WorkspaceType) {
  return type === WorkspaceType.ECommerce
}

export function getWorkspaceTypeLandingRoute(workspaceType?: WorkspaceType, role?: Role) {
  if (isLegacyPublicMember(workspaceType, role))
    return getLegacyPublicMemberLandingRoute()
  if (isEcommerceWorkspace(workspaceType))
    return ECOMMERCE_DEFAULT_ROUTE
  return PRIVATE_DEFAULT_ROUTE
}
