import { onBeforeUnmount, ref, shallowRef } from 'vue'
import RxButton from '/@/components/rx-button'
import ChooseModal from '/@/views/agent/shop/components/choose-modal.vue'
import DownloadModal from '/@/views/agent/shop/components/download-modal.vue'
import ProxyDownloadKycBlockModal from '/@/views/agent/shop/components/proxy-download-kyc-block-modal.vue'
import RenewModal from '/@/views/agent/shop/components/renew-modal.vue'
import UpgradeModal from '/@/views/agent/shop/components/upgrade-modal.vue'
import BeforeClose from '/@/views/agent/shop/components/provider-buy/before-close.vue'
import { useConcurrentTaskTopBar } from '/@/components/concurrent-task-top-bar'
import { format } from 'date-fns'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { BuyEntryType, ProxyCheckStatus, ProxyExpireStatus, ProxyType, WorkspaceType } from '/@/enums'
import { concurrentControl, createDefaultObject, decryptAESGCM, deepClone, safeParseJSON, strConcat } from '/@/utils'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useRoleStore } from '/@/stores/role'
import { useSimpleLocale } from '/@/stores/locale'
import {
  fetchWorkspaceKycUnlockedCached,
  getProxyDownloadBlockVariant,
  hasBuyProxy,
  resolveProxyDownloadRows,
} from '/@/views/agent/shop/utils/proxy-download-kyc-gate'
import { createProxyShopLabels } from '/@/views/agent/shop/utils/proxy-shop-labels'
import { isProxyDetectSystemError, isRoxyIpProxyType, pickPreferredBuyCountry, resolveProxyDetectFailGuide } from '/@/views/agent/shop/utils/proxy-detect-fail-guide'
import ProxyDetectFailAd from '/@/views/agent/shop/components/proxy-detect-fail-ad.vue'
import { isCurrentEcommerceWorkspace } from '/@/utils/workspace-mode'
import { emitter } from '/@/utils/eventBus'
import type { ProxyItem } from '/@/views/agent/shop/operation'
import type { ProxyDetectionParams } from '#roxybrowser/utils/proxyDetection'
import type { UserBuyProxySettlementCreateData } from '@roxy/backend-api'

export interface CheckResult {
  loading: boolean
  error?: any
  checkStatus: ProxyCheckStatus
  lastIp?: string
  lastCity?: string
  lastCountry?: string
  checkTime?: string
  timezone?: string
  proxyType?: ProxyType
  /** IPC / 本地网络等系统异常，不触发失败引导 */
  systemError?: boolean
  /** 第三方失败时保留的检测前国家码，只给 toast 购买弹窗做默认国家，不写回列表 */
  preDetectLastCountry?: string
}

interface ProxyCheckParams extends Partial<ProxyDetectionParams> {
  isEncryptProxy?: boolean
  proxyEncryptInfo?: string
  apiCheck?: boolean
  id?: number
  lastCountry?: string
  proxyType?: ProxyType
  /** 窗口行用 buyProxyType 区分来源，测速入参可能只有它 */
  buyProxyType?: ProxyType
}

/** 并发任务单条结果（filter(Boolean) 之后），含行 id / proxyType 供业务筛选 */
export type ConcurrentProxyValidResult = CheckResult & { id?: number, proxyType?: ProxyType }

/** concurrentControl 原始结果槽位，未执行到的为 undefined */
export type ConcurrentProxyTestResults = Array<ConcurrentProxyValidResult | undefined>

export interface BatchTestShowToastOptions {
  reCheck?: () => any | Promise<any>
  /** @deprecated 引导改由失败 IP 来源自动判断，保留以免旧调用方类型报错 */
  showSupport?: boolean
  /** 有费用中心权限时打开当前场景购买；默认走官方购买弹窗 */
  onBuy?: () => void
}

export type ConcurrentProxyTestNext = (results: ConcurrentProxyTestResults, cancelled: boolean) => void | Promise<void>

/** 单次并发测速运行参数：tasks 由业务构造（含每条测速与 loading 等） */
export interface ConcurrentProxyTestRun {
  tasks: Array<() => Promise<any | undefined>>
  tasksCompleted?: ConcurrentProxyTestNext
  /** 是否展示顶部并发任务进度条，默认不展示 */
  showConcurrentTaskTopBar?: boolean
}

interface useCheckProxyResult {
  testProxy: (data: ProxyCheckParams) => Promise<CheckResult>
  batchTestShowToast: (results: CheckResult | CheckResult[], options?: BatchTestShowToastOptions) => void
  concurrentProxyTest: (run: ConcurrentProxyTestRun) => Promise<void>
}

