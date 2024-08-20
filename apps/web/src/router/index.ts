import { createRouter, createWebHistory } from 'vue-router'

export const routes = [
  {
    path: '/',
    name: 'browser',
    meta: { title: '浏览器窗口', icon: 'AreaChartOutlined', root: true },
    component: () => import('/@/views/browser'),
    children: [
      {
        path: 'list',
        name: 'browser-list',
        meta: { title: '窗口列表', icon: 'AreaChartOutlined' },
        component: () => import('/@/views/browser/list')
      },
      {
        path: 'transfer',
        name: 'browser-transfer',
        meta: { title: '窗口转移', icon: 'PieChartOutlined' },
        component: () => import('/@/views/browser/transfer')
      },
      {
        path: 'create',
        name: 'browser-create',
        meta: { title: '新建窗口', icon: 'BarChartOutlined' },
        component: () => import('/@/views/browser/create')
      },
      {
        path: 'recycle',
        name: 'browser-recycle',
        meta: { title: '回收站', icon: 'DotChartOutlined' },
        component: () => import('/@/views/browser/recycle')
      }
    ]
  },
  {
    path: '/agent',
    name: 'agent',
    meta: { title: '代理IP', icon: 'PieChartOutlined', root: true },
    component: () => import('/@/views/agent'),
    children: [
      {
        path: 'list',
        name: 'agent-list',
        meta: { title: '代理列表', icon: '' },
        component: () => import('/@/views/agent/list')
      },
      {
        path: 'shop',
        name: 'agent-shop',
        meta: { title: '代理购买', icon: '' },
        component: () => import('/@/views/agent/shop')
      },
      {
        path: 'import',
        name: 'agent-import',
        meta: { title: '代理导入', icon: '' },
        component: () => import('/@/views/agent/import')
      }
    ]
  }
  // {
  //   path: '/plugins',
  //   name: 'plugins',
  //   meta: { title: '代理IP', icon: 'BarChartOutlined', root: true },
  //   component: () => import('/@/views/plugins'),
  //   children: [
  //     {
  //       path: 'shop',
  //       name: 'plugins-shop',
  //       meta: { title: '扩展推荐', icon: '' },
  //       component: () => import('/@/views/plugins/shop'),
  //     },
  //     {
  //       path: 'config',
  //       name: 'plugins-config',
  //       meta: { title: '扩展配置', icon: '' },
  //       component: () => import('/@/views/plugins/config'),
  //     },
  //   ],
  // },
  // {
  //   path: '/team',
  //   name: 'team',
  //   meta: { title: '团队管理', icon: 'DotChartOutlined', root: true },
  //   component: () => import('/@/views/team'),
  //   children: [
  //     {
  //       path: 'user',
  //       name: 'team-user',
  //       meta: { title: '成员管理', icon: '' },
  //       component: () => import('/@/views/team/user'),
  //     },
  //     {
  //       path: 'log',
  //       name: 'team-log',
  //       meta: { title: '操作日志', icon: '' },
  //       component: () => import('/@/views/team/log'),
  //     },
  //   ],
  // },
  // {
  //   path: '/auto',
  //   name: 'auto',
  //   meta: { title: '自动化', icon: 'LineChartOutlined', root: true },
  //   component: () => import('/@/views/auto'),
  // },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
