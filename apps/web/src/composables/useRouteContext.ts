import { Role, WorkspaceType } from '/@/enums'
import { isLegacyPublicMember } from '/@/domain/workspace-routing'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { isPrivateWorkspace, normalizeWorkspaceType } from '/@/utils/workspace-mode'

export interface RouteContext {
  workspaceType: WorkspaceType
  workspaceId?: number
  isOwner: boolean
  isEcommerce: boolean
  isNormal: boolean
  /** @legacy Public 工作区非 Owner 成员 */
  isPublicMember: boolean
}

export function buildRouteContext(options: {
  workspaceType?: WorkspaceType
  workspaceId?: number
  role?: Role
  isOwner?: boolean
}): RouteContext {
  const workspaceType = normalizeWorkspaceType(options.workspaceType)
  const isOwner = options.isOwner ?? options.role === Role.OWNER

  return {
    workspaceType,
    workspaceId: options.workspaceId,
    isOwner,
    isEcommerce: workspaceType === WorkspaceType.ECommerce,
    isNormal: isPrivateWorkspace(workspaceType),
    isPublicMember: isLegacyPublicMember(workspaceType, options.role),
  }
}

export function useRouteContext() {
  const { isOwner } = storeToRefs(useRoleStore())
  const { currentWorkspace } = storeToRefs(useWorkspaceStore())

  const ctx = computed<RouteContext>(() => buildRouteContext({
    workspaceType: currentWorkspace.value?.workspaceType,
    workspaceId: currentWorkspace.value?.id,
    role: currentWorkspace.value?.role,
    isOwner: isOwner.value,
  }))

  const workspaceType = computed(() => ctx.value.workspaceType)
  const isEcommerce = computed(() => ctx.value.isEcommerce)
  const isNormal = computed(() => ctx.value.isNormal)
  const isPublicMember = computed(() => ctx.value.isPublicMember)

  return {
    ctx,
    workspaceType,
    isEcommerce,
    isNormal,
    isPublicMember,
  }
}
