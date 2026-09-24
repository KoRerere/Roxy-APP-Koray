import { useDialog } from 'primevue/usedialog'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { usePay } from '/@/views/pay/wallet/hook'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks'
import type { RoxyGiftsType } from '/@/enums/pay'
import { OrderType, PayWay, PurchaseType } from '/@/enums/pay'
import { isFunction } from 'es-toolkit'
import { API } from '/@/api'
import { emitter } from '/@/utils/eventBus'
import type { MittEvents, ShowAppUpgradeDialogPayload } from '/@/utils/eventBus'
import { useDialog as useDialogHook } from '/@/hooks/useDialog'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { useRoleStore } from '/@/stores/role'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { enhanceCountdown, getImage, hidePageLoading, isMainWindow, supportsApp4_0_0 } from '/@/utils'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { getAccountSetupFormSchemas } from '/@/components/business/global-component/schemas'
import { RxAlert } from '/@/components/rx-alert'
import RxButton from '/@/components/rx-button'
import styles from './schemas.module.css'
import type { OpenBrowserFailureType } from '@roxy/electron-preload'
import { useThemeStore } from '/@/stores/theme'
import { useCampaignStore } from '/@/stores/campaign'
import { getWorkspaceTypeLandingRoute, isCurrentEcommerceWorkspace } from '/@/utils/workspace-mode'
import { REDIRECT_ACTION, RedirectAction } from '/@/constants/search-params-key'
import { CONSUMED_REDIRECT_ACTION, HANDLED_OPEN_PAGE_QUERY, PENDING_REDIRECT_ACTION, PROTOCOL_AUTO_LOGIN_PENDING } from '/@/constants/storage-key'
import { isLoginRoute } from '/@/router/navigation'

const UpgradePayPlan = defineAsyncComponent(() => import('./upgrade-pay-plan.vue'))
const SubscriptionExpired = defineAsyncComponent(() => import('./subscription-expired.vue'))
const RenewalModal = defineAsyncComponent(() => import('/@/views/pay/wallet/components/renewal-modal.vue'))
const ExpandModal = defineAsyncComponent(() => import('/@/views/pay/wallet/components/expand-modal.vue'))
const RedeemCodeRecord = defineAsyncComponent(() => import('/@/layout/components/header/profile/components/record.vue'))
const AppUpgradeTips = defineAsyncComponent(() => import('../app-upgrade-tips/index.vue'))
const WelcomeModal = defineAsyncComponent(() => import('/@/views/tutorial/components/welcome-modal'))
const Score = defineAsyncComponent(() => import('/@/views/tutorial/components/score'))
const BackDefaultWorkspace = defineAsyncComponent(() => import('/@/components/business/global-component/back-default-workspace.vue'))

