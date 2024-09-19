import type { RouteRecordRaw } from 'vue-router'

export const baseRoutes: RouteRecordRaw[] = [
  {
    name: 'login',
    path: '/login',
    meta: { title: '登录' },
    component: () => import('/@/views/login/index.vue'),
  },
  {
    name: 'pro-form',
    path: '/pro-form',
    meta: { title: '动态表单' },
    component: () => import('/@/components/rx-form/index.vue'),
  },
]
