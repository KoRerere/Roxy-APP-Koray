import { h } from 'vue'
import ReferralModal from '/@/views/referral-program/components/referral-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from '/@/stores/user'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks'
import { genDriver /* sleep */ } from '/@/utils'

/** 侧边栏底部「推广计划」入口，供关闭弹窗后的引导高亮 */
const REFERRAL_PROGRAM_ENTRY_ID = 'REFERRAL_PROGRAM_ENTRY'

/** 防止购买成功回调连触发时叠两个弹窗 */
let isShowingFirstConsumePopup = false

/** 首次消费推广弹窗的关闭原因 */
export type FirstConsumeReferralCloseReason = 'dismiss' | 'view-details'

/**
 * 首次消费推广弹窗：窗口或代理 IP 购买成功后，按 userPayInfo.firstConsumePopupStatus 决定是否弹出。
 */
export function useFirstConsumeReferralPopup() {
  const [showModal] = useDialog()
  const { userPayInfo } = storeToRefs(useUserStore())
  const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()

  /**
   * 未弹过则打开推广弹窗；关闭时把 firstConsumePopupStatus 记为已弹。
   * @param onClosed 弹窗关闭或无需弹出时的回调。查看详情时 reason 为 view-details，只应跳过购买成功后的默认跳转，抽奖等后续弹窗仍要走。
   */
  function maybeShowFirstConsumeReferralPopup(onClosed?: (reason: FirstConsumeReferralCloseReason) => void) {
    if (userPayInfo.value.firstConsumePopupStatus !== false || isShowingFirstConsumePopup) {
      onClosed?.('dismiss')
      return
    }

    isShowingFirstConsumePopup = true
    /** 查看详情会先自己跳推广页，关闭回调里不能再 push 别的路由 */
    let closeReason: FirstConsumeReferralCloseReason = 'dismiss'
    showModal({
      header: 'first-consume-referral-popup',
      showHeader: false,
      modal: true,
      blockScroll: true,
      handleCancel: async () => {
        isShowingFirstConsumePopup = false
        userPayInfo.value.firstConsumePopupStatus = true
        await updateOnboardingTaskStatus({ firstConsumePopupStatus: true })
        const reason = closeReason
        onClosed?.(reason)
        // if (reason === 'dismiss') {
        //   await sleep(300)
        //   focusReferralProgramEntry()
        // }
      },
      slots: {
        container: ({ handleCancel }) => h(ReferralModal, {
          onClose: (reason?: FirstConsumeReferralCloseReason) => {
            closeReason = reason ?? 'dismiss'
            handleCancel()
          },
        }),
      },
    })
  }

  return {
    maybeShowFirstConsumeReferralPopup,
  }
}

/** 关闭弹窗后高亮侧栏推广计划入口，引导用户之后从这里进入 */
let referralEntryDriver: ReturnType<typeof genDriver> | undefined

function dismissReferralEntryDriver() {
  const driver = referralEntryDriver
  if (!driver) {
    return
  }
  referralEntryDriver = undefined
  driver.destroy()
}

function _focusReferralProgramEntry() {
  const el = document.getElementById(REFERRAL_PROGRAM_ENTRY_ID)
  if (!el) {
    return
  }

  dismissReferralEntryDriver()

  const driverObj = genDriver({
    showProgress: false,
    disableActiveInteraction: false,
    allowClose: true,
    overlayClickBehavior: 'close',
    showButtons: ['close'],
    stagePadding: 0,
    popoverOffset: 20,
    onDestroyed: () => {
      document.removeEventListener('click', dismissReferralEntryDriver, true)
      if (referralEntryDriver === driverObj) {
        referralEntryDriver = undefined
      }
    },
    steps: [
      {
        element: `#${REFERRAL_PROGRAM_ENTRY_ID}`,
        popover: {
          description: $t('后续可以在此了解推广计划详情'),
          side: 'right',
          align: 'center',
        },
      },
    ],
  })

  referralEntryDriver = driverObj
  driverObj.drive()
  // 捕获阶段关掉引导，侧栏跳转的点击仍会落到菜单项上
  document.addEventListener('click', dismissReferralEntryDriver, true)
}
