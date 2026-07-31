import { tryOnScopeDispose } from '@vueuse/core'
import mitt from 'mitt'
import type { Handler } from 'mitt'
import type { ToastMessageOptions } from 'primevue/toast'
import type { UserGetNotifyListData, UserGetWindowInfoListListData, UserPaySettlementCreateData } from '@roxy/backend-api'

export type PayWallType = 'synchronizer' | 'createProfileTemplates' | 'transfer'

export type MittEvents = {
  notifyUpdateData: UserGetNotifyListData
  maxWindowCountChange?: number
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
    paySuccess?: (result: UserPaySettlementCreateData) => void
    payError?: (result: UserPaySettlementCreateData) => void
    afterConfirm?: (result: UserPaySettlementCreateData) => void
  }
  /** 显示扩容弹窗 */
  showExpandDialog?: {
    defaultType?: 'workspace' | 'staff'
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
  /** 直接打开实名认证弹窗（不经过设置页） */
  openIdentityVerification?: {
    showRegulatoryNotice?: boolean
  }
  /** 更新代理 IP 列表 */
  updateShopList?: string
  badgeMap: string
  showAppUpgradeDialog: any
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
