import type { RouteRecordRaw } from 'vue-router'

export const menuRoutes: RouteRecordRaw[] = [
  {
    path: '/agent/shop',
    name: 'account-shop',
    meta: { title: '代理商店(dome test)x', groupName: 'resources' },
    component: () => import('/@/views/agent/shop'),
  },
  {
    path: 'browser',
    name: 'browser',
    meta: { title: 'All Profiles', icon: 'base/rx_ic_browser' },
    redirect: { name: 'browser-list' },
    children: [
      {
        path: 'list',
        name: 'browser-list',
        meta: { title: '浏览器窗口' },
        component: () => import('/@/views/browser/list'),
      },
      {
        path: 'create',
        name: 'browser-create',
        meta: { title: '新建窗口', hideInMenu: true },
        component: () => import('/@/views/browser/create'),
      },
      {
        path: 'edit',
        name: 'browser-edit',
        meta: { title: '编辑窗口', hideInMenu: true },
        component: () => import('/@/views/browser/create/edit.vue'),
      },
    ],
  },
  {
    path: 'resource',
    name: 'resource',
    meta: { title: 'Resource/Tool' },
    children: [
      {
        path: 'account',
        name: 'account-list',
        meta: { title: 'Accounts', icon: 'base/rx_ic_keys' },
        component: () => import('/@/views/account/list'),
      },
      {
        path: 'agent',
        name: 'agent-list',
        meta: { title: 'Proxies', icon: 'base/rx_ic_internet' },
        component: () => import('/@/views/agent/list'),
      },
      {
        path: 'create',
        name: 'agent-create',
        meta: { title: '新建代理', hideInMenu: true },
        component: () => import('/@/views/agent/create'),
      },
      {
        path: 'shop',
        name: 'account-shop',
        meta: { title: '代理商店(dome test)x', hideInMenu: true },
        component: () => import('/@/views/agent/shop'),
      },
      {
        path: 'extensions',
        name: 'extensions',
        meta: { title: 'Extensions', icon: 'base/rx_ic_extension_store' },
        component: () => import('/@/views/extensions'),
        redirect: { name: 'extensions-hub' },
        children: [
          {
            path: 'install',
            name: 'install',
            meta: { title: 'intalled', icon: 'base/AreaChartOutlined' },
            component: () => import('../views/extensions/install'),
          },
          {
            path: 'hub',
            name: 'extensions-hub',
            meta: { title: 'extensionHub', icon: 'base/AreaChartOutlined' },
            component: () => import('/@/views/extensions/hub'),
          },
        ],
      },
      {
        path: 'rpa',
        name: 'rpa',
        meta: { title: 'RPAs', icon: 'base/rx_ic_browser_smile' },
        component: () => import('/@/views/agent/shop'),
      },
    ],
  },
  {
    path: 'workspace',
    name: 'workspace',
    meta: { title: 'workspace' },
    redirect: { name: 'teams' },
    children: [
      {
        path: 'teams',
        name: 'teams',
        meta: { title: 'Teams', icon: 'base/rx_ic_user' },
        component: () => import('/@/views/setting/profile.vue'),
      },
      {
        path: 'history-logs',
        name: 'history-logs',
        meta: { title: 'History-Logs', icon: 'base/rx_ic_doc_data' },
        component: () => import('/@/views/setting/profile.vue'),
      },
      {
        path: 'settings',
        name: 'settings',
        meta: { title: 'Settings', icon: 'base/rx_ic_gear' },
        redirect: { name: 'profile' },
        component: () => import('/@/views/setting/index.vue'),
        children: [
          {
            path: 'profile',
            name: 'profile',
            meta: { title: '个人信息' },
            component: () => import('/@/views/setting/profile.vue'),
          },
          {
            path: 'soft-config',
            name: 'soft-config',
            meta: { title: '软件设置' },
            component: () => import('/@/views/setting/soft-config.vue'),
          },
        ],
      },
    ],
  },
]
