import type { RouteRecordRaw } from "vue-router";
import { Role } from "/@/enums";
import { SubLevelEnum } from "/@/enums/pay";
import { $t } from "/@/locales";
import { useUserStore } from "/@/stores/user";
import { isWindows } from "/@/utils";
import { emitter } from "/@/utils/eventBus";
import { useRoleStore } from "/@/stores/role";
import { showToast } from "/@/hooks/useResponseToast/handleBusinessCode";

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
        path: "agent",
        name: "agent-list",
        meta: {
          title: $t("代理资源"),
          icon: "base/rx_ic_internet",
          roles: [Role.EDITOR, Role.MANAGER, Role.OWNER],
        },
        component: () => import("/@/views/agent/list"),
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
          newBadge: "base/new_badge",
          hideInMenu: !isWindows,
          onClick: (event: Event) => {
            const { userPayInfo } = useUserStore();
            const { isOwner } = useRoleStore();
            if (userPayInfo?.subLevel === SubLevelEnum.Free || userPayInfo?.subLevel === SubLevelEnum.Expired) {
              if (isOwner) {
                return emitter.emit("showPayWall", {
                  event,
                  params: {
                    type: "synchronizer",
                  },
                });
              } else {
                return showToast({
                  severity: 'warn',
                  summary: $t('同步器不可用'),
                  detail: $t('请联系空间的拥有者进行升级。'),
                  life: 5000
                })
              }
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
          roles: [Role.EDITOR, Role.MANAGER, Role.OWNER],
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
      title: $t("7 天免费试用"),
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
