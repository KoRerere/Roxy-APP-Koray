import type { RouteRecordRaw } from 'vue-router'
import AgentConsoleIndex from '/@/views/agent-console/index.vue'
import AgentChatRoute from '/@/views/agent-console/pages/AgentChatRoute.vue'

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
    name: 'agent-console',
    path: '/agent-console',
    meta: {
      title: 'AI Agent',
      isRoxyAgent: true,
      permissions: ['Roxy_AI_Agent_All'],
    },
    component: AgentConsoleIndex,
    children: [
      {
        name: 'agent-console-chat',
        path: '',
        meta: { title: 'AI Agent' },
        component: AgentChatRoute,
      },
      {
        name: 'agent-console-conversation',
        path: 'c/:conversationId',
        meta: { title: 'AI Agent' },
        component: AgentChatRoute,
      },
      {
        name: 'agent-console-task-manager',
        path: 'task-manager',
        meta: { title: 'Task Manager' },
        component: () => import('/@/views/agent-console/pages/TaskManagerRoute.vue'),
      },
      {
        name: 'agent-console-my-templates',
        path: 'templates',
        meta: { title: '我的模板' },
        component: () => import('/@/views/agent-console/pages/MyTemplatesRoute.vue'),
      },
      {
        name: 'agent-console-template-store',
        path: 'template-store',
        meta: { title: '模板商城' },
        component: () => import('/@/views/agent-console/pages/TemplateStoreRoute.vue'),
      },
      {
        name: 'agent-console-roxyclaw',
        path: 'roxyclaw',
        meta: {
          title: 'RoxyClaw',
          agentConsoleLayout: 'settings',
        },
        component: () => import('/@/views/agent-console/pages/AgentRoxyClawRoute.vue'),
      },
      {
        name: 'agent-console-roxyclaw-telegram',
        path: 'roxyclaw/telegram',
        meta: {
          title: 'Telegram Bot',
          agentConsoleLayout: 'settings',
        },
        component: () => import('/@/views/agent-console/pages/roxy-claw/telegram-config.vue'),
      },
      {
        name: 'agent-console-roxyclaw-lark',
        path: 'roxyclaw/lark',
        meta: {
          title: 'Lark / Feishu Bot',
          agentConsoleLayout: 'settings',
        },
        component: () => import('/@/views/agent-console/pages/roxy-claw/lark-config.vue'),
      },
      {
        name: 'agent-console-roxyclaw-slack',
        path: 'roxyclaw/slack',
        meta: {
          title: 'Slack Bot',
          agentConsoleLayout: 'settings',
        },
        component: () => import('/@/views/agent-console/pages/roxy-claw/slack-config.vue'),
      },
      {
        name: 'agent-console-roxyclaw-discord',
        path: 'roxyclaw/discord',
        meta: {
          title: 'Discord Bot',
          agentConsoleLayout: 'settings',
        },
        component: () => import('/@/views/agent-console/pages/roxy-claw/discord-config.vue'),
      },
      {
        name: 'agent-console-roxyclaw-wechat',
        path: 'roxyclaw/wechat',
        meta: {
          title: 'WeChat Bot',
          agentConsoleLayout: 'settings',
        },
        component: () => import('/@/views/agent-console/pages/roxy-claw/wechat-config.vue'),
      },
      {
        name: 'agent-console-credits',
        path: 'credits',
        meta: {
          title: 'Credits',
          permissions: ['Cost_Center_all'],
        },
        component: () => import('/@/views/agent-console/pages/CreditsRoute.vue'),
      },
      {
        name: 'agent-console-settings',
        path: 'settings',
        meta: {
          title: 'Settings',
          agentConsoleLayout: 'settings',
        },
        component: () => import('/@/views/agent-console/pages/AgentSettingsRoute.vue'),
      },
    ],
  },
  {
    name: 'before-enter',
    path: '/tutorial/before-enter',
    meta: { title: $t('开始之前') },
    component: () => import('/@/views/tutorial/before-enter/index.vue'),
  },
  {
    path: '/mcp',
    name: 'mcp',
    meta: {
      title: 'AI Agent',
      type: 'button',
      menuAction: 'roxy-agent',
      icon: 'roxy-agent/rx-ic-logo',
      isRoxyClaw: true,
      permissions: ['Roxy_AI_Agent_All'],
    },
    component: AgentConsoleIndex,
  },
]
