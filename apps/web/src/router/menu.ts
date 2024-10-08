import type { RouteRecordRaw } from 'vue-router'
import { Role } from '/@/enums'
import { $t } from '/@/locales'

export const menuRoutes: RouteRecordRaw[] = [
  {
    path: 'browser',
    name: 'browser',
    meta: { title: $t('menus.AllProfiles'), icon: 'base/rx_ic_browser' },
    redirect: { name: 'browser-list' },
    children: [
      {
        path: 'list',
        name: 'browser-list',
        meta: { title: '浏览器窗口', hideInMenu: true },
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
    path: 'projects',
    name: 'projects',
    meta: { title: $t('menus.Projects'), icon: 'base/rx_ic_stack' },
    redirect: { name: 'project-list' },
    children: [
      {
        path: 'list',
        name: 'project-list',
        meta: { title: '项目列表', hideInMenu: true },
        component: () => import('/@/views/projects/index.vue'),
      },
      {
        path: ':id',
        name: 'project-item',
        meta: { title: '浏览器窗口', hideInMenu: true },
        component: () => import('/@/views/projects/project-item.vue'),
      },
    ],
  },
  {
    path: 'resource',
    name: 'resource',
    meta: { title: 'Resource/Tool', type: 'group' },
    children: [
      {
        path: 'account',
        name: 'account-list',
        meta: { title: $t('menus.Accounts'), icon: 'base/rx_ic_keys' },
        component: () => import('/@/views/account/list'),
      },
      {
        path: 'agent',
        name: 'agent-list',
        meta: { title: $t('menus.Proxies'), icon: 'base/rx_ic_internet' },
        component: () => import('/@/views/agent/list'),
      },
      {
        path: 'create',
        name: 'agent-create',
        meta: { title: '新建代理', hideInMenu: true },
        component: () => import('/@/views/agent/create'),
      },
      // {
      //   path: 'shop',
      //   name: 'account-shop',
      //   meta: { title: '代理商店(dome test)x', hideInMenu: false },
      //   component: () => import('/@/views/agent/shop'),
      // },
      {
        path: 'extensions',
        name: 'extensions',
        meta: { title: $t('menus.Extensions'), icon: 'base/rx_ic_extension_store' },
        component: () => import('/@/views/extensions'),
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
    meta: { title: 'workspace', type: 'group' },
    redirect: { name: 'teams' },
    children: [
      {
        path: 'teams',
        name: 'teams',
        meta: { title: $t('menus.Teams'), icon: 'base/rx_ic_user' },
        component: () => import('/@/views/team'),
      },
      {
        path: 'history-logs',
        name: 'history-logs',
        meta: { title: $t('menus.HistoryLogs'), icon: 'base/rx_ic_doc_data', roles: [Role.EDITOR, Role.MANAGER, Role.OWNER] },
        component: () => import('/@/views/history-logs'),
      },
      {
        path: 'settings',
        name: 'settings',
        meta: { title: $t('menus.Settings'), icon: 'base/rx_ic_gear', roles: [Role.OWNER] },
        component: () => import('/@/views/workspace-setting/index.vue'),
      },
    ],
  },
  {
    path: 'api-keys',
    name: 'api-keys',
    meta: { title: $t('menus.Api-keys'), icon: 'base/rx_ic_doc_code' },
    component: () => import('/@/views/api-keys'),
  },
]
