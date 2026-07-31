import { WorkspaceType } from '/@/enums'
import type { RouteRecordRaw } from 'vue-router'
import { roxyGeoRoute } from './menu-shared'

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
      {
        path: 'create',
        name: 'ecommerce-account-create',
        meta: {
          title: $t('创建账号'),
          permissions: ['Profiles_add'],
          hideInMenu: true,
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/accounts/account-create.vue'),
      },
      {
        path: 'edit',
        name: 'ecommerce-account-edit',
        meta: {
          title: $t('编辑账号'),
          permissions: ['Profiles_edit'],
          hideInMenu: true,
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/accounts/account-edit.vue'),
      },
    ],
  },
  {
    path: 'ecommerce/groups',
    name: 'ecommerce-groups',
    meta: {
      title: $t('分组管理'),
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
          title: $t('分组管理'),
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
          title: $t('分组管理'),
          hideInMenu: true,
          permissions: ['Projects_view_page'],
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/groups/item.vue'),
      },
    ],
  },
  {
    path: 'ecommerce/devices',
    name: 'ecommerce-devices',
    meta: {
      title: $t('设备管理'),
      icon: 'base/rx_ic_internet',
      permissions: ['Proxy_List_view_page'],
      permissionMode: 'any',
      workspaceTypes: [...ecommerceOnly],
    },
    redirect: { name: 'ecommerce-device-list' },
    children: [
      {
        path: 'list',
        name: 'ecommerce-device-list',
        meta: {
          title: $t('设备管理'),
          hideInMenu: true,
          permissions: ['Proxy_List_view_page'],
          permissionMode: 'any',
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/devices/index.vue'),
      },
      {
        path: 'create',
        name: 'ecommerce-device-create',
        meta: {
          title: $t('添加设备'),
          permissions: ['Proxy_List_add'],
          hideInMenu: true,
          workspaceTypes: [...ecommerceOnly],
        },
        component: () => import('/@/views/ecommerce/devices/device-create.vue'),
      },
    ],
  },
  {
    path: 'ecommerce/resource',
    name: 'ecommerce-resource',
    meta: { title: $t('工具'), type: 'group', workspaceTypes: [...ecommerceOnly] },
    children: [
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
      // {
      //   path: 'ecosystem',
      //   name: 'ecosystem-center',
      //   meta: {
      //     title: $t('生态中心'),
      //     icon: 'base/rx_ic_extension_store',
      //     workspaceTypes: [...ecommerceOnly],
      //   },
      //   component: () => import('/@/views/ecommerce/ecosystem/index.vue'),
      // },
      roxyGeoRoute,
    ],
  },
]
