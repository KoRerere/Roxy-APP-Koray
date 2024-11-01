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
  dirId?: string | undefined
  checkChannel?: string | undefined
  ipType?: string | undefined
  proxyCategory?: string | undefined
  proxyUserName?: string | undefined
  proxyPassword?: string | undefined
  host?: string | undefined
  port?: string | undefined
  proxyNetwork?: string | undefined
}

interface Options {
  silence?: boolean
}

export function useCheckProxy(options: Options = { silence: false }): [(data: any) => Promise<CheckResult>, CheckResult] {
  const [showToast, onlyErrorToast] = useResponseToast()
  const checkeResult: CheckResult = reactive({
    loading: false,
    checkStatus: ProxyCheckStatus.failure,
  })

  async function testProxy(data: ProxyCheckParams) {
    checkeResult.loading = true
    checkeResult.error = null
    const dirId = data.dirId || Math.random().toString(36).slice(2)
    data.dirId = dirId

    try {
      const checkRes = await window.electronAPI.send('proxy:detect', data)
      const [code, msg] = !checkRes.ip
        ? [-1, $t('测试代理失败')]
        : [0, $t('位置: {location} IP: {ip}', { location: `${checkRes.country_code}${strConcat('/', checkRes.country)}`, ip: checkRes.ip })]

      if (!options.silence) {
        showToast(code, msg)
      }

      checkeResult.checkStatus = !checkRes.ip ? ProxyCheckStatus.failure : ProxyCheckStatus.success
      checkeResult.lastIp = checkRes.ip ?? ''
      checkeResult.lastCity = checkRes.city ?? ''
      checkeResult.lastCountry = checkRes.country_code ?? ''
      checkeResult.timezone = checkRes.timezone ?? ''
      checkeResult.checkTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
    }
    catch (error: any) {
      checkeResult.error = error
      onlyErrorToast(-1, error)
    }
    finally {
      checkeResult.loading = false
      dirId && window.electronAPI.send('proxy:delLuminetProxy', dirId)
    }
    return checkeResult
  }

  return [testProxy, checkeResult]
}
