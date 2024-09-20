import type { RouteRecordRaw } from 'vue-router'

export const baseRoutes: RouteRecordRaw[] = [
  {
    name: 'login',
    path: '/login',
    meta: { title: '登录' },
    component: () => import('/@/views/login/index.vue'),
  },
  {
    name: 'rx-form',
    path: '/rx-form',
    meta: { title: '动态表单' },
    component: () => import('../components/rx-form/demos/index.vue'),
  },
]
