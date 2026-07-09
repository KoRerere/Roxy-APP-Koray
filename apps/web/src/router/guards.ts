import { LOCALE_SWITCH_HANDOFF_TOKEN_QUERY, MP_DISTINCT_ID, OFFICIAL_SITE_INVITE_CODE } from '/@/constants/storage-key'
import { buildRouteContext } from '/@/composables/useRouteContext'
import type { RouteContext } from '/@/composables/useRouteContext'
import type { Role } from '/@/enums'
import { WorkspaceType } from '/@/enums'
import {
  getWorkspaceTypeLandingRoute,
  isLegacyPublicWorkspace,
  LEGACY_SHARED_ROUTE_NAME,
  PRIVATE_DEFAULT_ROUTE,
} from '/@/domain/workspace-routing'
import { getCrossModeFallbackRoute, resolveCrossModeRoute } from '/@/router/routing'
import { usePermissionStore } from '/@/stores/permission'
import { useRoleStore } from '/@/stores/role'
import { useSimpleLocale } from '/@/stores/locale'
import { useThemeStore } from '/@/stores/theme'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { isEqual } from 'es-toolkit'
import type { LocationQueryRaw, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

// --- Guard context ---

export function createGuardContext() {
  const userStore = useUserStore()
  const workspaceStore = useWorkspaceStore()
  const roleStore = useRoleStore()
  const permissionStore = usePermissionStore()

  return {
    userStore,
    workspaceStore,
    roleStore,
    permissionStore,
    currentWorkspace: workspaceStore.currentWorkspace,
  }
}

export type GuardContext = ReturnType<typeof createGuardContext>

type GuardResult = boolean | RouteLocationRaw | undefined

const authWhiteList = ['oauth2callback']

const noTakeQueryList = ['official-site-lang', OFFICIAL_SITE_INVITE_CODE, MP_DISTINCT_ID, LOCALE_SWITCH_HANDOFF_TOKEN_QUERY]

// --- Individual guards ---

function authGuard(to: RouteLocationNormalized, ctx: GuardContext) {
  const { userStore } = ctx

  if (authWhiteList.includes(to.name as string))
    return true

  if (to.name !== 'login' && !userStore.token)
    return { name: 'login', query: to.query }

  return true
}

function permissionGuard(to: RouteLocationNormalized, ctx: GuardContext) {
  const { permissionStore } = ctx

  if (Array.isArray(to.meta.permissions) && !permissionStore.check(to.meta.permissions, to.meta.permissionMode))
    return { name: 'home', query: to.query }

  return true
}

function landingGuard(
  to: RouteLocationNormalized,
  workspaceType?: WorkspaceType,
  role?: Role,
) {
  if (to.name !== 'home' && to.path !== '/')
    return true

  const landingRoute = getWorkspaceTypeLandingRoute(workspaceType, role)
  if (landingRoute === to.name)
    return true

  return { name: landingRoute, query: to.query }
}

function getEffectiveWorkspaceTypes(to: RouteLocationNormalized): WorkspaceType[] | undefined {
  const recordWithTypes = [...to.matched].reverse().find(record => record.meta.workspaceTypes?.length)
  return recordWithTypes?.meta.workspaceTypes
}

function routeAllowsWorkspaceType(to: RouteLocationNormalized, workspaceType: WorkspaceType) {
  const workspaceTypes = getEffectiveWorkspaceTypes(to)
  if (!workspaceTypes?.length)
    return true
  return workspaceTypes.includes(workspaceType)
}

function legacyWorkspaceGuard(to: RouteLocationNormalized, workspaceType?: WorkspaceType) {
  if (!isLegacyPublicWorkspace(workspaceType) && to.name === LEGACY_SHARED_ROUTE_NAME)
    return { name: PRIVATE_DEFAULT_ROUTE, query: to.query }

  return true
}

function workspaceTypeGuard(to: RouteLocationNormalized, ctx: RouteContext) {
  if (ctx.isPublicMember)
    return true

  const routeName = to.name as string | undefined

  if (ctx.isEcommerce && !routeAllowsWorkspaceType(to, WorkspaceType.ECommerce)) {
    return {
      name: resolveCrossModeRoute(routeName, true) ?? getCrossModeFallbackRoute(true),
      query: to.query,
    }
  }

  if (ctx.isNormal && !routeAllowsWorkspaceType(to, WorkspaceType.Private)) {
    return {
      name: resolveCrossModeRoute(routeName, false) ?? getCrossModeFallbackRoute(false),
      query: to.query,
    }
  }

  return true
}

function mergeQuery(to: RouteLocationNormalized): LocationQueryRaw {
  const themeStore = useThemeStore()
  const simpleLocale = useSimpleLocale()
  const query: LocationQueryRaw = { ...to.query }

  query.theme = `${themeStore.realTheme}`
  query.language = simpleLocale.currentLocale || 'en'
  query._title = 'roxybrowser'

  noTakeQueryList.forEach((key) => {
    delete query[key]
  })

  return query
}

// --- Pipeline ---

export async function runNavigationGuards(to: RouteLocationNormalized): Promise<GuardResult> {
  const ctx = createGuardContext()

  await ctx.userStore.hasCallInitUserInfo.promise

  const query = mergeQuery(to)
  const routeContext = buildRouteContext({
    workspaceType: ctx.currentWorkspace?.workspaceType,
    workspaceId: ctx.currentWorkspace?.id,
    role: ctx.currentWorkspace?.role,
    isOwner: ctx.roleStore.isOwner,
  })

  const authResult = authGuard(to, ctx)
  if (authResult !== true)
    return typeof authResult === 'object' ? { ...authResult, query } : authResult

  const permissionResult = permissionGuard(to, ctx)
  if (permissionResult !== true)
    return typeof permissionResult === 'object' ? { ...permissionResult, query } : permissionResult

  const legacyResult = legacyWorkspaceGuard(to, ctx.currentWorkspace?.workspaceType)
  if (legacyResult !== true)
    return typeof legacyResult === 'object' ? { ...legacyResult, query } : legacyResult

  const landingResult = landingGuard(to, ctx.currentWorkspace?.workspaceType, ctx.currentWorkspace?.role)
  if (landingResult !== true)
    return typeof landingResult === 'object' ? { ...landingResult, query } : landingResult

  const workspaceTypeResult = workspaceTypeGuard(to, routeContext)
  if (workspaceTypeResult !== true)
    return typeof workspaceTypeResult === 'object' ? { ...workspaceTypeResult, query } : workspaceTypeResult

  if (isEqual(to.query, query))
    return true

  return { ...to, query }
}
