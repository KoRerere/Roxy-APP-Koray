import { useDialog } from 'primevue/usedialog'
import { useUserStore } from '/@/stores/user'
import { usePermission } from '/@/hooks/usePermission'
import { usePay } from '/@/views/pay/wallet/hook'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks'
// import { useSimpleLocale } from '/@/stores/locale'
import type { RoxyGiftsType } from '/@/enums/pay'
import { OrderType, PayWay, PurchaseType } from '/@/enums/pay'
import { isFunction } from 'es-toolkit'
import { API } from '/@/api'
import { emitter } from '/@/utils/eventBus'
import type { MittEvents } from '/@/utils/eventBus'
import { useDialog as useDialogHook } from '/@/hooks/useDialog'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { useRoleStore } from '/@/stores/role'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { enhanceCountdown, genDriver, getImage, getLocalStorageDriverStatus, isMainWindow, setLocalStorageDriverStatus, sleep, supportsApp4_0_0 } from '/@/utils'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { getAccountSetupFormSchemas } from '/@/components/business/global-component/schemas'
import { RxAlert } from '/@/components/rx-alert'
import RxButton from '/@/components/rx-button'
import styles from './schemas.module.css'
import type { OpenBrowserFailureType } from '@roxy/electron-preload'
import { useThemeStore } from '/@/stores/theme'
import { isCurrentEcommerceWorkspace } from '/@/utils/workspace-mode'

const UpgradePayPlan = defineAsyncComponent(() => import('./upgrade-pay-plan.vue'))
const SubscriptionExpired = defineAsyncComponent(() => import('./subscription-expired.vue'))
const RenewalModal = defineAsyncComponent(() => import('/@/views/pay/wallet/components/renewal-modal.vue'))
const ExpandModal = defineAsyncComponent(() => import('/@/views/pay/wallet/components/expand-modal.vue'))
const AppUpgradeTips = defineAsyncComponent(() => import('../app-upgrade-tips/index.vue'))
const WelcomeModal = defineAsyncComponent(() => import('/@/views/tutorial/components/welcome-modal'))
const Score = defineAsyncComponent(() => import('/@/views/tutorial/components/score'))
const BackDefaultWorkspace = defineAsyncComponent(() => import('/@/components/business/global-component/back-default-workspace.vue'))

let isSubscribe = false
let lastFocusTime = Date.now()
let countdown: ReturnType<typeof enhanceCountdown>

