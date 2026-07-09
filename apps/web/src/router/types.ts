import type { Role, WorkspaceType } from '/@/enums'
import type { Permission, PermissionMode } from '/@/hooks/usePermission/type'
import type { SvgNames } from '/@/components/rx-icon'

declare module 'vue-router' {
  interface RouteMeta {
    permissions?: Permission[]
    permissionMode?: PermissionMode
    roles?: Role[]
    hideInMenu?: boolean
    shared?: boolean
    type?: 'group' | 'button' | (string & {})
    /** 菜单按钮动作标识，由 aside-menu 统一 dispatch */
    menuAction?: string
    onClick?: (event: Event) => void | Promise<void>
    icon?: SvgNames
    isRoxyAgent?: boolean
    version?: string[]
    /** 不填 = 所有 workspaceType 可见；普通路由设 [Private]，电商路由设 [ECommerce] */
    workspaceTypes?: WorkspaceType[]
  }
}

export {}
