import ChooseModal from '/@/views/agent/shop/components/choose-modal.vue'
import DownloadModal from '/@/views/agent/shop/components/download-modal.vue'
import RenewModal from '/@/views/agent/shop/components/renew-modal.vue'
import { format } from 'date-fns'
import { API } from '/@/api'
import { ProxyCheckStatus, ProxyExpireStatus } from '/@/enums'
import { createDefaultObject, decryptAESGCM, strConcat } from '/@/utils'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import type { ProxyDetectionParams } from '#roxybrowser/utils/proxyDetection'

export interface CheckResult {
  loading: boolean
  error?: any
  checkStatus: ProxyCheckStatus
  lastIp?: string
  lastCity?: string
  lastCountry?: string
  checkTime?: string
  timezone?: string
}

interface ProxyCheckParams extends Partial<ProxyDetectionParams> {
  isEncryptProxy?: boolean
  proxyEncryptInfo?: string
  apiCheck?: boolean
  id?: number
}

interface useCheckProxyResult {
  checkResult: CheckResult
  testProxy: (data: ProxyCheckParams) => Promise<CheckResult>
  batchTestShowToast: (results: CheckResult | CheckResult[]) => void
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
  const checkResult = reactive<CheckResult>({
    loading: false,
    checkStatus: ProxyCheckStatus.failure,
  })

  async function testProxy({ isEncryptProxy, proxyEncryptInfo, apiCheck, id, ...data }: ProxyCheckParams) {
    checkResult.loading = true
    checkResult.error = null

    // 购买的代理需要后台检测可用性
    if (apiCheck && id) {
      return testBuyProxy(id)
    }

    if (isEncryptProxy && proxyEncryptInfo) {
      const decryptedProxyEncryptInfo = await decryptAESGCM(proxyEncryptInfo)
      Object.assign(data, decryptedProxyEncryptInfo)
    }

    data.dirId ||= Math.random().toString(36).slice(2)

    try {
      const checkRes = await window.electronAPI.send('proxy:detect', data as ProxyDetectionParams)
      checkResult.checkStatus = !checkRes.ip ? ProxyCheckStatus.failure : ProxyCheckStatus.success
      checkResult.lastIp = checkRes.ip ?? ''
      checkResult.lastCity = checkRes.city ?? ''
      checkResult.lastCountry = checkRes.country_code ?? ''
      checkResult.timezone = checkRes.timezone ?? ''
    }
    catch (error: any) {
      checkResult.error = error
      checkResult.checkStatus = ProxyCheckStatus.failure;
      ['lastIp', 'lastCity', 'lastCountry', 'timezone'].forEach((key) => {
        checkResult[key as keyof CheckResult] = ''
      })
    }
    finally {
      checkResult.checkTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
      checkResult.loading = false
      data.dirId && window.electronAPI.send('proxy:delRoxynetProxy', data.dirId)
    }
    return { ...toRaw(checkResult) }
  }

  async function testBuyProxy(proxyBuyId: number) {
    const { code, data, msg } = await API.proxy.userCheckProxyCreate({ proxyBuyId })
    checkResult.loading = false
    if (code !== 0) {
      Object.assign(checkResult, {
        ...data,
        ...createDefaultObject(['lastIp', 'lastCity', 'lastCountry', 'timezone'], ''),
        checkStatus: ProxyCheckStatus.failure,
        error: msg,
      })
    }
    else {
      Object.assign(checkResult, data)
    }
    return { ...toRaw(checkResult) }
  }

  function batchTestShowToast(__results: CheckResult | CheckResult[]) {
    const results = Array.isArray(__results) ? __results : [__results]
    if (results.length === 1) {
      const checkRes = results[0]!
      const [code, msg] = checkRes.checkStatus === ProxyCheckStatus.failure
        ? [-1, checkRes.error || $t('测试代理失败')]
        : [0, $t('位置: {location}\nIP: {ip}\n时区: {timezone}', { location: `${checkRes.lastCountry}${strConcat('/', checkRes.lastCity)}`, ip: checkRes.lastIp, timezone: checkRes.timezone })]
      showToast(code, msg)
    }
    else {
      const success = results.filter(item => item.checkStatus === ProxyCheckStatus.success)
      const error = results.filter(item => item.checkStatus === ProxyCheckStatus.failure)
      showToast(0, $t('{success} 条成功，{error} 条失败', { success: success.length, error: error.length }))
    }
  }

  return {
    testProxy,
    checkResult,
    batchTestShowToast,
  }
}

export function useProxy() {
  const [showModal] = useDialog()
  const router = useRouter()

  function buyProxy(next: (orderInfo: Record<string, any>) => void, props = {}) {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => <ChooseModal {...props} onSuccess={next} onClose={hideModal} />,
      },
    })
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

  function viewExpiresSoonProxy() {
    router.push({ name: 'agent-list', query: { name: 'shop', expireStatus: ProxyExpireStatus.soon } })
  }

  return { buyProxy, downloadProxy, renewProxy, viewExpiresSoonProxy }
}