let isSubscribe = false
/** 本会话是否已调度过评价弹窗检查（切空间 / 登出重置） */
let hasCheckedScoreDialog = false
/** 定向消息弹窗是否已打开，避免 header 连变叠层 */
let isShowingMessageTips = false
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
  const { purchaseSuccess, planSuccess, openProcessing, walletRecharge } = usePay()
  const dialog = useDialog()
  const [showModal] = useDialogHook()
  const toast = useToast()
  const [showResToast, onlyErrorToast] = useResponseToast()
  const { handleBusinessCode } = useHandleBusinessCode()
  const userStore = useUserStore()
  const { currentWorkspace } = storeToRefs(useWorkspaceStore())
  const { getUserPayInfo, clearUserInfo } = userStore
  const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
  const { isOwner } = storeToRefs(useRoleStore())

  watchEffect(() => {
    if (!globalThis.isElectron) {
      return
    }

    // token 清空时 effect 会重跑，顺带重置本会话检查标记，无需额外 watch
    if (!userStore.token) {
      hasCheckedScoreDialog = false
      return
    }
    if (!userStore.userInfo.onboardingTaskStatus?.firstRegisterGuideStatus) {
      return
    }

    const workspace = currentWorkspace.value
    if (!workspace?.id || hasCheckedScoreDialog) {
      return
    }

    hasCheckedScoreDialog = true
    // 更新公告已前置到下载完成（ResourceUpdater）；登录就绪后只调度评价弹窗
    checkScoreDialog()
  })

  // 显示toast
  emitter.on('showToast', showToast)
  // 打开页面 / 官网 auto-login
  if (globalThis.isElectron) {
    globalThis.electronAPI.on('open:page', (query) => {
      console.log('open:page', redactDeepLinkQuery(query))
      void (async () => {
        await userStore.hasCallInitUserInfo.promise
        await handleOpenPageDeepLink(query, 'ipc')
      })()
    })
    // 9.2.7 起有 takePendingOpenPage；旧包会进 catch。热更新 web 仍可消费当前包已有的 pending IPC。
    void consumePendingOpenPage()
  }

  function redactDeepLinkQuery(query: string) {
    return query.replace(/([?&]token=)[^&]*/gi, '$1***')
  }

  function decodeQueryComponent(value: string) {
    try {
      return decodeURIComponent(value)
    }
    catch {
      return value
    }
  }

  /** 不用 URLSearchParams：它会把 token 里的 + 变成空格，官网 JWT 会被打坏并 403 */
  function getDeepLinkParam(search: string, key: string) {
    const raw = search.startsWith('?') ? search.slice(1) : search
    const qIndex = raw.indexOf('?')
    const query = qIndex >= 0 ? raw.slice(qIndex + 1) : raw
    for (const part of query.split('&')) {
      if (!part) {
        continue
      }
      const eq = part.indexOf('=')
      const name = decodeQueryComponent(eq === -1 ? part : part.slice(0, eq))
      if (name !== key) {
        continue
      }
      return decodeQueryComponent(eq === -1 ? '' : part.slice(eq + 1))
    }
    return ''
  }

  let lastHandledOpenPageQuery = ''

  /** 不把 JWT 写入 sessionStorage，用脱敏后的 query 识别同一条深链 */
  function getOpenPageConsumptionKey(query: string) {
    return query.trim().replace(/([?&]token=)[^&]*/gi, '$1')
  }

  /** 当前 session 是否已经消费过这条深链（刷新后仍生效） */
  function wasOpenPageQueryHandled(query: string) {
    const key = getOpenPageConsumptionKey(query)
    return Boolean(key) && sessionStorage.getItem(HANDLED_OPEN_PAGE_QUERY) === key
  }

  /** 记下已消费的深链，避免 location.reload 后 Electron leftover pending 再打开弹窗 */
  function markOpenPageQueryHandled(query: string) {
    const key = getOpenPageConsumptionKey(query)
    if (key) {
      sessionStorage.setItem(HANDLED_OPEN_PAGE_QUERY, key)
    }
  }

  /** 顶部「刷新客户端」走 location.reload，主进程 leftover pending 不应再消费 */
  function isRendererReload() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return navigation?.type === 'reload'
  }

  /** dispatchDeepLink 在 take 之后仍可能把 pending 写回去，处理完再清掉，避免刷新重放 */
  async function discardStalePendingOpenPage() {
    try {
      await globalThis.electronAPI.send('deep-link:takePendingOpenPage')
    }
    catch {
      // 旧包没有这条 IPC
    }
  }

  async function consumePendingOpenPage() {
    try {
      await userStore.hasCallInitUserInfo.promise
      const pending = await globalThis.electronAPI.send('deep-link:takePendingOpenPage')
      if (!pending) {
        return
      }
      if (isRendererReload() || wasOpenPageQueryHandled(pending)) {
        console.log('[auto-login] skip leftover pending after refresh', redactDeepLinkQuery(pending))
        return
      }
      console.log('[auto-login] consume pending open-page', redactDeepLinkQuery(pending))
      await handleOpenPageDeepLink(pending, 'pending')
    }
    catch (error) {
      console.warn('[auto-login] takePendingOpenPage unavailable', error)
    }
  }

  async function getElectronToken() {
    try {
      const softConfig = await globalThis.electronAPI.send('app:getSoftConfig')
      return softConfig?.token || ''
    }
    catch {
      return ''
    }
  }

  /** App 是否已有登录账号：渲染态或 Electron 持久化 token，二有其一即视为已登录 */
  async function hasLocalAccount() {
    if (userStore.token && userStore.userInfo?.id) {
      return true
    }
    return Boolean(await getElectronToken())
  }

  /** 与登录页 jumpHome 同一条进空间路径：initUserInfo → enterWorkspace → 落地页 */
  async function loginByProtocolToken(nextToken: string) {
    await userStore.hasCallInitUserInfo.promise

    if (await hasLocalAccount()) {
      console.log('[auto-login] skip protocol token, local account exists', {
        rendererUserId: userStore.userInfo?.id,
        hasRendererToken: Boolean(userStore.token),
      })
      if (isLoginRoute() && userStore.userInfo?.id) {
        await replaceToWorkspaceLanding()
      }
      return
    }

    console.log('[auto-login] signing in with protocol token', {
      onLoginPage: isLoginRoute(),
      tokenLength: nextToken.length,
    })
    sessionStorage.setItem(PROTOCOL_AUTO_LOGIN_PENDING, '1')
    try {
      userStore.setToken(nextToken, { fromOfficialSite: true })
      if (userStore.token !== nextToken) {
        console.warn('[auto-login] official-site token was rejected, keep local session')
        return
      }
      useWorkspaceStore().resetWorkspace()
      await userStore.initUserInfo(undefined, { enterWorkspace: false })
      if (!userStore.userInfo?.id) {
        console.warn('[auto-login] failed to load user info')
        return
      }

      await userStore.enterWorkspace(userStore.userInfo.workspaceId)
      await replaceToWorkspaceLanding()
    }
    finally {
      sessionStorage.removeItem(PROTOCOL_AUTO_LOGIN_PENDING)
    }
  }

  async function replaceToWorkspaceLanding() {
    const name = getWorkspaceTypeLandingRoute(
      currentWorkspace.value?.workspaceType ?? userStore.userInfo.workspaceType,
      userStore.userInfo.role,
    )
    await router.replace({ name })
    hidePageLoading()
  }

  let applyingRedirectAction = false
  let openedRedirectAction = ''

  function openRedeemCodeRecord() {
    showModal({
      uniqueKey: 'redeem-code-record',
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => <RedeemCodeRecord onClose={hideModal}></RedeemCodeRecord>,
      },
    })
  }

  function openWalletRechargeFromProtocol() {
    walletRecharge({
      next: (data) => {
        openProcessing(data, OrderType.Recharge)
          .finally(() => {
            emitter.emit('updateBillList')
            getUserPayInfo()
          })
      },
    })
  }

  /** 弹窗由 GlobalComponent 打开；同一条 redirect-action 只执行一次，刷新后也不重放 */
  async function applyRedirectAction(action = sessionStorage.getItem(PENDING_REDIRECT_ACTION)) {
    if (!action || applyingRedirectAction || openedRedirectAction === action) {
      return
    }
    if (sessionStorage.getItem(CONSUMED_REDIRECT_ACTION) === action) {
      sessionStorage.removeItem(PENDING_REDIRECT_ACTION)
      return
    }
    if (!userStore.userInfo?.id || isLoginRoute()) {
      return
    }

    applyingRedirectAction = true
    sessionStorage.removeItem(PENDING_REDIRECT_ACTION)
    try {
      await nextTick()
      if (isLoginRoute() || !userStore.userInfo?.id) {
        sessionStorage.setItem(PENDING_REDIRECT_ACTION, action)
        return
      }
      if (openedRedirectAction === action || sessionStorage.getItem(CONSUMED_REDIRECT_ACTION) === action) {
        return
      }
      openedRedirectAction = action
      sessionStorage.setItem(CONSUMED_REDIRECT_ACTION, action)

      if (action === RedirectAction.OpenRedeemCodeRecord) {
        openRedeemCodeRecord()
        return
      }
      if (action === RedirectAction.OpenExpandTeam) {
        onExpand()
        return
      }
      if (action === RedirectAction.OpenWalletRecharge) {
        openWalletRechargeFromProtocol()
        return
      }
      console.warn('[auto-login] unknown redirect-action', action)
    }
    finally {
      applyingRedirectAction = false
    }
  }

  /**
   * 消费官网深链。pending 残留是刷新重放路径，已处理过的 query 直接丢弃；
   * ipc 才是用户再次从官网唤起，允许重新弹窗。
   */
  async function handleOpenPageDeepLink(query: string, source: 'pending' | 'ipc') {
    const normalized = query.trim()
    if (!normalized) {
      return
    }
    if (lastHandledOpenPageQuery === normalized) {
      await discardStalePendingOpenPage()
      return
    }
    // 先占住本次 query，避免 consumePending 与 open:page 并行各开一次
    lastHandledOpenPageQuery = normalized
    if (source === 'pending' && wasOpenPageQueryHandled(normalized)) {
      console.log('[auto-login] skip leftover pending after refresh', redactDeepLinkQuery(normalized))
      await discardStalePendingOpenPage()
      return
    }

    markOpenPageQueryHandled(normalized)

    if (source === 'ipc') {
      openedRedirectAction = ''
      sessionStorage.removeItem(CONSUMED_REDIRECT_ACTION)
    }
    else if (sessionStorage.getItem(CONSUMED_REDIRECT_ACTION)) {
      await discardStalePendingOpenPage()
      return
    }
    else {
      openedRedirectAction = ''
    }

    const protocolToken = getDeepLinkParam(normalized, 'token')
    const redirectAction = getDeepLinkParam(normalized, REDIRECT_ACTION)
    const url = getDeepLinkParam(normalized, 'url')

    if (redirectAction && sessionStorage.getItem(CONSUMED_REDIRECT_ACTION) !== redirectAction) {
      sessionStorage.setItem(PENDING_REDIRECT_ACTION, redirectAction)
    }

    if (protocolToken) {
      await loginByProtocolToken(protocolToken)
    }
    else {
      console.warn('[auto-login] open-page without token', redactDeepLinkQuery(normalized))
    }

    if (url) {
      sessionStorage.setItem('openPageUrl', url)
      await router.push(url)
      if (userStore.userInfo?.id) {
        sessionStorage.removeItem('openPageUrl')
      }
    }

    await applyRedirectAction()
    await discardStalePendingOpenPage()
  }

  if (globalThis.isElectron) {
    // 登录切页时本次 apply 可能仍在 login 路由；落地后再消费一次
    router.afterEach(() => {
      if (!sessionStorage.getItem(PENDING_REDIRECT_ACTION)) {
        return
      }
      queueMicrotask(() => {
        void applyRedirectAction()
      })
    })
  }

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
    // 定向消息弹窗
    emitter.on('showMessageTipsDialog', showMessageTipsDialog)
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
      if (isCurrentEcommerceWorkspace()) {
        return
      }
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

  // 下载完成可能早于 idle：更新公告监听须尽早注册，避免丢事件
  emitter.on('showAppUpgradeDialog', showAppUpgradeDialog)

  requestIdleCallback(async () => {
    globalThis.electronAPI.send('web:ready')
    console.log('web:ready')
    initListener()
  })

  /** 显示升级套餐弹窗 */
  function showUpgradePlanDialog(alertType: MittEvents['showUpgradePlanDialog']) {
    if (isCurrentEcommerceWorkspace()) {
      return
    }

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

  /** 显示 APP 更新公告弹窗（前置升级 / 上次更新日志） */
  async function showAppUpgradeDialog(payload: ShowAppUpgradeDialogPayload) {
    const { tips, actionMode = 'dismiss', updateItem } = payload
    if (!tips?.length) {
      return
    }

    const appVersion = await globalThis.electronAPI.send('app:getAppVersion')
    const headerVersion = updateItem?.version || appVersion
    const header = actionMode === 'upgrade'
      ? $t('检测到新版本 v{appVersion}', { appVersion: headerVersion })
      : $t('v{appVersion} 更新概览', { appVersion: headerVersion })

    showModal({
      // 标题含版本号，不能当去重 key；挂机后再触发间隔提醒时复用同一层
      uniqueKey: 'appUpgradeDialog',
      header,
      class: 'w-125 max-h-[90vh] !transform-none',
      pt: {
        root: '!will-change-auto',
        mask: 'z-1002',
      },
      draggable: false,
      slots: {
        default: ({ handleCancel }) => {
          return (
            <AppUpgradeTips
              actionMode={actionMode}
              onSkip={() => {
                handleCancel()
                if (actionMode === 'dismiss') {
                  checkScoreDialog()
                }
              }}
              onUpgrade={() => {
                handleCancel()
                // 自动弹窗已展示更新内容，不再二次确认，直接走现有安装流程
                globalThis.electronAPI.send('app:quitAndInstall', updateItem || { type: 'app' })
              }}
              newFeatureTips={tips}
            />
          )
        },
        footer: undefined,
      },
    })
  }

  /** 显示定向消息弹窗（复用 AppUpgradeTips 富文本翻页） */
  function showMessageTipsDialog(tips: MittEvents['showMessageTipsDialog']) {
    if (isShowingMessageTips || !tips?.length) {
      return
    }

    isShowingMessageTips = true
    showModal({
      header: $t('消息提醒'),
      class: 'w-125 max-h-[90vh] !transform-none',
      pt: {
        root: '!will-change-auto',
        mask: 'z-1002',
      },
      draggable: false,
      handleCancel: () => {
        isShowingMessageTips = false
      },
      slots: {
        default: ({ handleCancel }) => {
          return (
            <AppUpgradeTips
              onSkip={() => {
                handleCancel()
              }}
              newFeatureTips={tips}
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
        defaultDays: options?.defaultDays,
        onConfirm: async (params: { isAuto: boolean, payType: PayWay, giftType: RoxyGiftsType, orderNo: string, subscriptionDays: number }) => {
          const { code, data, msg } = await API.pay.userPaySettlementCreate({
            ...params,
            orderType: OrderType.Renew,
          })
          onlyErrorToast(code, msg)
          if (code === 0) {
            (params.payType === PayWay.Balance ? planSuccess() : openProcessing({ payType: params.payType, ...data }, OrderType.Subscribe))
              .finally(() => {
                // 续费时勾选自动续费会新建订阅关系，钱包页「自动续费服务」列表常驻挂载，需主动同步
                if (params.isAuto) {
                  emitter.emit('updateAutoRenewList')
                }
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
          insufficient: options?.insufficient,
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

  function checkScoreDialog() {
    countdown?.stop()

    // 活动期间不自动弹评价，避免与活动海报抢焦点
    if (useCampaignStore().seasonalActivity.active) {
      return
    }

    if (userStore.userInfo.onboardingTaskStatus?.autoRatingStatus === false) {
      const $score_timestamp = localStorage.getItem('$score_timestamp')
      const default_timestamp = Date.now() + 3 * 24 * 60 * 60 * 1000

      if (!$score_timestamp) {
        localStorage.setItem('$score_timestamp', default_timestamp.toString())
      }

      countdown = enhanceCountdown(Number($score_timestamp || default_timestamp), () => { }, {
        onEnd: () => {
          localStorage.removeItem('$score_timestamp')
          // 倒计时结束时若仍在活动期，跳过本次自动弹出
          if (useCampaignStore().seasonalActivity.active) {
            return
          }
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
    if (isOwner.value) {
      return
    }
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
