import { WorkspaceType } from '/@/enums'
import { useWorkspaceStore } from '/@/stores/workspace'

export { getWorkspaceTypeLandingRoute } from '/@/domain/workspace-routing'

export function normalizeWorkspaceType(type?: WorkspaceType): WorkspaceType {
  if (type === WorkspaceType.ECommerce)
    return WorkspaceType.ECommerce
  if (type === WorkspaceType.Public)
    return WorkspaceType.Public
  return WorkspaceType.Private
}

export function isEcommerceWorkspace(type?: WorkspaceType) {
  return normalizeWorkspaceType(type) === WorkspaceType.ECommerce
}

export function isPrivateWorkspace(type?: WorkspaceType) {
  return normalizeWorkspaceType(type) === WorkspaceType.Private
}

/** 当前 workspace 是否为电商模式（电商无窗口额度与套餐升级弹窗语义） */
export function isCurrentEcommerceWorkspace() {
  return isEcommerceWorkspace(useWorkspaceStore().currentWorkspace?.workspaceType)
}
