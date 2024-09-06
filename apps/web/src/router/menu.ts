import type { RouteRecordRaw } from 'vue-router'

export const menuRoutes: RouteRecordRaw[] = [
  {
    path: '/setting',
    name: 'setting',
    meta: { title: '设置' },
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
  {
    path: '/browser',
    name: 'browser-list',
    meta: { title: '浏览器窗口' },
    component: () => import('/@/views/browser/list'),
  },
  {
    path: '/browser/create',
    name: 'browser-create',
    meta: { title: '新建窗口' },
    component: () => import('/@/views/browser/create'),
  },
  {
    path: '/browser/edit',
    name: 'browser-edit',
    meta: { title: '编辑窗口' },
    component: () => import('/@/views/browser/create/edit.vue'),
  },
  {
    path: '/agent',
    name: 'agent',
    meta: { title: '代理管理x', groupName: 'resources' },
    component: () => import('/@/views/agent/list'),
  },
  {
    path: '/agent/shop',
    name: 'account-shop',
    meta: { title: '代理商店x', groupName: 'resources' },
    component: () => import('/@/views/agent/shop'),
  },
  {
    path: '/account',
    name: 'account',
    meta: { title: '账号库x', groupName: 'resources' },
    component: () => import('/@/views/account/list'),
  },
  {
    path: '/extensions',
    name: 'extensions',
    meta: { title: 'Extensions', groupName: 'Tools' },
    component: () => import('/@/views/extensions'),
    redirect: { name: 'extensions-hub' },
    children: [
      {
        path: 'install',
        name: 'install',
        meta: { title: 'intalled', icon: 'AreaChartOutlined' },
        component: () => import('../views/extensions/install'),
      },
      {
        path: 'hub',
        name: 'extensions-hub',
        meta: { title: 'extensionHub', icon: 'AreaChartOutlined' },
        component: () => import('/@/views/extensions/hub'),
      }
    ]
  }

]
