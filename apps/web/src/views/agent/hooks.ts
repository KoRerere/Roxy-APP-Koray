import { format } from 'date-fns'
import { useToast } from 'primevue/usetoast'
import { ProxyCheckStatus } from '/@/enums'

export interface CheckResult {
  loading: boolean
  checkStatus: ProxyCheckStatus
  lastIp?: string
  lastCity?: string
  lastCountry?: string
  checkTime?: string
}

interface ProxyCheckParams {
  checkChannel?: string | undefined
  ipType?: string | undefined
  proxyCategory?: string | undefined
  protocol?: string | undefined
  proxyUserName?: string | undefined
  proxyPassword?: string | undefined
  host?: string | undefined
  port?: string | undefined
  proxyNetwork?: string | undefined
}

export function useCheckProxy(): [(data: any) => Promise<CheckResult>, CheckResult] {
  const toast = useToast()

  const checkeResult: CheckResult = reactive({
    loading: false,
    checkStatus: ProxyCheckStatus.failure,
  })

  async function testProxy(data: ProxyCheckParams) {
    checkeResult.loading = true

    try {
      const checkRes = await window.electronAPI.send('proxy:detect', data)
      if (!checkRes.ip) {
        toast.add({ severity: 'error', summary: 'Errors occur', detail: 'Please checkout your IP configuration and local network then try again.', life: 5000 })
      }
      else {
        toast.add({ severity: 'success', summary: 'Proxy test success', detail: `Location: ${checkRes.country_code}/${checkRes.country}\nIP: ${checkRes.ip}`, life: 5000 })
      }

      checkeResult.checkStatus = !checkRes.ip ? ProxyCheckStatus.failure : ProxyCheckStatus.success
      checkeResult.lastIp = checkRes.ip ?? ''
      checkeResult.lastCity = checkRes.city ?? ''
      checkeResult.lastCountry = checkRes.country_code ?? ''
      checkeResult.checkTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
    }
    catch (error: any) {
      toast.add({ severity: 'error', summary: 'Errors occur', detail: error, life: 5000 })
    }
    finally {
      checkeResult.loading = false
    }
    return checkeResult
  }

  return [testProxy, checkeResult]
}
