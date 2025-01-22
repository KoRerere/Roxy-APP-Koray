import type { RouteRecordRaw } from 'vue-router'
import { Role } from '/@/enums'
import { $t } from '/@/locales'
import { isWindows } from '/@/utils'

export const getMenuRoutes = (): RouteRecordRaw[] => [
  {
    path: 'browser',
    name: 'browser',
    meta: { title: $t('全部窗口'), icon: 'base/rx_ic_browser' },
    redirect: { name: 'browser-list' },
    children: [
      {
        path: 'list',
        name: 'browser-list',
        meta: { title: $t('全部窗口'), hideInMenu: true },
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
    meta: { title: $t('项目管理'), icon: 'base/rx_ic_stack' },
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
        meta: { title: '项目', hideInMenu: true },
        component: () => import('/@/views/projects/project-item.vue'),
      },
    ],
  },
  {
    path: 'resource',
    name: 'resource',
    meta: { title: $t('资源'), type: 'group' },
    children: [
      {
        path: 'account',
        name: 'account-list',
        meta: { title: $t('平台账号'), icon: 'base/rx_ic_keys', roles: [Role.EDITOR, Role.MANAGER, Role.OWNER] },
        component: () => import('/@/views/account/list'),
      },
      {
        path: 'agent',
        name: 'agent-list',
        meta: { title: $t('代理资源'), icon: 'base/rx_ic_internet', roles: [Role.EDITOR, Role.MANAGER, Role.OWNER] },
        component: () => import('/@/views/agent/list'),
      },
      {
        path: 'create',
        name: 'agent-create',
        meta: { title: $t('新建代理'), hideInMenu: true },
        component: () => import('/@/views/agent/create'),
      },
      {
        path: 'cattle-slaughter',
        name: 'cattle-slaughter',
        meta: { title: '牛马屠宰场', icon: 'base/rx_ic_keys', hideInMenu: true },
        component: () => import('/@/views/lab'),
      },
      {
        path: 'extensions',
        name: 'extensions',
        meta: { title: $t('扩展中心'), icon: 'base/rx_ic_extension_store' },
        component: () => import('/@/views/extensions'),
      },
      // {
      //   path: 'rpa',
      //   name: 'rpa',
      //   meta: { title: $t('#RPA'), icon: 'base/rx_ic_browser_smile' },
      //   component: () => import('/@/views/agent/shop'),
      // },
    ],
  },
  {
    path: 'workspace',
    name: 'workspace',
    meta: { title: $t('工作空间'), type: 'group' },
    redirect: { name: 'teams' },
    children: [
      {
        path: 'teams',
        name: 'teams',
        meta: { title: $t('团队成员'), icon: 'base/rx_ic_user' },
        component: () => import('/@/views/team'),
      },
      {
        path: 'history-logs',
        name: 'history-logs',
        meta: { title: $t('操作日志'), icon: 'base/rx_ic_doc_data', roles: [Role.MANAGER, Role.OWNER] },
        component: () => import('/@/views/history-logs'),
      },
      {
        path: 'settings',
        name: 'settings',
        meta: { title: $t('空间设置'), icon: 'base/rx_ic_gear' },
        component: () => import('/@/views/workspace-setting/index.vue'),
      },
    ],
  },
  {
    path: 'automation',
    name: 'automation',
    meta: { title: $t('自动化'), type: 'group' },
    children: [
      {
        path: 'sync-control',
        name: 'sync-control',
        meta: {
          title: $t('窗口同步'),
          type: 'button',
          icon: 'base/rx_ic_frame_stack',
          newBadge: 'base/new_badge',
          hideInMenu: !isWindows,
          onClick: () => {
            console.log('sync-control')
            electronAPI.send('syncControl:open')
          }
        },
        component: () => import('/@/views/api-keys'),
      },
      {
        path: 'api-keys',
        name: 'api-keys',
        meta: { title: $t('API'), icon: 'base/rx_ic_doc_code', roles: [Role.EDITOR, Role.MANAGER, Role.OWNER] },
        component: () => import('/@/views/api-keys'),
      }
    ],
  },

]
