import { useDialog } from "primevue/usedialog"
import { useUserStore } from "/@/stores/user"
import { usePay } from "/@/views/pay/wallet/hook.tsx"
import { useResponseToast } from "/@/hooks/useResponseToast";
import { OrderType, PayWay, PurchaseType } from "/@/enums/pay";
import { API } from "/@/api";
import { emitter, type MittEvents } from "/@/utils/eventBus";
import { useDialog as useDialogHook } from '/@/hooks/useDialog'
import type { ToastMessageOptions } from "primevue/toast";
import { useToast } from 'primevue/usetoast'
import { $t } from "/@/locales";
import { useHandleBusinessCode } from "/@/hooks/useResponseToast/handleBusinessCode";
import { isMainWindow } from "/@/utils";
import { useFormDialog } from "/@/hooks/useFormDialog";
import { getAccountSetupFormSchemas } from "/@/components/business/global-component/schemas";
import { RxAlert } from "/@/components/rx-alert";
import RxButton from "/@/components/rx-button";
import styles from './schemas.module.css'

const UpgradePayPlan = defineAsyncComponent(() => import('./upgrade-pay-plan.vue'))
const SubscriptionExpired = defineAsyncComponent(() => import('./subscription-expired.vue'))
const RenewalModal = defineAsyncComponent(() => import('/@/views/pay/wallet/components/renewal-modal.vue'))
const ExpandModal = defineAsyncComponent(() => import('/@/views/pay/wallet/components/expand-modal.vue'))
const AppUpgradeTips = defineAsyncComponent(() => import('../app-upgrade-tips/index.vue'))

let isSubscribe = false
let lastFocusTime = Date.now()

export function useSubscribe() {

  if (isSubscribe || !isMainWindow) {
    return
  }

  isSubscribe = true

  const router = useRouter()
  const [showFormDialog] = useFormDialog();
  const { purchaseSuccess, planSuccess, openProcessing } = usePay()
  const dialog = useDialog()
  const [showModal] = useDialogHook()
  const toast = useToast()
  const [showResToast, onlyErrorToast] = useResponseToast()
  const { handleBusinessCode } = useHandleBusinessCode()
  const userStore = useUserStore()
  const { getUserPayInfo, clearUserInfo } = userStore

  watchEffect(() => {
    if (userStore.token) {
      // 检查是否显示新功能提示
      electronAPI.send('app:getNewFeatureTips').then((result) => {
        console.log('app:getNewFeatureTips', result)
        const newFeatureTips = result?.filter(item => item.content?.length)
        if (newFeatureTips?.length) {
          showAppUpgradeDialog(newFeatureTips)
        }
      })
    }
  })

  // 显示toast
  emitter.on('showToast', showToast)
  // showSubscriptionExpiredDialog()
  // showUpgradePlanDialog()


  /** 初始化事件监听 */
  function initListener() {

    // 显示升级套餐弹窗
    emitter.on('showUpgradePlanDialog', showUpgradePlanDialog)
    // 显示订阅到期弹窗
    emitter.on('showSubscriptionExpiredDialog', showSubscriptionExpiredDialog)
    // 显示续费弹窗
    emitter.on('showRenewalDialog', onRenewal)
    // 显示扩容弹窗
    emitter.on('showExpandDialog', onExpand)
    // 显示账号设置弹窗
    emitter.on('showAccountSetupDialog', showAccountSetupDialog)

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
    initListener()
  })

  /** 显示升级套餐弹窗 */
  function showUpgradePlanDialog(alertType: MittEvents['showUpgradePlanDialog']) {

    showModal({
      header: 'showUpgradePlanDialog',
      slots: {
        container: ({ hideModal }) => {
          return <UpgradePayPlan hideFn={hideModal} alertType={alertType} />
        },
      }
    })
  }

  /** 显示订阅到期弹窗 */
  function showSubscriptionExpiredDialog() {
    showModal({
      header: $t('订阅已到期'),
      closable: false,
      pt: {
        content: '!overflow-unset',
        title: '!text-[20px]'
      },
      slots: {
        default: ({ hideModal }) => {
          return <SubscriptionExpired hideFn={hideModal} />
        },
        footer: undefined
      }
    })
  }

  /** 显示 APP 新特性升级弹窗 */
  function showAppUpgradeDialog(newFeatureTips: string[]) {
    showModal({
      header: $t('v{appVersion} 更新概览', { appVersion: userStore.appVersion }),
      class: 'w-[500px] max-h-[90vh]',
      draggable: false,
      handleCancel: () => {
        electronAPI.send('app:hideNewFeatureTips')
      },
      slots: {
        default: ({ hideModal }) => {
          return <AppUpgradeTips onSkip={hideModal} newFeatureTips={newFeatureTips} />
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
        props: {
          defaultType: options?.defaultType
        },
        onConfirm: async ({ payType, ...purchaseMember }: { payType: PayWay, staff: number, workspace: number }) => {
          const { code, data, msg } = await API.pay.userPaySettlementCreate({
            payType,
            purchaseMember,
            purchaseType: PurchaseType.Workspace_Staff,
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

  /** 显示账号设置弹窗 */
  async function showAccountSetupDialog() {

    function toLogin() {
      router.push({ name: 'login' })
      formInstance.handleCancel()
      clearUserInfo()
    }

    const formInstance = await showFormDialog({
      header: $t("账号设置"),
      class: "w-[400px]",
      closable: false,
      schemas: getAccountSetupFormSchemas(),
      formProps: {
        layout: "vertical",
      },
      dialogSlots: {
        beforeForm: () => (
          <RxAlert
            visible={true}
            type="info"
            title={$t("为了提高账户安全性，请添加邮箱地址并设置密码。")}
            closable={false}
            class="w-full"
          />
        ),
        footer: () => <div class="w-full">
          <RxButton class="w-full" onClick={() => formInstance.handleOk()}>{$t("确定")}</RxButton>
          <div class={[styles.text, 'mt-[16px]']}>
            {$t('已有账号？')}
            <a onClick={toLogin} class={styles.link}> {$t('点击返回登录页面。')}</a>
          </div>
        </div>
      },
      handleOk: async (params: any) => {
        const res = await API.base.userSettingAccountPasswordCreate({ ...params });
        onlyErrorToast(res.code, res.msg);
        if (res.code === 0 && params.password) {
          userStore.setPassword(params.password);
          showResToast(0, $t("邮箱和密码设置成功"));
          userStore.fetchUserInfo();
        } else {
          return Promise.reject(res.msg);
        }
      },
    });
  }
}

