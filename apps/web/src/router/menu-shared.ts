import { API } from '/@/api'
import { WorkspaceType } from '/@/enums'
import { usePermission } from '/@/hooks/usePermission'
import { useOpenRoxyAIAgent } from '/@/hooks/useOpenRoxyAIAgent'
import { switchWorkspaceAndToUpgradePlan } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useUserStore } from '/@/stores/user'
import { emitter } from '/@/utils/eventBus'
import { I18nT } from 'vue-i18n'
import { h } from 'vue'
import type { RouteRecordRaw } from 'vue-router'

/** 普通 / 电商模式共用的 Roxy Geo 外链入口（挂载于「生态系统」分组下） */
export const roxyGeoRoute: RouteRecordRaw = {
  path: 'roxy-geo',
  name: 'roxy-geo',
  meta: {
    title: $t('跨境营销'),
    icon: 'websites/rx_accounts_tiktok',
    type: 'button',
    external: true,
    showFireBadge: true,
    workspaceTypes: [WorkspaceType.Private, WorkspaceType.ECommerce],
    onClick: async () => {
      const userStore = await import('/@/stores/user').then(m => m.useUserStore())
      const simpleLocale = await import('/@/stores/locale').then(m => m.useSimpleLocale())
      const url = `${simpleLocale.getOfficialWebsite('/roxy-geo/')}?roxy-geo-token=${userStore.token}&roxy-geo-locale=${simpleLocale.currentLocale}&source=app`
      window.open(url, '_blank')
    },
  },
  component: () => import('/@/views/extensions'),
}

/** 普通 / 电商模式共用的自动化、生态系统、团队协作及隐藏页路由 */
export const sharedMenuRoutes: RouteRecordRaw[] = [
  {
    path: 'automation',
    name: 'automation',
    meta: { title: $t('AI & 自动化'), type: 'group', workspaceTypes: [WorkspaceType.Private] },
    children: [
      {
        path: 'sync-control',
        name: 'sync-control',
        meta: {
          title: $t('窗口同步'),
          type: 'button',
          menuAction: 'sync-control',
          icon: 'base/rx_ic_frame_stack',
          hideInMenu: !navigator.platform.includes('Win'),
        },
        component: () => import('/@/views/api-keys'),
      },
      {
        path: 'roxy-agent',
        name: 'roxy-agent',
        meta: {
          title: 'AI Agent',
          type: 'button',
          menuAction: 'roxy-agent',
          icon: 'roxy-agent/rx-ic-logo',
          showNewBadge: true,
          permissions: ['Roxy_AI_Agent_All'],
        },
        redirect: { name: 'agent-console-chat' },
      },
      {
        path: 'template-store',
        name: 'template-store',
        meta: {
          title: $t('模板商城'),
          type: 'button',
          menuAction: 'roxy-agent-template-store',
          icon: 'roxy-agent/rx-ic-templates-store',
          permissions: ['Roxy_AI_Agent_All'],
        },
        redirect: { name: 'agent-console-template-store' },
      },
      {
        path: 'task-manager',
        name: 'task-manager',
        meta: {
          title: $t('任务管理'),
          type: 'button',
          menuAction: 'roxy-agent-task-manager',
          icon: 'roxy-agent/rx-ic-task-manager',
          permissions: ['Roxy_AI_Agent_All'],
        },
        redirect: { name: 'agent-console-task-manager' },
      },
      {
        path: 'my-templates',
        name: 'my-templates',
        meta: {
          title: $t('我的模板'),
          type: 'button',
          menuAction: 'roxy-agent-my-templates',
          icon: 'roxy-agent/rx-ic-templates',
          permissions: ['Roxy_AI_Agent_All'],
        },
        redirect: { name: 'agent-console-my-templates' },
      },
      {
        path: 'api-keys',
        name: 'api-keys',
        meta: {
          title: 'API & AI MCP',
          icon: 'base/rx_ic_doc_code',
          permissions: ['API_MCP_view_page'],
        },
        component: () => import('/@/views/api-keys'),
      },
    ],
  },
  {
    path: 'ecosystem',
    name: 'ecosystem',
    meta: { title: $t('生态系统'), type: 'group' },
    children: [roxyGeoRoute],
  },
  {
    path: 'workspace',
    name: 'workspace',
    meta: { title: $t('团队协作'), type: 'group' },
    redirect: { name: 'teams' },
    children: [
      {
        path: 'teams',
        name: 'teams',
        meta: {
          title: $t('团队管理'),
          icon: 'base/rc_ic_user_referral',
          permissions: ['Team_Member_view_page'],
        },
        component: () => import('/@/views/team'),
      },
      {
        name: 'wallet',
        path: 'wallet',
        meta: {
          title: $t('费用中心'),
          icon: 'base/rx_ic_wallet',
          permissions: ['Cost_Center_all'],
        },
        component: () => import('/@/views/pay/wallet'),
      },
    ],
  },
  {
    name: 'subscribe-plan',
    path: 'subscribe-plan',
    meta: {
      title: $t('选择套餐'),
      icon: 'base/rx_ic_wallet',
      hideInMenu: true,
      permissions: ['Cost_Center_all'],
    },
    component: () => import('/@/views/pay/subscribe'),
  },
  {
    name: 'upgrade-plan',
    path: 'upgrade-plan',
    meta: {
      title: $t('更改套餐'),
      icon: 'base/rx_ic_wallet',
      hideInMenu: true,
      permissions: ['Cost_Center_all'],
    },
    component: () => import('/@/views/pay/subscribe/upgrade-plan.vue'),
  },
  {
    name: 'tutorial',
    path: 'tutorial',
    meta: {
      title: $t('新手教程'),
      icon: 'base/rx_ic_wallet',
      hideInMenu: true,
    },
    component: () => import('/@/views/tutorial'),
  },
]

async function handleSyncControlClick(event: Event) {
  const { mixpanelTrack } = useUserStore()
  const { check } = usePermission()
  const { code } = await API.pay.userCheckTeamUserRightsList()
  if (code !== 0) {
    if (!check('Cost_Center_all')) {
      emitter.emit('showToast', {
        severity: 'warn',
        summary: $t('窗口同步不可用'),
        detail: h(I18nT, {
          keypath: $t('窗口同步不可用，请联系团队的拥有者进行升级，或{link}以激活该跨团队功能。', { link: '{link}' }),
        }, {
          link: () => h('a', {
            class: 'cursor-pointer',
            onClick: switchWorkspaceAndToUpgradePlan,
          }, $t('前往升级您的权益')),
        }),
        life: 5000,
      })
    }
    else {
      emitter.emit('showPayWall', {
        event,
        params: {
          type: 'synchronizer',
        },
      })
    }
    return
  }

  mixpanelTrack('synchronizer_open')
  globalThis.electronAPI.send('syncControl:open', check('Cost_Center_all'))
}

function handleRoxyAgentClick(route = '/agent-console') {
  const { openRoxyAIAgent } = useOpenRoxyAIAgent()
  void openRoxyAIAgent(route)
}

export const menuActionHandlers: Record<string, (event: Event) => void | Promise<void>> = {
  'roxy-agent': () => handleRoxyAgentClick(),
  'roxy-agent-task-manager': () => handleRoxyAgentClick('/agent-console/task-manager'),
  'roxy-agent-my-templates': () => handleRoxyAgentClick('/agent-console/templates'),
  'roxy-agent-template-store': () => handleRoxyAgentClick('/agent-console/template-store'),
  'sync-control': handleSyncControlClick,
}
