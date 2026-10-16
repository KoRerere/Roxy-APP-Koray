import { tryOnScopeDispose } from '@vueuse/core'
import mitt from 'mitt'
import type { Handler } from 'mitt'
import type { ToastMessageOptions } from 'primevue/toast'
import type { UserGetNotifyListData, UserGetWindowInfoListListData, UserPaySettlementCreateData } from '@roxy/backend-api'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'

export type PayWallType = 'synchronizer' | 'createProfileTemplates' | 'transfer'

/** 版本提醒配置里的标题和正文 */
export interface AppUpgradeRemindCopy {
  /** 当前档位标题 */
  title: string
  /** 当前档位正文 */
  content: string
}

/** 更新公告弹窗参数（前置升级 / 历史日志 / 兼容入口） */
export interface ShowAppUpgradeDialogPayload {
  tips: Array<{ content?: string, [key: string]: any }>
  actionMode?: 'dismiss' | 'upgrade'
  /** upgrade 模式下用于 quitAndInstall */
  updateItem?: Partial<ResourceUpdateMessage>
  /** 配置接口返回的标题和说明，显示在新特性正文上方 */
  remindCopy?: AppUpgradeRemindCopy
  /** 用户关掉或选择暂不更新 */
  onDismiss?: () => void
  /** 用户确认重启并更新 */
  onConfirmUpgrade?: () => void
}

export type MittEvents = {
  notifyUpdateData: UserGetNotifyListData
  /** 显示 toast */
  showToast: ToastMessageOptions
  /** 被挤号 */
  kickedOut?: {
    deviceName: string
    createTime: string
  }
  /** 显示升级套餐弹窗 */
  showUpgradePlanDialog?: 'subscriptionExpired' | 'windowLimitReached'
  /** 显示订阅到期弹窗 */
  showSubscriptionExpiredDialog?: void
  /** 显示续费弹窗 */
  showRenewalDialog?: {
    /** 时长列表就绪后优先选中的天数 */
    defaultDays?: number
    paySuccess?: (result: UserPaySettlementCreateData) => void
    payError?: (result: UserPaySettlementCreateData) => void
    afterConfirm?: (result: UserPaySettlementCreateData) => void
  }
  /** 显示扩容弹窗 */
  showExpandDialog?: {
    defaultType?: 'workspace' | 'staff'
    /** 是否因额度不足打开；弹窗按 defaultType 展示对应提示文案 */
    insufficient?: boolean
    paySuccess?: (result: UserPaySettlementCreateData) => void
    payError?: (result: UserPaySettlementCreateData) => void
    afterConfirm?: (result: UserPaySettlementCreateData) => void
  }
  /** 显示付费墙 */
  showPayWall: {
    event: Event
    params: {
      type: PayWallType
    }
  }
  /** 显示聊天窗口 */
  toggleChatVisible: 'maximized' | 'minimized' | 'hidden'
  /** 更新账单列表 */
  updateBillList?: void
  /** 显示老用户福利弹窗 */
  showOldUserGiftDialog?: void
  /** 显示账号设置弹窗 */
  showAccountSetupDialog?: void
  /** 显示用户引导 */
  showUserGuideDialog?: void
  /** 显示第一次注册引导 */
  firstRegisterGuide?: void
  /** 电商账号列表首次打开引导 */
  ecommerceAccountOpenGuide?: void
  /** 显示侧边栏引导 */
  asideMenuGuide?: void
  /** 更新项目列表 */
  updateProjectList?: void
  /** 更新团队成员列表 */
  updateTeamMemberList?: void
  /** 更新自动续费列表 */
  updateAutoRenewList?: void
  openSettings: {
    settingsKey: 'profiles' | 'authentication' | 'preferences' | 'network' | 'loginActivity'
    anchorPoint?: string
  }
  /** 自定义协议落地后执行一次性 redirect-action */
  applyRedirectAction?: string
  /** 直接打开实名认证弹窗（不经过设置页）；按当前 KYC 状态分流详情/审核中/表单 */
  openIdentityVerification?: {
    showRegulatoryNotice?: boolean
    showRejectedNotice?: boolean
  }
  /** 更新代理 IP 列表 */
  updateShopList?: string
  badgeMap: string
  showAppUpgradeDialog: ShowAppUpgradeDialogPayload
  /** 定向消息弹窗（富文本 tips，格式同 newFeatureTips） */
  showMessageTipsDialog: Array<{ content?: string, id?: number }>
  backDefaultWorkspace: void
  /** 刷新窗口列表 */
  refreshProfileList?: number
  /** 窗口列表数据更新时 */
  updateProfileList?: UserGetWindowInfoListListData['data']['rows']
} & Record<string | symbol, unknown>

export const emitter = mitt<MittEvents>()

type SubscribeMitt = <Key extends keyof MittEvents>(
  type: Key,
  handler: Handler<MittEvents[Key]>,
) => void

const subscribe: SubscribeMitt = emitter.on.bind(emitter) as SubscribeMitt
const unsubscribe: SubscribeMitt = emitter.off.bind(emitter) as SubscribeMitt

/**
 * 订阅全局 `emitter`，当前组件 / effect scope 销毁时自动 `off`。
 * 在 `setup` 中调用即可，无需 `onMounted` + `onBeforeUnmount` 样板代码。
 *
 * VueUse 的 `useEventBus` 是另一套按 key 隔离的总线，与项目现有 mitt 实例不通用。
 */
export function useEmitterEvent<K extends keyof MittEvents>(
  event: K,
  handler: Handler<MittEvents[K]>,
): void {
  subscribe(event, handler)
  tryOnScopeDispose(() => {
    unsubscribe(event, handler)
  })
}
