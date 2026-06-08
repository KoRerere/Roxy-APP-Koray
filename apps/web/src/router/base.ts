import type { RouteRecordRaw } from 'vue-router'

export const baseRoutes: RouteRecordRaw[] = [
  {
    name: 'login',
    path: '/login',
    meta: { title: '登录' },
    component: () => import('/@/views/login/index.vue'),
  },
  {
    name: '500',
    path: '/500',
    component: () => import('/@/views/500.vue'),
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
  {
    name: 'sync-control-custom-layout-dialog',
    path: '/sync-control-custom-layout-dialog',
    meta: { title: '自定义窗口布局弹窗' },
    component: () => import('../views/sync-control/dialog/preferences-components/custom-layout.vue'),
  },
  {
    name: 'sync-control-batch-inputs-dialog',
    path: '/sync-control-batch-inputs-dialog',
    meta: { title: '自定义窗口布局弹窗' },
    component: () => import('/@/views/sync-control/dialog/batch-inputs.vue'),
  },
  {
    name: 'sync-control-open-sites-dialog',
    path: '/sync-control-open-sites-dialog',
    meta: { title: '打开网址弹窗' },
    component: () => import('/@/views/sync-control/dialog/open-sites.vue'),
  },
  {
    name: 'syncing-window-list-dialog',
    path: '/syncing-window-list-dialog',
    meta: { title: '打开网址弹窗' },
    component: () => import('/@/views/sync-control/dialog/syncing-window-list.vue'),
  },
  {
    name: 'mcp',
    path: '/mcp',
    meta: { title: 'MCP' },
    component: () => import('/@/views/mcp/index.vue'),
    redirect: { name: 'mcp-chat' },
    children: [
      {
        name: 'mcp-chat',
        path: 'chat',
        meta: { title: 'MCP Chat' },
        component: () => import('/@/views/mcp/chat/chat-view.vue'),
      },
      {
        name: 'mcp-settings',
        path: 'settings',
        meta: { title: 'MCP Settings' },
        component: () => import('/@/views/mcp/settings/settings-view.vue'),
      },
      {
        name: 'mcp-skills-store',
        path: 'skills-store',
        meta: { title: 'Skills Store' },
        component: () => import('/@/views/mcp/skills-store/index.vue'),
      },
      {
        name: 'mcp-points',
        path: 'points',
        meta: { title: 'Points' },
        component: () => import('/@/views/mcp/points/points-view.vue'),
      },
      {
        name: 'mcp-scripts',
        path: 'scripts',
        meta: { title: 'MCP Scripts' },
        component: () => import('/@/views/mcp/scripts/scripts-view.vue'),
      },
    ],
  },
]
