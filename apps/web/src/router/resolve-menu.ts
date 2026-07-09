import { cloneDeep } from 'es-toolkit'
import type { WorkspaceType } from '/@/enums'
import { LEGACY_SHARED_ROUTE_NAME } from '/@/domain/workspace-routing'
import { ecommerceMenuRoutes, normalMenuRoutes, sharedMenuRoutes } from '/@/router/menu-routes'
import type { RouteContext } from '/@/composables/useRouteContext'
import type { Permission, PermissionMode } from '/@/hooks/usePermission/type'
import type { RouteMeta, RouteRecordRaw } from 'vue-router'

export interface ResolveMenuOptions {
  ctx: RouteContext
  /** @legacy 普通模式 pin 项目 */
  projectChildren?: RouteRecordRaw[]
  /** 电商模式 pin 分组 */
  ecommerceGroupChildren?: RouteRecordRaw[]
  checkPermission: (permissions?: Permission[], mode?: PermissionMode) => boolean
}

/**
 * @legacy Public 成员侧边栏：原仅展示 shared 菜单项。
 * shared 路由未注册时返回空菜单，避免 aside-menu crash。
 */
function resolveLegacySharedMenuRoutes(menuRoutes: RouteRecordRaw[]): RouteRecordRaw[] {
  const sharedMenu = menuRoutes.find(item => item.name === LEGACY_SHARED_ROUTE_NAME)
  if (!sharedMenu)
    return []

  return [{
    ...sharedMenu,
    meta: { ...sharedMenu.meta, hideInMenu: false },
  }]
}

function matchesWorkspaceType(meta: RouteMeta | undefined, workspaceType: WorkspaceType) {
  if (!meta?.workspaceTypes?.length)
    return true
  return meta.workspaceTypes.includes(workspaceType)
}

export function filterMenuRoutes(
  menus: RouteRecordRaw[],
  ctx: RouteContext,
  checkPermission: ResolveMenuOptions['checkPermission'],
): RouteRecordRaw[] {
  return menus.filter((item) => {
    if (item.children?.length) {
      item.children = filterMenuRoutes(item.children, ctx, checkPermission)
    }

    if (item.meta?.type === 'group' && !item.children?.length)
      return false

    const hasPermission = !item.meta?.permissions?.length || checkPermission(item.meta.permissions, item.meta.permissionMode)
    const hasWorkspaceType = matchesWorkspaceType(item.meta, ctx.workspaceType)

    return !item.meta?.hideInMenu && hasPermission && hasWorkspaceType
  })
}

function injectPinnedChildren(
  routes: RouteRecordRaw[],
  parentName: string,
  children: RouteRecordRaw[],
) {
  const parentIndex = routes.findIndex(item => item.name === parentName)
  if (parentIndex === -1)
    return routes

  return [
    ...routes.slice(0, parentIndex),
    {
      ...routes[parentIndex],
      children,
    },
    ...routes.slice(parentIndex + 1),
  ] as RouteRecordRaw[]
}

export function resolveMenuRoutes(options: ResolveMenuOptions): RouteRecordRaw[] {
  const { ctx, projectChildren, ecommerceGroupChildren, checkPermission } = options

  if (ctx.isPublicMember) {
    return filterMenuRoutes(
      cloneDeep(resolveLegacySharedMenuRoutes(normalMenuRoutes)),
      ctx,
      checkPermission,
    )
  }

  if (ctx.isEcommerce) {
    const routes = ecommerceGroupChildren?.length
      ? injectPinnedChildren(cloneDeep([...ecommerceMenuRoutes, ...sharedMenuRoutes]), 'ecommerce-groups', ecommerceGroupChildren)
      : cloneDeep([...ecommerceMenuRoutes, ...sharedMenuRoutes])

    return filterMenuRoutes(routes, ctx, checkPermission)
  }

  const routes = projectChildren?.length
    ? injectPinnedChildren(cloneDeep([...normalMenuRoutes, ...sharedMenuRoutes]), 'projects', projectChildren)
    : cloneDeep([...normalMenuRoutes, ...sharedMenuRoutes])

  return filterMenuRoutes(routes, ctx, checkPermission)
}
