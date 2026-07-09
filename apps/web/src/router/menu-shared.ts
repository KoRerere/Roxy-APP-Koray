import { API } from '/@/api'
import { usePermission } from '/@/hooks/usePermission'
import { switchWorkspaceAndToUpgradePlan } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useUserStore } from '/@/stores/user'
import { emitter } from '/@/utils/eventBus'
import { I18nT } from 'vue-i18n'
import { h } from 'vue'
import type { RouteRecordRaw } from 'vue-router'

/** 普通 / 电商模式共用的自动化、团队协作及隐藏页路由 */
export const sharedMenuRoutes: RouteRecordRaw[] = [
  {
    path: 'automation',
    name: 'automation',
    meta: { title: $t('自动化'), type: 'group' },
    children: [
      {
        path: 'roxy-claw',
        name: 'roxy-claw',
        meta: {
          title: 'RoxyClaw',
          icon: 'base/rx_ic_roxyclaw',
          isRoxyClaw: true,
          permissions: ['Roxy_Claw_All'],
        },
        redirect: { name: 'roxy-claw-home' },
        children: [
          {
            path: 'roxy-claw/home',
            name: 'roxy-claw-home',
            meta: {
              title: 'Claw',
              hideInMenu: true,
              isRoxyClaw: true,
              permissions: ['Roxy_Claw_All'],
            },
            component: () => import('/@/views/roxy-claw'),
          },
          {
            path: 'roxy-claw/telegram',
            name: 'roxy-claw-telegram',
            meta: {
              title: 'Telegram Bot',
              hideInMenu: true,
              isRoxyClaw: true,
              permissions: ['Roxy_Claw_All'],
            },
            component: () => import('/@/views/roxy-claw/telegram-config.vue'),
          },
          {
            path: 'roxy-claw/lark',
            name: 'roxy-claw-lark',
            meta: {
              title: 'Lark / Feishu Bot',
              hideInMenu: true,
              isRoxyClaw: true,
              permissions: ['Roxy_Claw_All'],
            },
            component: () => import('/@/views/roxy-claw/lark-config.vue'),
          },
          {
            path: 'roxy-claw/slack',
            name: 'roxy-claw-slack',
            meta: {
              title: 'Slack Bot',
              hideInMenu: true,
              isRoxyClaw: true,
              permissions: ['Roxy_Claw_All'],
            },
            component: () => import('/@/views/roxy-claw/slack-config.vue'),
          },
          {
            path: 'roxy-claw/discord',
            name: 'roxy-claw-discord',
            meta: {
              title: 'Discord Bot',
              hideInMenu: true,
              isRoxyClaw: true,
              permissions: ['Roxy_Claw_All'],
            },
            component: () => import('/@/views/roxy-claw/discord-config.vue'),
          },
          {
            path: 'roxy-claw/wechat',
            name: 'roxy-claw-wechat',
            meta: {
              title: 'WeChat Bot',
              hideInMenu: true,
              isRoxyClaw: true,
              permissions: ['Roxy_Claw_All'],
            },
            component: () => import('/@/views/roxy-claw/wechat-config.vue'),
          },
        ],
      },
      {
        path: 'skills-store',
        name: 'skills-store',
        meta: {
          title: $t('AI Skills 商城'),
          isRoxyAgent: true,
          permissions: ['Roxy_AI_Agent_All'],
          icon: 'roxy-agent/rx-ic-skills-store-color',
          version: ['3.8.8', '>='],
        },
        component: () => import('/@/views/skills/index.vue'),
      },
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

export const menuActionHandlers: Record<string, (event: Event) => void | Promise<void>> = {
  'sync-control': handleSyncControlClick,
}
