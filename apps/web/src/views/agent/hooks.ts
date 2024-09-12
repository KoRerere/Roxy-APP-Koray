import { format } from 'date-fns'
import { useToast } from 'primevue/usetoast'
import { ProxyCheckStatus } from '/@/enums'

const checkeResult = reactive({
  loadding: false,
})

async function testProxy(data: any, toast: any) {
  checkeResult.loading = true

  const checkRes = await window.electronAPI.send('proxy:detection', data)
  if (!checkRes.ip) {
    toast.add({ severity: 'error', summary: 'Errors occur', detail: 'Please checkout your IP configuration and local network then try again.', life: 5000 })
  }
  else {
    toast.add({ severity: 'success', summary: 'Proxy test success', detail: `Location: ${checkRes.continent_code}/${checkRes.country}\nIP: ${checkRes.ip}`, life: 5000 })
  }

  checkeResult.loading = false
  checkeResult.checkStatus = !checkRes.ip ? ProxyCheckStatus.failure : ProxyCheckStatus.success
  checkeResult.lastIp = checkRes.ip ?? ''
  checkeResult.lastCity = checkRes.city ?? ''
  checkeResult.lastCountry = checkRes.continent_code ?? ''
  checkeResult.checkTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
}

export function useCheckProxy() {
  const toast = useToast()
  return [checkeResult, (data: any) => testProxy(data, toast)]
}