interface DownloadProxyParams {
  items: ProxyItem[]
  cancel?: () => void
  confirm?: () => void
}

export function useCheckProxy(): useCheckProxyResult {
  const router = useRouter()
  const [showToast] = useResponseToast()
  const { buyProxy } = useProxy()
  const simpleLocale = useSimpleLocale()
  const concurrentTaskTopBar = useConcurrentTaskTopBar()
  const hostUnmounted = ref(false)
  const speedTestAbort = shallowRef<AbortController | null>(null)
  /** 并发测速互斥（不依赖顶栏 isOpen，顶栏关闭时仍需阻止重复进入） */
  const concurrentProxyTestBusy = ref(false)

  onBeforeUnmount(() => {
    hostUnmounted.value = true
    speedTestAbort.value?.abort()
  })

  async function testBuyProxy(proxyBuyId: number): Promise<CheckResult> {
    const { code, data, msg } = await API.proxy.userCheckProxyCreate({ proxyBuyId })
    if (code !== 0) {
      return {
        loading: false,
        ...data,
        ...createDefaultObject(['lastIp', 'lastCity', 'lastCountry', 'timezone'], ''),
        checkStatus: ProxyCheckStatus.failure,
        error: msg,
      } as CheckResult
    }
    return {
      loading: false,
      ...data,
    } as CheckResult
  }

  async function testProxy({ isEncryptProxy, proxyEncryptInfo, apiCheck, id, ...data }: ProxyCheckParams): Promise<CheckResult> {
    // 购买的代理需要后台检测可用性
    if (apiCheck && id) {
      return testBuyProxy(id)
    }

    const local: CheckResult = {
      loading: true,
      checkStatus: ProxyCheckStatus.failure,
    }

    const checkData = deepClone(data)
    // 失败后 lastCountry 会被清空；第三方才留下检测前国家码给 toast 购买默认选中
    const incomingLastCountry = typeof data.lastCountry === 'string' ? data.lastCountry.trim() : ''
    const incomingProxyType = data.proxyType ?? data.buyProxyType

    if (isEncryptProxy && proxyEncryptInfo) {
      const decryptedProxyEncryptInfo = await decryptAESGCM(proxyEncryptInfo)
      Object.assign(checkData, decryptedProxyEncryptInfo)
    }

    checkData.dirId ||= Math.random().toString(36).slice(2)

    try {
      const checkRes = await globalThis.electronAPI.send('proxy:detect', checkData as ProxyDetectionParams)
      local.checkStatus = !checkRes.ip ? ProxyCheckStatus.failure : ProxyCheckStatus.success
      local.lastIp = checkRes.ip ?? ''
      local.lastCity = checkRes.city ?? ''
      local.lastCountry = checkRes.country_code ?? ''
      local.timezone = checkRes.timezone ?? ''
    }
    catch (error: any) {
      local.error = error
      local.checkStatus = ProxyCheckStatus.failure
      // 代理连不上走 reject，不是 IPC 宕了；误标 systemError 会导致第三方失败永远不出广告
      local.systemError = isProxyDetectSystemError(error)
      local.lastIp = ''
      local.lastCity = ''
      local.lastCountry = ''
      local.timezone = ''
    }
    finally {
      local.checkTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
      local.loading = false
      checkData.dirId && globalThis.electronAPI.send('proxy:delRoxynetProxy', checkData.dirId)
    }
    if (
      incomingLastCountry
      && local.checkStatus === ProxyCheckStatus.failure
      && !local.systemError
      && !isRoxyIpProxyType(incomingProxyType)
    ) {
      local.preDetectLastCountry = incomingLastCountry
    }
    return { ...local }
  }

  function batchTestShowToast(__results: CheckResult | CheckResult[], options?: BatchTestShowToastOptions) {
    const results = (Array.isArray(__results) ? __results : [__results]).filter(Boolean)
    const guide = resolveProxyDetectFailGuide(results)
    const preferredCountry = pickPreferredBuyCountry(results)
    const toastLife = guide ? { life: 8000 } : undefined

    if (results.length === 1) {
      const checkRes = results[0]!
      const shopLabels = createProxyShopLabels(isCurrentEcommerceWorkspace())
      const errMsg = checkRes.proxyType === ProxyType.buy ? checkRes.error : shopLabels.testFailedCheckConfig
      const [code, msg] = checkRes.checkStatus === ProxyCheckStatus.failure
        ? [-1, genProxyTestToastDetail(errMsg, { ...options, guide, preferredCountry })]
        : [0, $t('位置: {location}\nIP: {ip}\n时区: {timezone}', { location: `${checkRes.lastCountry}${strConcat('/', checkRes.lastCity)}`, ip: checkRes.lastIp, timezone: checkRes.timezone })]
      showToast(code, msg, toastLife)
    }
    else {
      const success = results.filter(item => item.checkStatus === ProxyCheckStatus.success)
      const error = results.filter(item => item.checkStatus === ProxyCheckStatus.failure)
      const summary = $t('{success} 条成功，{error} 条失败', { success: success.length, error: error.length })
      // 全部失败时走错误 toast（红色图标 +「操作失败」）；只要有一条成功仍用成功态汇总
      showToast(success.length === 0 ? -1 : 0, genProxyTestToastDetail(summary, { ...options, guide, preferredCountry }), toastLife)
    }
  }

  /** RoxyIP 失败：客服链接触在文案后；第三方失败：下方紧凑购买条（走 detail，避免 footer 被 PrimeVue 丢掉） */
  function genProxyTestToastDetail(msg: string, options?: BatchTestShowToastOptions & { guide?: 'ad' | 'support' | null, preferredCountry?: string }) {
    const { reCheck, onBuy, guide, preferredCountry } = options ?? {}
    const isAd = guide === 'ad'
    const isSupport = guide === 'support'
    // 主进程失败文案常自带句号，拼「，联系技术支持」前去掉，避免出现「。……，」
    const displayMsg = guide === 'support' ? msg.replace(/[。.!！?？]+$/u, '') : msg
    return (
      <div class="w-full flex flex-col gap-3">
        <div class={`flex ${isSupport ? 'flex-col gap-2' : 'items-center'} ${isAd && simpleLocale.isZh ? 'whitespace-nowrap' : ''}`}>
          <div class={`${isAd ? 'inline-flex' : ''}`}>
            <span>{displayMsg}</span>
            {isSupport && (
              <>
                <span>，</span>
                <span
                  class="cursor-pointer text-[#11A3FD] underline [text-decoration-skip-ink:none] [text-underline-position:from-font]"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation()
                    globalThis.showLiveChat?.()
                  }}
                >
                  {$t('联系技术支持')}
                </span>
              </>
            )}
          </div>
          {reCheck && (
            <RxButton class={isAd ? 'ml-1' : 'ml-auto'} text size="xxs" label={$t('重新检测')} onClick={reCheck}></RxButton>
          )}
        </div>
        {isAd && (
          <ProxyDetectFailAd
            onBuy={() => {
              if (onBuy) {
                onBuy()
                return
              }
              void buyFromDetectFailAd(preferredCountry)
            }}
          />
        )}
      </div>
    )
  }

  /**
   * toast 广告「立即购买」：关弹窗后必须离开测速失败现场，否则用户以为买完仍停在原页。
   * 已在列表页时靠 updateShopList 刷新并高亮；电商工作区落到设备列表。
   */
  async function buyFromDetectFailAd(preferredCountry?: string) {
    try {
      const orderInfo = await buyProxy({
        entryType: BuyEntryType.Immediate,
        ...(preferredCountry ? { preferredCountry } : {}),
      })
      const isEcommerce = isCurrentEcommerceWorkspace()
      showToast(0, isEcommerce
        ? $t('设备已购买成功，正在为您配置中，请稍后。若长时间未加载设备，请刷新页面或联系技术支持。')
        : $t('代理 IP 已购买成功，正在为您配置中，请稍后。若长时间未加载代理 IP，请刷新页面或联系技术支持。'))

      emitter.emit('updateShopList', orderInfo?.orderNo)

      const routeName = isEcommerce ? 'ecommerce-device-list' : 'agent-list'
      await router.replace({
        name: routeName,
        query: routeName === 'agent-list'
          ? { name: 'shop', orderNo: orderInfo?.orderNo }
          : { orderNo: orderInfo?.orderNo },
      })
    }
    catch {
      // 用户关闭购买弹窗时 buyProxy reject，忽略即可
    }
  }

  async function concurrentProxyTest(run: ConcurrentProxyTestRun) {
    if (!concurrentTaskTopBar) {
      return
    }
    const { tasks, tasksCompleted, showConcurrentTaskTopBar = false } = run

    if (concurrentProxyTestBusy.value) {
      throw new Error('测速进行中，请稍候')
    }

    const controller = new AbortController()
    speedTestAbort.value = controller

    try {
      if (showConcurrentTaskTopBar) {
        concurrentTaskTopBar.show({
          total: tasks.length,
        })
        concurrentProxyTestBusy.value = true
      }

      const results = await concurrentControl(tasks, 5, {
        signal: controller.signal,
        onProgress: ({ completed, total }) => {
          if (!hostUnmounted.value && showConcurrentTaskTopBar) {
            concurrentTaskTopBar.updateProgress({ completed, total })
          }
        },
      })

      await tasksCompleted?.(results, hostUnmounted.value)
    }
    finally {
      if (showConcurrentTaskTopBar) {
        concurrentTaskTopBar.close()
      }
      concurrentProxyTestBusy.value = false
      if (speedTestAbort.value === controller) {
        speedTestAbort.value = null
      }
    }
  }

  return {
    testProxy,
    batchTestShowToast,
    concurrentProxyTest,
  }
}

