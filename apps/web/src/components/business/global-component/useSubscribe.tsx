import { useDialog } from "primevue/usedialog"
import { useUserStore } from "/@/stores/user"
import { usePay } from "/@/views/pay/wallet/hook.tsx"
import { useResponseToast } from "/@/hooks/useResponseToast";
import { OrderType, PayWay, purchaseType } from "/@/enums/pay";
import { API } from "/@/api";
import { emitter, type MittEvents } from "/@/utils/eventBus";
import { useDialog as useDialogHook } from '/@/hooks/useDialog'
import type { ToastMessageOptions } from "primevue/toast";
import { useToast } from 'primevue/usetoast'
import { $t } from "/@/locales";
import { useHandleBusinessCode } from "/@/hooks/useResponseToast/handleBusinessCode";
import { useCommonStore } from "/@/stores/common";

const UpgradePayPlan = defineAsyncComponent(() => import('./upgrade-pay-plan.vue'))
const SubscriptionExpired = defineAsyncComponent(() => import('./subscription-expired.vue'))
const RenewalModal = defineAsyncComponent(() => import('/@/views/pay/wallet/components/renewal-modal.vue'))
const ExpandModal = defineAsyncComponent(() => import('/@/views/pay/wallet/components/expand-modal.vue'))
const OldUserGiftDialog = defineAsyncComponent(() => import('./old-user-gift-dialog.vue'))

let isSubscribe = false
let lastFocusTime = Date.now()

export function useSubscribe() {

  if (isSubscribe) {
    return
  }

  isSubscribe = true

  const commonStore = useCommonStore()
  const { purchaseSuccess, planSuccess, openProcessing } = usePay()
  const dialog = useDialog()
  const [dialogInstance] = useDialogHook()
  const toast = useToast()
  const [_, onlyErrorToast] = useResponseToast()
  const { handleBusinessCode } = useHandleBusinessCode()
  const { getUserPayInfo } = useUserStore()

  // 显示toast
  emitter.on('showToast', showToast)

  // showSubscriptionExpiredDialog()
  // showUpgradePlanDialog()
  // showBusinessPopup({})
  // showOldUserGiftDialog()

  /** 初始化事件监听 */
  function initListener() {
    if (!commonStore.isMainWindow) return

    // 显示升级套餐弹窗
    emitter.on('showUpgradePlanDialog', showUpgradePlanDialog)
    // 显示订阅到期弹窗
    emitter.on('showSubscriptionExpiredDialog', showSubscriptionExpiredDialog)
    // 显示续费弹窗
    emitter.on('showRenewalDialog', onRenewal)
    // 显示扩容弹窗
    emitter.on('showExpandDialog', onExpand)
    // 显示老用户福利弹窗
    emitter.on('showOldUserGiftDialog', showOldUserGiftDialog)

    // 达到窗口打开次数限制
    electronAPI.on('browser:window-open-limit', (result) => {
      console.log('browser:window-open-limit', result)
      handleBusinessCode(result.code)
    })
    /** 当主窗口聚焦时 */
    electronAPI.on('window:on-focus', () => {
      console.log('window:on-focus')
      // 如果距离上一次聚焦时间超过 15 分钟，则刷新一下用户支付信息
      if (Date.now() - lastFocusTime > 1000 * 60 * 15) {
        lastFocusTime = Date.now()
        getUserPayInfo()
      }
    })
  }

  requestIdleCallback(async () => {
    electronAPI.send('web:ready')
    console.log('web:ready')

    await commonStore.getIsMainWindow()
    initListener()
  })


  /** 显示老用户福利弹窗 */
  function showOldUserGiftDialog() {
    dialogInstance.showModal({
      slots: {
        container: () => <OldUserGiftDialog hideFn={dialogInstance.hideModal} />,
      }
    })
  }
  /** 显示升级套餐弹窗 */
  function showUpgradePlanDialog(alertType: MittEvents['showUpgradePlanDialog']) {

    dialogInstance.showModal({
      slots: {
        container: () => {
          return <UpgradePayPlan hideFn={dialogInstance.hideModal} alertType={alertType} />
        },
      }
    })
  }

  /** 显示订阅到期弹窗 */
  function showSubscriptionExpiredDialog() {
    dialogInstance.showModal({
      header: $t('订阅已到期'),
      closable: false,
      pt: {
        content: '!overflow-unset',
        title: '!text-[20px]'
      },
      slots: {
        default: () => {
          return <SubscriptionExpired hideFn={dialogInstance.hideModal} />
        },
        footer: undefined
      }
    })
  }

  function showToast(options: ToastMessageOptions) {
    toast.add(options)
  }

  /** 显示续费弹窗 */
  function onRenewal(options: MittEvents['showRenewalDialog']) {
    dialog.open(RenewalModal, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
        pt: {
          content: '!pa-0'
        }
      },
      data: {
        onConfirm: async (params: { isAuto: boolean, payType: PayWay, orderNo: string, subscriptionMonths: number }) => {
          const { code, data, msg } = await API.pay.userPaySettlementCreate({
            ...params,
            orderType: OrderType.Renew,
          })
          onlyErrorToast(code, msg)
          if (code === 0) {
            (params.payType === PayWay.Balance ? planSuccess() : openProcessing({ payType: params.payType, ...data }, OrderType.Subscribe))
              .finally(() => {
                options?.paySuccess?.({ code, data, msg })
              })
          } else {
            options?.payError?.({ code, data, msg })
          }
          options?.afterConfirm?.({ code, data, msg })
        },
      },
    })
  }

  /** 显示扩容弹窗 */
  function onExpand(options: MittEvents['showExpandDialog']) {
    dialog.open(ExpandModal, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
        pt: {
          content: '!pa-0'
        }
      },
      data: {
        onConfirm: async ({ payType, ...purchaseMember }: { payType: PayWay, staff: number, workspace: number }) => {
          const { code, data, msg } = await API.pay.userPaySettlementCreate({
            payType,
            purchaseMember,
            purchaseType: purchaseType.Workspace_Staff,
            orderType: OrderType.Purchase,
          })
          onlyErrorToast(code, msg)
          if (code === 0) {
            if (payType === PayWay.Balance) {
              await purchaseSuccess()
            } else {
              openProcessing({ payType, ...data }, OrderType.Purchase)
                .finally(() => {
                  options?.paySuccess?.({ code, data, msg })
                })
            }
          } else {
            options?.payError?.({ code, data, msg })
          }
          options?.afterConfirm?.({ code, data, msg })
        },
      }
    })
  }
}


