import type { RouteRecordRaw } from "vue-router";
import { Role } from "/@/enums";
import { $t } from "/@/locales";
import { isWindows } from "/@/utils";
import { emitter } from "/@/utils/eventBus";
import { API } from "/@/api";
import { I18nT } from "vue-i18n"
import { useRoleStore } from "/@/stores/role";
import { switchWorkspaceAndToUpgradePlan } from '/@/hooks/useResponseToast/handleBusinessCode'

export const getMenuRoutes = (): RouteRecordRaw[] => [
  {
    path: "browser",
    name: "browser",
    meta: { title: $t("全部窗口"), icon: "base/rx_ic_browser" },
    redirect: { name: "browser-list" },
    children: [
      {
        path: "list",
        name: "browser-list",
        meta: { title: $t("全部窗口"), hideInMenu: true },
        component: () => import("/@/views/browser/list"),
      },
      {
        path: 'create',
        name: 'browser-create',
        meta: { title: '新建窗口', roles: [Role.EDITOR, Role.MANAGER, Role.OWNER], hideInMenu: true },
        component: () => import('/@/views/browser/create'),
      },
      {
        path: 'edit',
        name: 'browser-edit',
        meta: { title: '编辑窗口', roles: [Role.EDITOR, Role.MANAGER, Role.OWNER], hideInMenu: true },
        component: () => import('/@/views/browser/create/edit.vue'),
      },
    ],
  },
  {
    path: "projects",
    name: "projects",
    meta: { title: $t("项目管理"), icon: "base/rx_ic_stack" },
    redirect: { name: "project-list" },
    children: [
      {
        path: "list",
        name: "project-list",
        meta: { title: "项目列表", hideInMenu: true },
        component: () => import("/@/views/projects/index.vue"),
      },
      {
        path: ":id",
        name: "project-item",
        meta: { title: "项目", hideInMenu: true },
        component: () => import("/@/views/projects/project-item.vue"),
      },
    ],
  },
  {
    path: "resource",
    name: "resource",
    meta: { title: $t("资源"), type: "group" },
    children: [
      {
        path: "account",
        name: "account-list",
        meta: {
          title: $t("平台账号"),
          icon: "base/rx_ic_keys",
          roles: [Role.EDITOR, Role.MANAGER, Role.OWNER],
        },
        component: () => import("/@/views/account/list"),
      },
      {
        path: "accountcreate",
        name: "account-create",
        meta: { title: $t("新建账号"), hideInMenu: true },
        component: () => import("/@/views/account/create"),
      },
      {
        path: "agent",
        name: "agent-list",
        meta: {
          title: $t("代理 IP"),
          icon: "base/rx_ic_internet",
          newBadge: 'base/new_badge',
          roles: [Role.EDITOR, Role.MANAGER, Role.OWNER],
        },
        component: () => import("/@/views/agent"),
      },
      {
        path: "create",
        name: "agent-create",
        meta: { title: $t("新建代理"), hideInMenu: true },
        component: () => import("/@/views/agent/create"),
      },
      {
        path: "cattle-slaughter",
        name: "cattle-slaughter",
        meta: {
          title: "牛马屠宰场",
          icon: "base/rx_ic_keys",
          hideInMenu: true,
        },
        component: () => import("/@/views/lab"),
      },
      {
        path: "extensions",
        name: "extensions",
        meta: { title: $t("扩展中心"), icon: "base/rx_ic_extension_store" },
        component: () => import("/@/views/extensions"),
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
    path: "automation",
    name: "automation",
    meta: { title: $t("自动化"), type: "group" },
    children: [
      {
        path: "sync-control",
        name: "sync-control",
        meta: {
          title: $t("窗口同步"),
          type: "button",
          icon: "base/rx_ic_frame_stack",
          hideInMenu: !isWindows,
          onClick: async (event: Event) => {
            const { isOwner } = useRoleStore();
            const { code } = await API.pay.userCheckTeamUserRightsList()
            if (code !== 0) {
              if (!isOwner) {
                emitter.emit('showToast', {
                  severity: 'warn',
                  summary: $t('窗口同步不可用'),
                  detail: h(I18nT, {
                    keypath: $t('窗口同步不可用，请联系空间的拥有者进行升级，或{link}以激活该跨空间功能。', { link: '{link}' }),
                  }, {
                    link: () => h('a', {
                      class: 'cursor-pointer',
                      onClick: switchWorkspaceAndToUpgradePlan,
                    }, $t('前往升级您的权益'))
                  }),
                  life: 5000
                })
              } else {
                emitter.emit("showPayWall", {
                  event,
                  params: {
                    type: "synchronizer",
                  },
                });
              }
              return
            }
            console.log("sync-control");
            electronAPI.send("syncControl:open");
          },
        },
        component: () => import("/@/views/api-keys"),
      },
      {
        path: "api-keys",
        name: "api-keys",
        meta: {
          title: $t("API"),
          icon: "base/rx_ic_doc_code",
          roles: [Role.OWNER],
        },
        component: () => import("/@/views/api-keys"),
      },
    ],
  },
  {
    path: "workspace",
    name: "workspace",
    meta: { title: $t("工作空间"), type: "group" },
    redirect: { name: "teams" },
    children: [
      {
        path: "teams",
        name: "teams",
        meta: { title: $t("团队"), icon: "base/rc_ic_user_referral" },
        component: () => import("/@/views/team"),
      },
      // {
      // 	path: "workspace-settings",
      // 	name: "workspace-settings",
      // 	meta: { title: $t("空间设置"), icon: "base/rx_ic_gear" },
      // 	component: () => import("/@/views/workspace-setting/index.vue"),
      // },
    ],
  },
  {
    name: "subscribe-plan",
    path: "subscribe-plan",
    meta: {
      title: $t("选择套餐"),
      icon: "base/rx_ic_wallet",
      hideInMenu: true,
      roles: [Role.OWNER],
    },
    component: () => import("/@/views/pay/subscribe"),
  },
  {
    name: "upgrade-plan",
    path: "upgrade-plan",
    meta: {
      title: $t("更改套餐"),
      icon: "base/rx_ic_wallet",
      hideInMenu: true,
      roles: [Role.OWNER],
    },
    component: () => import("/@/views/pay/subscribe/upgrade-plan.vue"),
  },
  {
    name: "trial-plan",
    path: "trial-plan",
    meta: {
      title: $t('{day} 天免费试用', { day: 7 }),
      icon: "base/rx_ic_wallet",
      hideInMenu: true,
      roles: [Role.OWNER],
    },
    component: () => import("/@/views/pay/subscribe/trial-plan.vue"),
  },
  {
    name: "wallet",
    path: "wallet",
    meta: {
      title: $t("费用中心"),
      icon: "base/rx_ic_wallet",
      hideInMenu: true,
      roles: [Role.OWNER],
    },
    component: () => import("/@/views/pay/wallet"),
  },
];
