import { createRouter, createWebHistory } from 'vue-router'

export const routes = [
  {
    path: '/',
    name: 'browser',
    meta: { title: '浏览器窗口', icon: 'mdi-web' },
    component: () => import('/@/views/browser'),
    children: [
      {
        path: 'list',
        name: 'browser-list',
        meta: { title: '窗口列表', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/browser/list')
      },
      {
        path: 'transfer',
        name: 'browser-transfer',
        meta: { title: '窗口转移', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/browser/transfer')
      },
      {
        path: 'create',
        name: 'browser-create',
        meta: { title: '新建窗口', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/browser/create')
      },
      {
        path: 'recycle',
        name: 'browser-recycle',
        meta: { title: '回收站', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/browser/recycle')
      }
    ]
  },
  {
    path: '/agent',
    name: 'agent',
    meta: { title: '代理IP', icon: 'mdi-web' },
    component: () => import('/@/views/agent'),
    children: [
      {
        path: 'list',
        name: 'agent-list',
        meta: { title: '代理列表', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/agent/list')
      },
      {
        path: 'shop',
        name: 'agent-shop',
        meta: { title: '代理购买', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/agent/shop')
      },
      {
        path: 'import',
        name: 'agent-import',
        meta: { title: '代理导入', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/agent/import')
      }
    ]
  },
  {
    path: '/plugins',
    name: 'plugins',
    meta: { title: '代理IP', icon: 'mdi-web' },
    component: () => import('/@/views/plugins'),
    children: [
      {
        path: 'shop',
        name: 'plugins-shop',
        meta: { title: '扩展推荐', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/plugins/shop')
      },
      {
        path: 'config',
        name: 'plugins-config',
        meta: { title: '扩展配置', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/plugins/config')
      }
    ]
  },
  {
    path: '/team',
    name: 'team',
    meta: { title: '团队管理', icon: 'mdi-web' },
    component: () => import('/@/views/team'),
    children: [
      {
        path: 'user',
        name: 'team-user',
        meta: { title: '成员管理', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/team/user')
      },
      {
        path: 'log',
        name: 'team-log',
        meta: { title: '操作日志', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/team/log')
      }
    ]
  },
  {
    path: '/auto',
    name: 'auto',
    meta: { title: '自动化', icon: 'mdi-web' },
    component: () => import('/@/views/auto'),
    children: [
      {
        path: 'apiConfig',
        name: 'auto-apiConfig',
        meta: { title: 'API配置', icon: 'mdi-window-open-variant' },
        component: () => import('/@/views/auto/api-config')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