export function useSubscribe() {
  if (globalThis.isElectron && (isSubscribe || !isMainWindow)) {
    return
  }

  isSubscribe = true

  const themeStore = useThemeStore()
  const router = useRouter()
  const [showFormDialog] = useFormDialog()
  const { purchaseSuccess, planSuccess, openProcessing } = usePay()
  const dialog = useDialog()
  const [showModal] = useDialogHook()
  const toast = useToast()
  const [showResToast, onlyErrorToast] = useResponseToast()
  const { handleBusinessCode } = useHandleBusinessCode()
  const userStore = useUserStore()
  const { getUserPayInfo, clearUserInfo } = userStore
  const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
  const { isOwner } = storeToRefs(useRoleStore())
  const { check } = usePermission()
  // const { currentLocale } = useSimpleLocale()

  // const $t528 = localStorage.getItem('$T528')

  watchEffect(() => {
    if (userStore.token && userStore.userInfo.onboardingTaskStatus?.firstRegisterGuideStatus) {
      // if (!$t528) {
      //   showTempMambaLastUpdateLog()
      //   return
      // }

      // 检查是否显示新功能提示
      globalThis.electronAPI.send('app:getNewFeatureTips').then((result) => {
        console.log('app:getNewFeatureTips', result)
        const newFeatureTips = result?.filter(item => item.content?.length)
        if (newFeatureTips?.length) {
          showAppUpgradeDialog(newFeatureTips)
        }
        else {
          checkScoreDialog()
        }
      })
    }
  })

  // async function showTempMambaLastUpdateLog() {
  //   if (localStorage.getItem('$T528'))
  //     return

  //   localStorage.setItem('$T528', '1')
  //   const updateFeature = await globalThis.electronAPI.send('app:getLastUpdateFeature')
  //   const localFeature = updateFeature.newFeatureTips?.[currentLocale]
  //   const localContent = localFeature?.[0]?.content ? localFeature : []
  //   const newFeatureTips = localContent?.filter((item: any) => item.content?.length)
  //   console.debug('newFeatureTips', newFeatureTips)
  //   if (newFeatureTips?.length) {
  //     showAppUpgradeDialog(newFeatureTips)
  //   }
  // }

  // 显示toast
  emitter.on('showToast', showToast)
  // 打开页面
  globalThis.electronAPI.on('open:page', (query) => {
    console.log('open:page', query)
    if (query) {
      const searchParams = new URLSearchParams(query)
      const url = searchParams.get('url')
      if (url) {
        sessionStorage.setItem('openPageUrl', url)
        router.push(url)
        if (userStore.userInfo?.id) {
          sessionStorage.removeItem('openPageUrl')
        }
      }
    }
  })

  globalThis.electronAPI.on('dialog:open-browser-failed', (payload) => {
    console.log('dialog:open-browser-failed', payload)
    const messageMap: Record<OpenBrowserFailureType, any> = {
      not_login: $t('当前账号暂未登录，无法同步窗口信息。\n请登录后再打开窗口。'),
      window_not_found: $t('当前窗口已经被删除，无法打开'),
      no_permission: $t('当前账号无权限打开当前窗口。'),
      other_error: payload?.message || '',
      workspace_suspended: showDefaultWorkspaceDialog,
    }
    const message = messageMap[payload?.type] || $t('默认浏览器开启失败，请重新打开。')
    const imageSrc = getImage(`browser/launch-failed-${themeStore.realTheme}.svg`)

    if (isFunction(message)) {
      message()
      return
    }

    showModal({
      header: $t('{windowName} 开启失败', { windowName: payload?.name }),
      class: '!w-384px',
      slots: {
        default: () => {
          return (
            <div class="flex flex-col items-center justify-center gap-4 py-6">
              <img src={imageSrc}></img>
              <div class="whitespace-pre-line text-center font-size-3.5 leading-normal">
                {message}
              </div>
            </div>
          )
        },
        footer: undefined,
      },
    })
  })

  if (supportsApp4_0_0()) {
    globalThis.electronAPI.on('app:browser-cache-root-dir-fallback', (payload) => {
      onlyErrorToast(-1, $t('缓存目录不可用，已恢复为默认路径：{path}', { path: payload.fallbackPath }))
    })
  }

  // showSubscriptionExpiredDialog()
  // showUpgradePlanDialog()

  /** 初始化事件监听 */
  function initListener() {
    // 显示最后一次跟新特性
    emitter.on('showAppUpgradeDialog', showAppUpgradeDialog)
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
    // 显示用户引导
    emitter.on('showUserGuideDialog', showUserGuideDialog)
    // 回到默认空间
    emitter.on('backDefaultWorkspace', showDefaultWorkspaceDialog)
    // 达到窗口打开次数限制
    globalThis.electronAPI.on('browser:window-open-limit', (result) => {
      console.log('browser:window-open-limit', result)
      // 电商模式由设备绑定/续费引导，不弹出窗口额度升级提示
      if (isCurrentEcommerceWorkspace())
        return
      handleBusinessCode(result.code)
    })
    /** 当主窗口聚焦时 */
    globalThis.electronAPI.on('window:on-focus', () => {
      console.log('window:on-focus')
      // 如果距离上一次聚焦时间超过 15 分钟，则刷新一下用户支付信息
      if (Date.now() - lastFocusTime > 1000 * 60 * 15) {
        lastFocusTime = Date.now()
        getUserPayInfo()
      }
    })
  }

  requestIdleCallback(async () => {
    globalThis.electronAPI.send('web:ready')
    console.log('web:ready')
    initListener()
  })

  /** 显示升级套餐弹窗 */
  function showUpgradePlanDialog(alertType: MittEvents['showUpgradePlanDialog']) {
    if (isCurrentEcommerceWorkspace())
      return

    showModal({
      header: 'showUpgradePlanDialog',
      slots: {
        container: ({ hideModal }) => {
          return <UpgradePayPlan hideFn={hideModal} alertType={alertType} />
        },
      },
    })
  }

  /** 显示订阅到期弹窗 */
  function showSubscriptionExpiredDialog() {
    showModal({
      header: $t('订阅已到期'),
      closable: false,
      pt: {
        content: '!overflow-unset',
        title: '!text-[20px]',
      },
      slots: {
        default: ({ hideModal }) => {
          return <SubscriptionExpired hideFn={hideModal} />
        },
        footer: undefined,
      },
    })
  }

  /** 显示 APP 新特性升级弹窗 */
  async function showAppUpgradeDialog(newFeatureTips: any[]) {
    const appVersion = await globalThis.electronAPI.send('app:getAppVersion')
    showModal({
      header: $t('v{appVersion} 更新概览', { appVersion }),
      class: 'w-125 max-h-[90vh] !transform-none',
      pt: {
        root: '!will-change-auto',
        mask: 'z-1002',
      },
      draggable: false,
      handleCancel: () => {
        globalThis.electronAPI.send('app:hideNewFeatureTips')
      },
      slots: {
        default: ({ handleCancel }) => {
          return (
            <AppUpgradeTips
              onSkip={() => {
                handleCancel()
                showMcpDriver()
              }}
              newFeatureTips={newFeatureTips}
            />
          )
        },
        footer: undefined,
      },
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
          content: '!pa-0',
        },
      },
      data: {
        onConfirm: async (params: { isAuto: boolean, payType: PayWay, giftType: RoxyGiftsType, orderNo: string, subscriptionMonths: number }) => {
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
          }
          else {
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
          content: '!pa-0',
        },
      },
      data: {
        props: {
          defaultType: options?.defaultType,
        },
        onConfirm: async ({ payType, ...params }: { payType: PayWay, giftType: RoxyGiftsType, purchaseMember: { staff: number, workspace: number } }) => {
          const { code, data, msg } = await API.pay.userPaySettlementCreate({
            purchaseType: PurchaseType.Workspace_Staff,
            orderType: OrderType.Purchase,
            payType,
            ...params,
          })
          onlyErrorToast(code, msg)
          if (code === 0) {
            if (payType === PayWay.Balance) {
              await purchaseSuccess()
            }
            else {
              openProcessing({ payType, ...data }, OrderType.Purchase)
                .finally(() => {
                  options?.paySuccess?.({ code, data, msg })
                })
            }
          }
          else {
            options?.payError?.({ code, data, msg })
          }
          options?.afterConfirm?.({ code, data, msg })
        },
      },
    })
  }

  /** 显示账号设置弹窗 */
  async function showAccountSetupDialog() {
    const formInstance = await showFormDialog({
      header: $t('账号设置'),
      class: 'w-[400px]',
      closable: false,
      pt: {
        mask: '!backdrop-blur-md',
      },
      schemas: getAccountSetupFormSchemas(),
      formProps: {
        layout: 'vertical',
      },
      dialogSlots: {
        beforeForm: () => (
          <RxAlert
            visible={true}
            type="info"
            title={$t('为了提高账户安全性，请添加邮箱地址并设置密码。')}
            closable={false}
            class="w-full"
          />
        ),
        footer: () => (
          <div class="w-full">
            <RxButton class="w-full" onClick={() => formInstance.handleOk()}>{$t('确定')}</RxButton>
            <div class={[styles.text, 'mt-[16px]']}>
              {$t('已有账号？')}
              <a onClick={toLogin} class={styles.link}>
                {' '}
                {$t('点击返回登录页面。')}
              </a>
            </div>
          </div>
        ) as any,
      },
      handleOk: async (params: any) => {
        const res = await API.base.userSettingAccountPasswordCreate({ ...params })
        onlyErrorToast(res.code, res.msg)
        if (res.code === 0 && params.password) {
          userStore.setPassword(params.password)
          showResToast(0, $t('邮箱和密码设置成功'))
          userStore.fetchUserInfo()
        }
        else {
          return Promise.reject(res.msg)
        }
      },
    })

    function toLogin() {
      router.push({ name: 'login' })
      formInstance.handleCancel()
      clearUserInfo()
    }
  }

  function showUserGuideDialog() {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      closeOnEscape: false,
      pt: {
        root: '!border-none !shadow-none rounded-lg',
      },
      handleCancel: async () => {
        await globalThis.electronAPI.send('app:hideNewFeatureTips')
        updateOnboardingTaskStatus({ firstRegisterGuideStatus: true, firstWebRegisterGuideStatus: true })
      },
      slots: {
        container: ({ handleCancel }) => <WelcomeModal onClose={handleCancel} />,
      },
    })
  }

  async function showMcpDriver() {
    if (getLocalStorageDriverStatus('mcpGuide') || !check('Roxy_AI_Agent_All'))
      return

    await Promise.all([
      sleep(50), // 延迟 50ms 让外部元素加载完成
      nextTick(),
    ])

    const driverObj = genDriver({
      steps: [
        {
          element: '#mcp',
          popover: {
            description: $t('Roxy AI Agent 可以帮你管理浏览器窗口、平台账号还有代理 IP，并帮助您实现浏览器的自动化操作'),
            side: 'left',
            align: 'center',
          },
        },
      ],
      onDestroyed: () => {
        setLocalStorageDriverStatus('mcpGuide', true)
        checkScoreDialog()
      },
    })
    driverObj.drive()
  }

  function checkScoreDialog() {
    countdown?.stop()

    if (userStore.userInfo.onboardingTaskStatus?.autoRatingStatus === false) {
      const $score_timestamp = localStorage.getItem('$score_timestamp')
      const default_timestamp = Date.now() + 3 * 24 * 60 * 60 * 1000

      if (!$score_timestamp) {
        localStorage.setItem('$score_timestamp', default_timestamp.toString())
      }

      countdown = enhanceCountdown(Number($score_timestamp || default_timestamp), () => { }, {
        onEnd: () => {
          localStorage.removeItem('$score_timestamp')
          showModal({
            showHeader: false,
            modal: true,
            blockScroll: true,
            slots: {
              container: ({ hideModal }) => <Score openType="system_pop" onClose={hideModal}></Score>,
            },
          })
        },
      })
    }
  }

  function showDefaultWorkspaceDialog() {
    // 解决网络过慢时，用户已回到默认空间，封禁空间接口才返回结果导致误弹出
    if (isOwner.value)
      return
    showModal({
      header: 'key',
      showHeader: false,
      modal: true,
      blockScroll: true,
      closeOnEscape: false,
      pt: {
        mask: '!backdrop-blur-md',
      },
      slots: {
        container: ({ hideModal }) => <BackDefaultWorkspace onClose={hideModal}></BackDefaultWorkspace>,
      },
    })
  }
}
