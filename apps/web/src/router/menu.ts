import type { RouteRecordRaw } from 'vue-router'

export const menuRoutes: RouteRecordRaw[] = [
  {
    path: '/browser',
    name: 'browser',
    meta: { title: '浏览器窗口' },
    component: () => import('/@/views/browser'),
    redirect: { name: 'browser-list' },
    children: [
      {
        path: 'list',
        name: 'browser-list',
        meta: { title: '窗口列表', icon: 'AreaChartOutlined' },
        component: () => import('/@/views/browser/list'),
      },
      {
        path: 'transfer',
        name: 'browser-transfer',
        meta: { title: '窗口转移', icon: 'PieChartOutlined' },
        component: () => import('/@/views/browser/transfer'),
      },
      {
        path: 'recycle',
        name: 'browser-recycle',
        meta: { title: '回收站', icon: 'DotChartOutlined' },
        component: () => import('/@/views/browser/recycle'),
      },
    ],
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
    meta: { title: '代理管理', groupName: 'resources' },
    component: () => import('/@/views/agent/list'),
  },
  {
    path: '/agent/shop',
    name: 'account-shop',
    meta: { title: '代理商店', groupName: 'resources' },
    component: () => import('/@/views/agent/shop'),
  },
  {
    path: '/account',
    name: 'account',
    meta: { title: '账号库', groupName: 'resources' },
    component: () => import('/@/views/account/list'),
  },
]
