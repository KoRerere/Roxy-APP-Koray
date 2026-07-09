import { onBeforeUnmount, ref, shallowRef } from 'vue'
import RxButton from '/@/components/rx-button'
import ChooseModal from '/@/views/agent/shop/components/choose-modal.vue'
import DownloadModal from '/@/views/agent/shop/components/download-modal.vue'
import RenewModal from '/@/views/agent/shop/components/renew-modal.vue'
import UpgradeModal from '/@/views/agent/shop/components/upgrade-modal.vue'
import BeforeClose from '/@/views/agent/shop/components/provider-buy/before-close.vue'
import { useConcurrentTaskTopBar } from '/@/components/concurrent-task-top-bar'
import { format } from 'date-fns'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { ProxyCheckStatus, ProxyExpireStatus, ProxyType } from '/@/enums'
import { concurrentControl, createDefaultObject, decryptAESGCM, safeParseJSON, strConcat } from '/@/utils'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
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
}

interface ProxyCheckParams extends Partial<ProxyDetectionParams> {
  isEncryptProxy?: boolean
  proxyEncryptInfo?: string
  apiCheck?: boolean
  id?: number
}

/** 并发任务单条结果（filter(Boolean) 之后），含行 id / proxyType 供业务筛选 */
export type ConcurrentProxyValidResult = CheckResult & { id?: number, proxyType?: ProxyType }

/** concurrentControl 原始结果槽位，未执行到的为 undefined */
export type ConcurrentProxyTestResults = Array<ConcurrentProxyValidResult | undefined>

export interface BatchTestShowToastOptions {
  reCheck?: () => any | Promise<any>
  /** 是否展示「联系技术支持」按钮；单条检测默认仅购买代理展示，批量检测默认展示 */
  showSupport?: boolean
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
  data: {
    host?: string
    port?: string
    username?: string
    password?: string
  }[]
  cancel?: () => void
  confirm?: () => void
}

export function useCheckProxy(): useCheckProxyResult {
  const [showToast] = useResponseToast()

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

    if (isEncryptProxy && proxyEncryptInfo) {
      const decryptedProxyEncryptInfo = await decryptAESGCM(proxyEncryptInfo)
      Object.assign(data, decryptedProxyEncryptInfo)
    }

    data.dirId ||= Math.random().toString(36).slice(2)

    try {
      const checkRes = await globalThis.electronAPI.send('proxy:detect', data as ProxyDetectionParams)
      local.checkStatus = !checkRes.ip ? ProxyCheckStatus.failure : ProxyCheckStatus.success
      local.lastIp = checkRes.ip ?? ''
      local.lastCity = checkRes.city ?? ''
      local.lastCountry = checkRes.country_code ?? ''
      local.timezone = checkRes.timezone ?? ''
    }
    catch (error: any) {
      local.error = error
      local.checkStatus = ProxyCheckStatus.failure
      local.lastIp = ''
      local.lastCity = ''
      local.lastCountry = ''
      local.timezone = ''
    }
    finally {
      local.checkTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
      local.loading = false
      data.dirId && globalThis.electronAPI.send('proxy:delRoxynetProxy', data.dirId)
    }
    return { ...local }
  }

  function batchTestShowToast(__results: CheckResult | CheckResult[], options?: BatchTestShowToastOptions) {
    const results = Array.isArray(__results) ? __results : [__results]
    if (results.length === 1) {
      const checkRes = results[0]!
      const [code, msg] = checkRes.checkStatus === ProxyCheckStatus.failure
        // checkRes.error || 暂时改 web ，后续版本将这个提示挪到主进程中
        ? [-1, genProxyTestToastDetail($t('代理 IP 检测失败，请检查代理 IP 配置'), {
            ...options,
            showSupport: options?.showSupport ?? checkRes.proxyType === ProxyType.buy,
          })]
        : [0, $t('位置: {location}\nIP: {ip}\n时区: {timezone}', { location: `${checkRes.lastCountry}${strConcat('/', checkRes.lastCity)}`, ip: checkRes.lastIp, timezone: checkRes.timezone })]
      showToast(code, msg)
    }
    else {
      const success = results.filter(item => item.checkStatus === ProxyCheckStatus.success)
      const error = results.filter(item => item.checkStatus === ProxyCheckStatus.failure)
      const summary = $t('{success} 条成功，{error} 条失败', { success: success.length, error: error.length })
      showToast(0, genProxyTestToastDetail(summary, options))
    }
  }

  function genProxyTestToastDetail(msg: string, options?: BatchTestShowToastOptions) {
    const { reCheck, showSupport = false } = options ?? {}
    return (
      <div class="flex flex-col gap-2">
        <div>{msg}</div>
        <div class="flex gap-2 justify-end">
          {reCheck && <RxButton text name="base/rx_ic_close" size="xxs" label={$t('重新检测')} onClick={reCheck}></RxButton>}
          {showSupport && (
            <RxButton
              text
              name="base/rx_ic_reload"
              size="xxs"
              label={$t('联系技术支持')}
              onClick={showLiveChat}
            >
            </RxButton>
          )}
        </div>
      </div>
    )
  }

  async function concurrentProxyTest(run: ConcurrentProxyTestRun) {
    if (!concurrentTaskTopBar)
      return
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
          if (!hostUnmounted.value && showConcurrentTaskTopBar)
            concurrentTaskTopBar.updateProgress({ completed, total })
        },
      })

      await tasksCompleted?.(results, hostUnmounted.value)
    }
    finally {
      if (showConcurrentTaskTopBar)
        concurrentTaskTopBar.close()
      concurrentProxyTestBusy.value = false
      if (speedTestAbort.value === controller)
        speedTestAbort.value = null
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

  function buyProxy(props = {}) {
    const { promise, resolve, reject } = Promise.withResolvers<UserBuyProxySettlementCreateData['data'] | undefined>()
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      beforeClose: ipBeforeClose,
      slots: {
        container: ({ handleCancel }) => (
          <ChooseModal
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

  function ipBeforeClose() {
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

  function downloadProxy({ data, cancel, confirm }: DownloadProxyParams) {
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

  return { buyProxy, downloadProxy, renewProxy, upgradeProxy, viewExpiresSoonProxy }
}
