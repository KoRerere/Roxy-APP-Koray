import { defineStore } from 'pinia'
import type {
  Permission,
  PermissionEffect,
  PermissionEntry,
  PermissionMode,
  PermissionRule,
} from '/@/hooks/usePermission/type'

import type { UnwrapRowsType, UserGetTeamPermissionsListData } from '@roxy/backend-api'

interface PermissionIndex {
  exact: Set<string>
}

type NormalizedPermissionRule = Required<PermissionRule>

function createPermissionIndex(): PermissionIndex {
  return {
    exact: new Set(),
  }
}

function normalizePermissionEntry(entry: PermissionEntry): NormalizedPermissionRule {
  if (typeof entry === 'string') {
    return { permission: entry, effect: 'allow' }
  }

  return {
    permission: entry.permission,
    effect: entry.effect ?? 'allow',
  }
}

function addPermissionToIndex(index: PermissionIndex, permission: Permission) {
  index.exact.add(permission)
}

function matchesPermissionIndex(index: PermissionIndex, permission: Permission): boolean {
  return index.exact.has(permission)
}

function resolvePermissionEffect(rule: NormalizedPermissionRule): PermissionEffect {
  return rule.effect
}

function normalizeBackendModules(modules: UnwrapRowsType<UserGetTeamPermissionsListData>): PermissionEntry[] {
  return modules.flatMap(module =>
    module.permissions
      .filter(permission => permission.hasPermission)
      .map(permission => permission.permissionCode),
  )
}

export const usePermissionStore = defineStore('permission', () => {
  const permissions = ref<PermissionEntry[]>([])

  const allPermissionRules = computed<NormalizedPermissionRule[]>(() => {
    return permissions.value.map(normalizePermissionEntry)
  })

  const permissionIndex = computed(() => {
    const allow = createPermissionIndex()
    const deny = createPermissionIndex()

    for (const rule of allPermissionRules.value) {
      addPermissionToIndex(resolvePermissionEffect(rule) === 'deny' ? deny : allow, rule.permission)
    }

    return { allow, deny }
  })

  function can(permission: Permission): boolean {
    const { allow, deny } = permissionIndex.value
    return matchesPermissionIndex(allow, permission) && !matchesPermissionIndex(deny, permission)
  }

  function cannot(permission: Permission): boolean {
    return !can(permission)
  }

  function canAny(permissions: readonly Permission[]): boolean {
    if (permissions.length === 0)
      return false
    return permissions.some(permission => can(permission))
  }

  function canAll(permissions: readonly Permission[]): boolean {
    if (permissions.length === 0)
      return false
    return permissions.every(permission => can(permission))
  }

  function check(
    target: Permission | readonly Permission[] | undefined,
    mode: PermissionMode = 'all',
  ): boolean {
    if (!target)
      return false
    if (typeof target === 'string')
      return can(target)

    return mode === 'all' ? canAll(target) : canAny(target)
  }

  function setPermissions(data: UnwrapRowsType<UserGetTeamPermissionsListData>) {
    permissions.value = normalizeBackendModules(data)
  }

  function resetPermissions() {
    permissions.value = []
  }

  return {
    can,
    cannot,
    canAny,
    canAll,
    check,
    setPermissions,
    resetPermissions,
  }
}, {
  persist: false,
})
