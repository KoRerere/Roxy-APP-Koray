import {
  LOCALE_SWITCH_HANDOFF_TOKEN_QUERY,
  MP_DISTINCT_ID,
  OFFICIAL_SITE_INVITE_CODE,
  OFFICIAL_SITE_LANG,
} from '/@/constants/search-params-key'
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
import { getRouter } from '/@/router/navigation'
import { isGuideIncomplete, needsBeforeEnterResume } from '/@/domain/before-enter'
import { usePermissionStore } from '/@/stores/permission'
import { useRoleStore } from '/@/stores/role'
import { useSimpleLocale } from '/@/stores/locale'
import { useThemeStore } from '/@/stores/theme'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { isMainWindow } from '/@/utils'
import { getLastRoute, resolveLastRoute } from '/@/utils/lastRoute'
import { isEqual } from 'es-toolkit'
import type { LocationQueryRaw, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { createPerfTimer, perfLog } from '/@/utils/perf-log'

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
  }
}

export type GuardContext = ReturnType<typeof createGuardContext>

type GuardResult = boolean | RouteLocationRaw | undefined

const authWhiteList = ['oauth2callback']

const noTakeQueryList = [OFFICIAL_SITE_LANG, OFFICIAL_SITE_INVITE_CODE, MP_DISTINCT_ID, LOCALE_SWITCH_HANDOFF_TOKEN_QUERY]

/** 冷启动仅尝试恢复一次，避免后续主动进入首页时被覆盖 */
let hasAttemptedRestore = false

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

/** 已完成首次引导的用户不可再访问 before-enter；未完成且有本地进度则强制回到引导 */
function beforeEnterGuard(to: RouteLocationNormalized, ctx: GuardContext): GuardResult {
  const userInfo = ctx.userStore.userInfo

  if (to.name === 'before-enter') {
    if (!userInfo?.id)
      return true
    if (!isGuideIncomplete(userInfo))
      return { name: 'home', query: to.query }
    return true
  }

  if (!ctx.userStore.token)
    return true
  if (to.name === 'login' || authWhiteList.includes(to.name as string))
    return true
  if (!needsBeforeEnterResume(userInfo))
    return true

  return { name: 'before-enter', query: to.query }
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

function restoreRouteGuard(to: RouteLocationNormalized, ctx: GuardContext): GuardResult {
  if (!globalThis.isElectron || !isMainWindow)
    return true

  if (!ctx.userStore.token)
    return true

  if (hasAttemptedRestore)
    return true

  hasAttemptedRestore = true

  if (to.name !== 'home' && to.path !== '/')
    return true

  const fullPath = getLastRoute(ctx.userStore.userInfo.id)
  if (!fullPath)
    return true

  const location = resolveLastRoute(fullPath, getRouter())
  if (!location)
    return true

  return location
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
  const endWaitInit = createPerfTimer('guards:waitInitUserInfo', {
    routeName: String(to.name ?? ''),
    path: to.path,
  })

  await ctx.userStore.hasCallInitUserInfo.promise
  endWaitInit()

  // init 完成后再读，避免 createGuardContext 时 currentWorkspace 尚未赋值
  const currentWorkspace = ctx.workspaceStore.currentWorkspace
  perfLog('guards:initReady', {
    workspaceId: currentWorkspace?.id,
    workspaceType: currentWorkspace?.workspaceType,
  })

  const query = mergeQuery(to)
  const routeContext = buildRouteContext({
    workspaceType: currentWorkspace?.workspaceType,
    workspaceId: currentWorkspace?.id,
    role: currentWorkspace?.role,
    isOwner: ctx.roleStore.isOwner,
  })

  const authResult = authGuard(to, ctx)
  if (authResult !== true)
    return typeof authResult === 'object' ? { ...authResult, query } : authResult

  const permissionResult = permissionGuard(to, ctx)
  if (permissionResult !== true)
    return typeof permissionResult === 'object' ? { ...permissionResult, query } : permissionResult

  const beforeEnterResult = beforeEnterGuard(to, ctx)
  if (beforeEnterResult !== true)
    return typeof beforeEnterResult === 'object' ? { ...beforeEnterResult, query } : beforeEnterResult

  const legacyResult = legacyWorkspaceGuard(to, currentWorkspace?.workspaceType)
  if (legacyResult !== true)
    return typeof legacyResult === 'object' ? { ...legacyResult, query } : legacyResult

  const restoreResult = restoreRouteGuard(to, ctx)
  if (restoreResult !== true) {
    if (typeof restoreResult === 'object') {
      const restoredQuery = typeof restoreResult.query === 'object' ? restoreResult.query : {}
      return {
        ...restoreResult,
        query: {
          ...restoredQuery,
          theme: query.theme,
          language: query.language,
          _title: query._title,
        },
      }
    }
    return restoreResult
  }

  const landingResult = landingGuard(to, currentWorkspace?.workspaceType, currentWorkspace?.role)
  if (landingResult !== true)
    return typeof landingResult === 'object' ? { ...landingResult, query } : landingResult

  const workspaceTypeResult = workspaceTypeGuard(to, routeContext)
  if (workspaceTypeResult !== true)
    return typeof workspaceTypeResult === 'object' ? { ...workspaceTypeResult, query } : workspaceTypeResult

  if (isEqual(to.query, query))
    return true

  return { ...to, query }
}
