import type { RouteRecordRaw } from 'vue-router'
import { Role } from '/@/enums'
import { emitter } from '/@/utils/eventBus'
import { API } from '/@/api'
import { I18nT } from 'vue-i18n'
import { useRoleStore } from '/@/stores/role'
import { useUserStore } from '/@/stores/user'
import { switchWorkspaceAndToUpgradePlan } from '/@/hooks/useResponseToast/handleBusinessCode'
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
    icon?: SvgNames
  }
}

export const menuRoutes: RouteRecordRaw[] = [
  {
    path: 'browser',
    name: 'browser',
    meta: { title: $t('全部窗口'), icon: 'base/rx_ic_browser' },
    redirect: { name: 'browser-list' },
    children: [
      {
        path: 'list',
        name: 'browser-list',
        meta: { title: $t('全部窗口'), hideInMenu: true },
        component: () => import('/@/views/browser/list'),
      },
      {
        path: 'create',
        name: 'browser-create',
        meta: {
          title: '新建窗口',
          permissions: ['Profiles_add'],
          hideInMenu: true,
        },
        component: () => import('/@/views/browser/create'),
      },
      {
        path: 'edit',
        name: 'browser-edit',
        meta: {
          title: '编辑窗口',
          permissions: ['Profiles_edit'],
          hideInMenu: true,
        },
        component: () => import('/@/views/browser/create/edit.vue'),
      },
    ],
  },
  {
    path: 'shared',
    name: 'shared',
    meta: { title: $t('共享窗口'), icon: 'base/rx_ic_browser', hideInMenu: true, shared: true },
    component: () => import('/@/views/browser/shared'),
  },
  {
    path: 'projects',
    name: 'projects',
    meta: {
      title: $t('项目管理'),
      icon: 'base/rx_ic_stack',
      permissions: ['Projects_view_page'],
    },
    redirect: { name: 'project-list' },
    children: [
      {
        path: 'list',
        name: 'project-list',
        meta: {
          title: '项目列表',
          hideInMenu: true,
          permissions: ['Projects_view_page'],
        },
        component: () => import('/@/views/projects/index.vue'),
      },
      {
        path: ':id',
        name: 'project-item',
        meta: {
          title: '项目',
          hideInMenu: true,
          permissions: ['Projects_view_page'],
        },
        component: () => import('/@/views/projects/project-item.vue'),
      },
    ],
  },
  {
    path: 'resource',
    name: 'resource',
    meta: { title: $t('工具'), type: 'group' },
    children: [
      {
        path: 'agent',
        name: 'agent-list',
        meta: {
          title: $t('代理 IP'),
          icon: 'base/rx_ic_internet',
          permissions: ['Proxy_List_view_page', 'Proxy_Store_view_page'],
          permissionMode: 'any',
        },
        component: () => import('/@/views/agent'),
      },
      {
        path: 'create',
        name: 'agent-create',
        meta: {
          title: $t('新建代理 IP'),
          hideInMenu: true,
          permissions: ['Proxy_List_add'],
        },
        component: () => import('/@/views/agent/create'),
      },
      {
        path: 'account',
        name: 'account-list',
        meta: {
          title: $t('平台账号'),
          icon: 'base/rx_ic_keys',
          permissions: ['Platform_view_page'],
        },
        component: () => import('/@/views/account/list'),
      },
      {
        path: 'accountcreate',
        name: 'account-create',
        meta: {
          title: $t('新建账号'),
          hideInMenu: true,
          permissions: ['Platform_add'],
        },
        component: () => import('/@/views/account/create'),
      },
      {
        path: 'cattle-slaughter',
        name: 'cattle-slaughter',
        meta: {
          title: '牛马屠宰场',
          icon: 'base/rx_ic_keys',
          hideInMenu: true,
        },
        component: () => import('/@/views/lab'),
      },
      {
        path: 'extensions',
        name: 'extensions',
        meta: {
          title: $t('扩展中心'),
          icon: 'base/rx_ic_extension_store',
          permissions: ['Plugin_Installed_view_page'],
        },
        component: () => import('/@/views/extensions'),
      },
    ],
  },
  {
    path: 'automation',
    name: 'automation',
    meta: { title: $t('自动化'), type: 'group' },
    children: [
      {
        path: 'roxy-claw',
        name: 'roxy-claw',
        meta: {
          title: 'RoxyClaw',
          icon: 'base/rx_ic_roxy_claw',
          isRoxyClaw: true,
          permissions: ['API_MCP_view_page'],
        },
        redirect: { name: 'roxy-claw-home' },
        children: [
          {
            path: 'roxy-claw/home',
            name: 'roxy-claw-home',
            meta: {
              title: 'Claw',
              hideInMenu: true,
              isRoxyClaw: true,
              permissions: ['API_MCP_view_page'],
            },
            component: () => import('/@/views/roxy-claw'),
          },
          {
            path: 'roxy-claw/telegram',
            name: 'roxy-claw-telegram',
            meta: {
              title: 'Telegram Bot',
              hideInMenu: true,
              isRoxyClaw: true,
              permissions: ['API_MCP_view_page'],
            },
            component: () => import('/@/views/roxy-claw/telegram-config.vue'),
          },
          {
            path: 'roxy-claw/lark',
            name: 'roxy-claw-lark',
            meta: {
              title: 'Lark / Feishu Bot',
              hideInMenu: true,
              isRoxyClaw: true,
              permissions: ['API_MCP_view_page'],
            },
            component: () => import('/@/views/roxy-claw/lark-config.vue'),
          },
        ],
      },
      {
        path: 'sync-control',
        name: 'sync-control',
        meta: {
          title: $t('窗口同步'),
          type: 'button',
          icon: 'base/rx_ic_frame_stack',
          hideInMenu: !navigator.platform.includes('Win'),
          onClick: async (event: Event) => {
            const { isOwner } = useRoleStore()
            const { mixpanelTrack } = useUserStore()
            const { code } = await API.pay.userCheckTeamUserRightsList()
            if (code !== 0) {
              if (!isOwner) {
                emitter.emit('showToast', {
                  severity: 'warn',
                  summary: $t('窗口同步不可用'),
                  detail: h(I18nT, {
                    keypath: $t('窗口同步不可用，请联系空间的拥有者进行升级，或{link}以激活该跨空间功能。', { link: '{link}' }),
                  }, {
                    link: () => h('a', {
                      class: 'cursor-pointer',
                      onClick: switchWorkspaceAndToUpgradePlan,
                    }, $t('前往升级您的权益')),
                  }),
                  life: 5000,
                })
              }
              else {
                emitter.emit('showPayWall', {
                  event,
                  params: {
                    type: 'synchronizer',
                  },
                })
              }
              return
            }

            mixpanelTrack('synchronizer_open')
            console.log('sync-control')
            globalThis.electronAPI.send('syncControl:open', isOwner)
          },
        },
        component: () => import('/@/views/api-keys'),
      },
      {
        path: 'api-keys',
        name: 'api-keys',
        meta: {
          title: 'API & AI MCP',
          icon: 'base/rx_ic_doc_code',
          permissions: ['API_MCP_view_page'],
        },
        component: () => import('/@/views/api-keys'),
      },
    ],
  },
  {
    path: 'workspace',
    name: 'workspace',
    meta: { title: $t('团队协作'), type: 'group' },
    redirect: { name: 'teams' },
    children: [
      {
        path: 'teams',
        name: 'teams',
        meta: {
          title: $t('团队'),
          icon: 'base/rc_ic_user_referral',
          permissions: ['Team_Member_view_page'],
        },
        component: () => import('/@/views/team'),
      },
    ],
  },
  {
    name: 'subscribe-plan',
    path: 'subscribe-plan',
    meta: {
      title: $t('选择套餐'),
      icon: 'base/rx_ic_wallet',
      hideInMenu: true,
      roles: [Role.OWNER],
    },
    component: () => import('/@/views/pay/subscribe'),
  },
  {
    name: 'upgrade-plan',
    path: 'upgrade-plan',
    meta: {
      title: $t('更改套餐'),
      icon: 'base/rx_ic_wallet',
      hideInMenu: true,
      roles: [Role.OWNER],
    },
    component: () => import('/@/views/pay/subscribe/upgrade-plan.vue'),
  },
  {
    name: 'wallet',
    path: 'wallet',
    meta: {
      title: $t('费用中心'),
      icon: 'base/rx_ic_wallet',
      hideInMenu: true,
      roles: [Role.OWNER],
    },
    component: () => import('/@/views/pay/wallet'),
  },
  {
    name: 'tutorial',
    path: 'tutorial',
    meta: {
      title: $t('新手教程'),
      icon: 'base/rx_ic_wallet',
      hideInMenu: true,
    },
    component: () => import('/@/views/tutorial'),
  },
]
