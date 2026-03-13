import mitt from 'mitt'
import type { ToastMessageOptions } from 'primevue/toast'
import type { UserGetNotifyListData, UserPaySettlementCreateData } from '@roxy/backend-api'

export type PayWallType = 'synchronizer' | 'createProfileTemplates' | 'transfer'

export interface MittEvents {
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
  firstRegisterGuide: string
  /** 显示侧边栏引导 */
  asideMenuGuide?: void
  /** 更新项目列表 */
  updateProjectList?: void
  /** 更新自动续费列表 */
  updateAutoRenewList?: void
  openSettings: {
    settingsKey: 'profiles' | 'authentication' | 'preferences' | 'network' | 'loginActivity'
    anchorPoint?: string
  }
  badgeMap: string
  showAppUpgradeDialog: any
}

export const emitter = mitt<MittEvents>()
