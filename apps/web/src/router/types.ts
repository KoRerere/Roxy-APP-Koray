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
    type?: 'group' | 'flat' | 'button' | (string & {})
    /** 菜单按钮动作标识，由 aside-menu 统一 dispatch */
    menuAction?: string
    onClick?: (event: Event) => void | Promise<void>
    icon?: SvgNames
    isRoxyAgent?: boolean
    isRoxyClaw?: boolean
    version?: string[]
    /** 不填 = 所有 workspaceType 可见；普通路由设 [Private]，电商路由设 [ECommerce] */
    workspaceTypes?: WorkspaceType[]
    /** 侧边栏外链标识，用于展示右上角外链箭头 */
    external?: boolean
    /** 限制可见语言（主语言码，如 zh / en / ru）；不填则所有语言可见 */
    locales?: string[]
    /** 菜单标题旁展示火焰徽章 */
    showFireBadge?: boolean
    /** Show a New badge beside the menu title. */
    showNewBadge?: boolean
    slotName?: string
  }
}

export {}