export function useProxy() {
  const [showModal] = useDialog()
  const router = useRouter()
  const roleStore = useRoleStore()
  const simpleLocale = useSimpleLocale()

  function buyProxy(props: Record<string, unknown> = {}) {
    const { promise, resolve, reject } = Promise.withResolvers<UserBuyProxySettlementCreateData['data'] | undefined>()
    // 费用中心等共享页未显式传 mode 时，按工作区补齐电商=设备购买语义（隐藏用途 badge 等）
    const ecommerceDefaults = isCurrentEcommerceWorkspace()
      ? { mode: 'device' as const, workspaceType: WorkspaceType.ECommerce }
      : {}
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      // beforeClose: ipBeforeClose,
      slots: {
        container: ({ handleCancel }) => (
          <ChooseModal
            {...ecommerceDefaults}
            {...props}
            onSuccess={resolve}
            onClose={handleCancel}
          />
        ),
      },
      handleCancel: reject,
    })
    return promise
  }

  function _ipBeforeClose() {
    const isRemind = safeParseJSON(localStorage.getItem('IPColseRemind'))
    if (isRemind) {
      return true
    }

    const { promise, resolve } = Promise.withResolvers<boolean>()

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      handleCancel: () => resolve(true),
      slots: {
        container: ({ handleCancel }) => <BeforeClose onClose={handleCancel} />,
      },
    })
    return promise
  }

  function showProxyDownloadKycBlockModal(onClose?: () => void) {
    const variant = getProxyDownloadBlockVariant(simpleLocale.currentLocale, roleStore.isOwner)
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => (
          <ProxyDownloadKycBlockModal
            variant={variant}
            onClose={() => {
              hideModal()
              onClose?.()
            }}
          />
        ),
      },
    })
  }

  async function downloadProxy({ items, cancel, confirm }: DownloadProxyParams) {
    if (hasBuyProxy(items)) {
      const unlocked = await fetchWorkspaceKycUnlockedCached()
      if (!unlocked) {
        showProxyDownloadKycBlockModal(cancel)
        return
      }
    }

    const data = await resolveProxyDownloadRows(items)

    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => (
          <DownloadModal
            data={data}
            onConfirm={onDownload}
            onClose={() => {
              hideModal()
              cancel?.()
            }}
          />
        ),
      },
    })

    function onDownload({ data, fileType }: any) {
      const type = fileType === 'csv' ? 'text/csv;charset=utf-8;' : 'text/plain'
      const date = format(new Date(), 'yyyyMMdd_HHmmss')
      const filename = fileType === 'csv' ? `Proxies ${date}.csv` : `Proxies ${date}.txt`
      const blob = new Blob([data.join('\n')], { type })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      confirm?.()
    }
  }

  function renewProxy(data: any[], next: () => void) {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        root: '!bg-transparent !border-none !shadow-none',
      },
      slots: {
        container: ({ hideModal }) => <RenewModal data={data} onClose={hideModal} onSuccess={next} />,
      },
    })
  }

  function upgradeProxy(data: any[], next: () => void) {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => <UpgradeModal data={data} onClose={hideModal} onSuccess={next} />,
      },
    })
  }

  function viewExpiresSoonProxy() {
    router.push({ name: 'agent-list', query: { name: 'shop', expireStatus: ProxyExpireStatus.soon, _t: Date.now() } })
  }

  return { buyProxy, downloadProxy, renewProxy, upgradeProxy, viewExpiresSoonProxy, showProxyDownloadKycBlockModal }
}
