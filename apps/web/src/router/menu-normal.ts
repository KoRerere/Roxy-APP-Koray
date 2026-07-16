import type { RouteRecordRaw } from 'vue-router'
import { WorkspaceType } from '/@/enums'

const privateOnly = [WorkspaceType.Private] as const

export const normalMenuRoutes: RouteRecordRaw[] = [
  {
    path: 'browser',
    name: 'browser',
    meta: { title: $t('全部窗口'), icon: 'base/rx_ic_browser', workspaceTypes: [...privateOnly] },
    redirect: { name: 'browser-list' },
    children: [
      {
        path: 'list',
        name: 'browser-list',
        meta: { title: $t('全部窗口'), hideInMenu: true, workspaceTypes: [...privateOnly] },
        component: () => import('/@/views/browser/list'),
      },
      {
        path: 'create',
        name: 'browser-create',
        meta: {
          title: '新建窗口',
          permissions: ['Profiles_add'],
          hideInMenu: true,
          workspaceTypes: [...privateOnly],
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
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/browser/create/edit.vue'),
      },
    ],
  },
  {
    path: 'projects',
    name: 'projects',
    meta: {
      title: $t('项目管理'),
      icon: 'base/rx_ic_stack',
      permissions: ['Projects_view_page'],
      workspaceTypes: [...privateOnly],
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
          workspaceTypes: [...privateOnly],
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
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/projects/project-item.vue'),
      },
    ],
  },
  {
    path: 'resource',
    name: 'resource',
    meta: { title: $t('工具'), type: 'group', workspaceTypes: [...privateOnly] },
    children: [
      {
        path: 'agent',
        name: 'agent-list',
        meta: {
          title: $t('代理 IP'),
          icon: 'base/rx_ic_internet',
          permissions: ['Proxy_List_view_page'],
          permissionMode: 'any',
          slotName: 'proxy',
          workspaceTypes: [...privateOnly],
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
          workspaceTypes: [...privateOnly],
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
          workspaceTypes: [...privateOnly],
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
          workspaceTypes: [...privateOnly],
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
          workspaceTypes: [...privateOnly],
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
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/extensions'),
      },
      {
        path: 'roxy-geo',
        name: 'roxy-geo',
        meta: {
          title: $t('跨境营销'),
          icon: 'websites/rx_accounts_tiktok',
          type: 'button',
          external: true,
          showFireBadge: true,
          locales: ['zh'],
          workspaceTypes: [...privateOnly],
          onClick: async () => {
            const userStore = await import('/@/stores/user').then(m => m.useUserStore())
            const simpleLocale = await import('/@/stores/locale').then(m => m.useSimpleLocale())
            const base = import.meta.env.VITE_OFFICIAL_WEBSITE_ZH.replace(/\/$/, '')
            const url = `${base}/roxy-geo/?roxy-geo-token=${userStore.token}&roxy-geo-locale=${simpleLocale.currentLocale}`
            window.open(url, '_blank')
          },
        },
        component: () => import('/@/views/extensions'),
      },
    ],
  },
]
