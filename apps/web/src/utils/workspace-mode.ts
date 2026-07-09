import { WorkspaceType } from '/@/enums'

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
