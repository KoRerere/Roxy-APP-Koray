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
  {
    name: 'sync-control-synchronizer',
    path: '/sync-control-synchronizer',
    meta: { title: '同步器' },
    component: () => import('/@/views/sync-control/synchronizer/index.vue'),
  },
  {
    name: 'sync-control-action-bar',
    path: '/sync-control-action-bar',
    meta: { title: '同步器' },
    component: () => import('/@/views/sync-control/action-bar/index.vue'),
  },
  {
    name: 'sync-control-preferences-dialog',
    path: '/sync-control-preferences-dialog',
    meta: { title: '同步器偏好设置弹窗' },
    component: () => import('/@/views/sync-control/dialog/preferences.vue'),
  },
]
