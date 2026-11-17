import type { RouteRecordRaw } from 'vue-router'
import { WorkspaceType } from '/@/enums'

const privateOnly = [WorkspaceType.Private] as const

/** 标题延迟到读取时翻译，让菜单计算属性跟随当前语言更新，避免固化模块加载时的语言。 */
export const normalMenuRoutes: RouteRecordRaw[] = [
  {
    path: 'browser',
    name: 'browser',
    meta: {
      get title() {
        return $t('窗口管理')
      },
      icon: 'base/rx_ic_browser',
      workspaceTypes: [...privateOnly],
    },
    redirect: { name: 'browser-list' },
    children: [
      {
        path: 'list',
        name: 'browser-list',
        meta: {
          get title() {
            return $t('窗口管理')
          },
          hideInMenu: true,
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/browser/list'),
      },
      {
        path: 'create',
        name: 'browser-create',
        meta: {
          title: '新建窗口',
          permissions: ['Profiles_add'],
          hideInMenu: true,
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/browser/create'),
      },
      {
        path: 'edit',
        name: 'browser-edit',
        meta: {
          title: '编辑窗口',
          permissions: ['Profiles_edit'],
          hideInMenu: true,
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/browser/create/edit.vue'),
      },
    ],
  },
  {
    path: 'cloud-phone',
    name: 'cloud-phone',
    meta: {
      get title() {
        return $t('云手机')
      },
      icon: 'base/rx_ic_cloud_phone',
      workspaceTypes: [...privateOnly],
    },
    redirect: { name: 'cloud-phone-list' },
    children: [
      {
        path: 'list',
        name: 'cloud-phone-list',
        meta: {
          get title() {
            return $t('云手机')
          },
          hideInMenu: true,
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/cloud-phone/index.vue'),
      },
      {
        path: 'create',
        name: 'cloud-phone-create',
        meta: {
          get title() {
            return $t('创建云手机')
          },
          hideInMenu: true,
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/cloud-phone/create/index.vue'),
      },
    ],
  },
  {
    path: 'projects',
    name: 'projects',
    meta: {
      get title() {
        return $t('项目管理')
      },
      icon: 'base/rx_ic_stack',
      permissions: ['Projects_view_page'],
      workspaceTypes: [...privateOnly],
    },
    redirect: { name: 'project-list' },
    children: [
      {
        path: 'list',
        name: 'project-list',
        meta: {
          title: '项目列表',
          hideInMenu: true,
          permissions: ['Projects_view_page'],
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/projects/index.vue'),
      },
      {
        path: ':id',
        name: 'project-item',
        meta: {
          title: '项目',
          hideInMenu: true,
          permissions: ['Projects_view_page'],
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/projects/project-item.vue'),
      },
    ],
  },
  {
    path: 'resource',
    name: 'resource',
    meta: {
      get title() {
        return $t('工具')
      },
      type: 'flat',
      workspaceTypes: [...privateOnly],
    },
    children: [
      {
        path: 'agent',
        name: 'agent-list',
        meta: {
          get title() {
            return $t('代理 IP')
          },
          icon: 'base/rx_ic_internet',
          permissions: ['Proxy_List_view_page'],
          permissionMode: 'any',
          slotName: 'proxy',
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/agent'),
      },
      {
        path: 'create',
        name: 'agent-create',
        meta: {
          get title() {
            return $t('新建代理 IP')
          },
          hideInMenu: true,
          permissions: ['Proxy_List_add'],
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/agent/create'),
      },
      {
        path: 'account',
        name: 'account-list',
        meta: {
          get title() {
            return $t('平台账号')
          },
          icon: 'base/rx_ic_keys',
          permissions: ['Platform_view_page'],
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/account/list'),
      },
      {
        path: 'accountcreate',
        name: 'account-create',
        meta: {
          get title() {
            return $t('新建账号')
          },
          hideInMenu: true,
          permissions: ['Platform_add'],
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/account/create'),
      },
      {
        path: 'extensions',
        name: 'extensions',
        meta: {
          get title() {
            return $t('扩展中心')
          },
          icon: 'base/rx_ic_extension_store',
          permissions: ['Plugin_Installed_view_page'],
          workspaceTypes: [...privateOnly],
        },
        component: () => import('/@/views/extensions'),
      },
    ],
  },
]
