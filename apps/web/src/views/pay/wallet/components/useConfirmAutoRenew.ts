import { h } from 'vue'
import AutoRenewModal from '/@/views/pay/wallet/components/auto-renew-modal.vue'
import { useDialog } from '/@/hooks/useDialog'
import { AutoRenewalStatus } from '/@/enums/pay'

/** 与确认弹窗、列表页共用，勾选「不再提醒」后跳过二次确认 */
const AUTO_RENEW_SKIP_CONFIRM_KEY = 'autoRenewModalNotShowAgain'

/**
 * 购买/续费页自动续费开关：开启前弹出确认弹窗，关闭直接放行
 */
export function useConfirmAutoRenew() {
  const [showModal] = useDialog()

  /**
   * 是否已勾选「不再提醒」
   */
  function shouldSkipConfirm() {
    return localStorage.getItem(AUTO_RENEW_SKIP_CONFIRM_KEY) === 'true'
  }

  /**
   * 开关目标值是否为「开启」：兼容布尔 true、枚举 Open、以及历史字符串 "1"
   */
  function isEnabling(newValue: unknown) {
    return newValue === true
      || newValue === AutoRenewalStatus.Open
      || newValue === String(AutoRenewalStatus.Open)
  }

  /**
   * 弹出自动续费确认弹窗；确认开启返回 true，关闭返回 false
   */
  function confirmEnableAutoRenew() {
    if (shouldSkipConfirm()) {
      return Promise.resolve(true)
    }

    const { promise, resolve } = Promise.withResolvers<boolean>()
    let settled = false
    function settle(value: boolean) {
      if (settled) {
        return
      }
      settled = true
      resolve(value)
    }

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      handleCancel: () => settle(false),
      slots: {
        container: ({ hideModal }) => h(AutoRenewModal, {
          onClose: () => {
            hideModal()
            settle(false)
          },
          onConfirm: () => {
            hideModal()
            settle(true)
          },
        }),
      },
    })
    return promise
  }

  /**
   * RxToggleSwitch 的 before-change：仅从关到开时确认，关闭不弹窗
   */
  async function beforeToggleAutoRenew(newValue: unknown) {
    if (!isEnabling(newValue)) {
      return true
    }
    return confirmEnableAutoRenew()
  }

  return {
    confirmEnableAutoRenew,
    beforeToggleAutoRenew,
  }
}
