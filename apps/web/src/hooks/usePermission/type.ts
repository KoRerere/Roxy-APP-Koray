export const PERMISSION_EFFECTS = ['allow', 'deny'] as const
export const PERMISSION_MODES = ['any', 'all'] as const

export type PermissionEffect = (typeof PERMISSION_EFFECTS)[number]
export type PermissionMode = (typeof PERMISSION_MODES)[number]
export type Permission = string

export interface PermissionRule {
  permission: Permission
  effect?: PermissionEffect
}

export type PermissionEntry = Permission | PermissionRule

export interface BackendPermissionItem {
  permissionCode: Permission
  permissionName: string
  configurable: number
  hasPermission: boolean
}

export interface BackendPermissionModule {
  moduleName: string
  permissions: BackendPermissionItem[]
}
