import type { LocationQueryRaw, RouteLocationRaw, Router, RouteRecordNameGeneric } from 'vue-router'
import type { Role } from '/@/enums'
import { WorkspaceType } from '/@/enums'
import { getWorkspaceTypeLandingRoute } from '/@/utils/workspace-mode'

// --- Router instance ---

let router: Router | null = null

export function registerRouter(r: Router) {
  router = r
}

export function getRouter(): Router {
  if (!router)
    throw new Error('[router] not registered yet')
  return router
}

export function getCurrentRoute() {
  return getRouter().currentRoute.value
}

// --- Navigation API ---

export function navigateToLogin() {
  return getRouter().push({ name: 'login' })
}

export function pushToLocation(to: string | RouteLocationRaw) {
  return getRouter().push(to)
}

export function replaceToRoute(
  name: RouteRecordNameGeneric,
  query?: LocationQueryRaw,
) {
  return getRouter().replace({ name, query })
}

export function replaceToLanding(workspaceType?: WorkspaceType, role?: Role) {
  return replaceToRoute(getWorkspaceTypeLandingRoute(workspaceType, role))
}

export function isLoginRoute() {
  return getCurrentRoute().name === 'login'
}

export interface WorkspaceSwitchNavOptions {
  oldWorkspace: { workspaceType?: WorkspaceType } | undefined
  newWorkspace: { workspaceType?: WorkspaceType, role?: Role }
  hasCurrentRoutePermission: boolean
}

/** 工作区切换时的路由纠偏（首屏赋值由 landingGuard + workspaceTypeGuard 处理） */
export function replaceOnWorkspaceSwitch(options: WorkspaceSwitchNavOptions) {
  const { oldWorkspace, newWorkspace, hasCurrentRoutePermission } = options
  if (!oldWorkspace)
    return

  const currentRoute = getCurrentRoute()
  const isPublic = newWorkspace.workspaceType === WorkspaceType.Public

  if (currentRoute.name === 'project-item')
    replaceToRoute('project-list')

  if (currentRoute.name === 'ecommerce-group-item')
    replaceToRoute('ecommerce-group-list')

  if (Array.isArray(currentRoute.meta?.permissions) && !hasCurrentRoutePermission && !isPublic)
    replaceToRoute('home')

  if (oldWorkspace.workspaceType !== newWorkspace.workspaceType)
    replaceToLanding(newWorkspace.workspaceType, newWorkspace.role)
}

// --- Composables ---

export function useBackRoute() {
  const router = useRouter()

  const backUrl = String(router.options.history.state.back)
  const search = new URLSearchParams(backUrl.split('?')[1])
  const query = Object.assign(Object.fromEntries(search.entries()), router.currentRoute.value.query)
  return { path: backUrl.split('?')[0], query }
}
