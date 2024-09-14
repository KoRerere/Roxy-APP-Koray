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

const checkeResult: CheckResult = reactive({
  loading: false,
  checkStatus: ProxyCheckStatus.failure,
})

export function useCheckProxy() {
  const toast = useToast()

  async function testProxy(data: any) {
    checkeResult.loading = true

    const checkRes = await window.electronAPI.send('proxy:detection', data)
    if (!checkRes.ip) {
      toast.add({ severity: 'error', summary: 'Errors occur', detail: 'Please checkout your IP configuration and local network then try again.', life: 5000 })
    }
    else {
      toast.add({ severity: 'success', summary: 'Proxy test success', detail: `Location: ${checkRes.country_code}/${checkRes.country}\nIP: ${checkRes.ip}`, life: 5000 })
    }

    checkeResult.loading = false
    checkeResult.checkStatus = !checkRes.ip ? ProxyCheckStatus.failure : ProxyCheckStatus.success
    checkeResult.lastIp = checkRes.ip ?? ''
    checkeResult.lastCity = checkRes.city ?? ''
    checkeResult.lastCountry = checkRes.country_code ?? ''
    checkeResult.checkTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

    return checkeResult
  }

  return [testProxy, checkeResult]
}
