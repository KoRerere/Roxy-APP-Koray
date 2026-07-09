import { WorkspaceType } from '/@/enums'
import type { RouteRecordRaw } from 'vue-router'

const ecommerceOnly = [WorkspaceType.ECommerce] as const

export const ecommerceMenuRoutes: RouteRecordRaw[] = [
  {
    path: 'ecommerce/accounts',
    name: 'ecommerce-accounts',
    meta: {
      title: $t('全部账号'),
      icon: 'base/rx_ic_browser',
      workspaceTypes: [...ecommerceOnly],
    },
    redirect: { name: 'ecommerce-account-list' },
    children: [
      {
        path: 'list',
        name: 'ecommerce-account-list',
        meta: {
          title: $t('全部账号'),
          hideInMenu: true,
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/accounts/index.vue'),
      },
    ],
  },
  {
    path: 'ecommerce/groups',
    name: 'ecommerce-groups',
    meta: {
      title: $t('账号分组'),
      icon: 'base/rx_ic_stack',
      permissions: ['Projects_view_page'],
      workspaceTypes: [...ecommerceOnly],
    },
    redirect: { name: 'ecommerce-group-list' },
    children: [
      {
        path: 'list',
        name: 'ecommerce-group-list',
        meta: {
          title: $t('账号分组'),
          hideInMenu: true,
          permissions: ['Projects_view_page'],
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/groups/index.vue'),
      },
      {
        path: ':id',
        name: 'ecommerce-group-item',
        meta: {
          title: $t('账号分组'),
          hideInMenu: true,
          permissions: ['Projects_view_page'],
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/groups/item.vue'),
      },
    ],
  },
  {
    path: 'ecommerce/resource',
    name: 'ecommerce-resource',
    meta: { title: $t('工具'), type: 'group', workspaceTypes: [...ecommerceOnly] },
    children: [
      {
        path: 'devices',
        name: 'ecommerce-device-list',
        meta: {
          title: $t('我的设备'),
          icon: 'base/rx_ic_internet',
          permissions: ['Proxy_List_view_page'],
          permissionMode: 'any',
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/devices/index.vue'),
      },
      {
        path: 'plugins',
        name: 'ecommerce-plugin-list',
        meta: {
          title: $t('插件中心'),
          icon: 'base/rx_ic_extension_store',
          permissions: ['Plugin_Installed_view_page'],
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/plugins/index.vue'),
      },
      {
        path: 'ecosystem',
        name: 'ecosystem-center',
        meta: {
          title: $t('生态中心'),
          icon: 'base/rx_ic_extension_store',
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/ecosystem/index.vue'),
      },
      {
        path: 'marketing',
        name: 'cross-border-marketing',
        meta: {
          title: $t('跨境营销'),
          icon: 'base/rx_ic_internet',
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/marketing/index.vue'),
      },
    ],
  },
]
