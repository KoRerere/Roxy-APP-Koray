import { format } from 'date-fns'
import { ProxyCheckStatus } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { strConcat } from '/@/utils'

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

interface ProxyCheckParams {
  host: string
  port: string
  ipType: string
  proxyCategory: string
  dirId?: string
  checkChannel?: string
  proxyUserName?: string
  proxyPassword?: string
  proxyNetwork?: string
}

export function useCheckProxy(): {
  testProxy: (data: any) => Promise<CheckResult>
  checkResult: CheckResult
  batchTestShowToast: (results: CheckResult[]) => void
} {
  const [showToast, onlyErrorToast] = useResponseToast()
  const checkResult: CheckResult = reactive({
    loading: false,
    checkStatus: ProxyCheckStatus.failure,
  })

  async function testProxy(data: ProxyCheckParams) {
    checkResult.loading = true
    checkResult.error = null
    const dirId = data.dirId || Math.random().toString(36).slice(2)
    data.dirId = dirId

    try {
      const checkRes = await window.electronAPI.send('proxy:detect', data)
      // const [code, msg] = !checkRes.ip
      //   ? [-1, $t('测试代理失败')]
      //   : [0, $t('位置: {location} IP: {ip}', { location: `${checkRes.country_code}${strConcat('/', checkRes.city)}`, ip: checkRes.ip })]

      // if (!options.silence) {
      //   showToast(code, msg)
      // }

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
      dirId && window.electronAPI.send('proxy:delRoxynetProxy', dirId)
    }
    return toRaw(checkResult)
  }

  function batchTestShowToast(__results: CheckResult | CheckResult[]) {
    const results = Array.isArray(__results) ? __results : [__results]
    if (results.length === 1) {
      const checkRes = results[0]
      const [code, msg] = checkRes.checkStatus == ProxyCheckStatus.failure ? [-1, $t('测试代理失败')]
        : [0, $t('位置: {location} IP: {ip}', { location: `${checkRes.lastCountry}${strConcat('/', checkRes.lastCity)}`, ip: checkRes.lastIp })]
      showToast(code, msg)
    } else {
      const success = results.filter(item => item.checkStatus == ProxyCheckStatus.success);
      const error = results.filter(item => item.checkStatus == ProxyCheckStatus.failure);
      showToast(0, $t('{success} 条成功，{error} 条失败', { success: success.length, error: error.length }))
    }
  }

  return {
    testProxy,
    checkResult,
    batchTestShowToast,
  }
}
