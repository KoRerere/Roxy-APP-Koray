import { usePermissionStore } from '/@/stores/permission.ts'
import type { Permission, PermissionMode } from '/@/hooks/usePermission/type'

export function usePermission() {
  const store = usePermissionStore()

  function can(permission: Permission): boolean {
    return store.can(permission)
  }

  function cannot(permission: Permission): boolean {
    return store.cannot(permission)
  }

  function canAny(permissions: readonly Permission[]): boolean {
    return store.canAny(permissions)
  }

  function canAll(permissions: readonly Permission[]): boolean {
    return store.canAll(permissions)
  }

  function check(
    target: Permission | readonly Permission[] | undefined,
    mode: PermissionMode = 'all',
  ): boolean {
    return store.check(target, mode)
  }

  return {
    can,
    cannot,
    canAny,
    canAll,
    check,
  }
}
