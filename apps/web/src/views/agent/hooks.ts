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
        : [0, $t('位置: {location} IP: {ip}', { location: `${checkRes.country_code}${strConcat('/', checkRes.city)}`, ip: checkRes.ip })]

      if (!options.silence) {
        showToast(code, msg)
      }

      checkeResult.checkStatus = !checkRes.ip ? ProxyCheckStatus.failure : ProxyCheckStatus.success
      checkeResult.lastIp = checkRes.ip ?? ''
      checkeResult.lastCity = checkRes.city ?? ''
      checkeResult.lastCountry = checkRes.country_code ?? ''
      checkeResult.timezone = checkRes.timezone ?? ''
    }
    catch (error: any) {
      checkeResult.error = error
      checkeResult.checkStatus = ProxyCheckStatus.failure;
      ['lastIp', 'lastCity', 'lastCountry', 'timezone'].forEach((key) => {
        checkeResult[key as keyof CheckResult] = ''
      })
      onlyErrorToast(-1, error)
    }
    finally {
      checkeResult.checkTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
      checkeResult.loading = false
      dirId && window.electronAPI.send('proxy:delRoxynetProxy', dirId)
    }
    return toRaw(checkeResult)
  }

  return [testProxy, checkeResult]
}
