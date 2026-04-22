import type { UserGetProxyVendorListListData } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'

type ProxyVendorList = UserGetProxyVendorListListData['data']

export const useProxyStore = defineStore('proxy', () => {
  const [_, onlyErrorToast] = useResponseToast()
  const proxyVendors = ref<ProxyVendorList>()

  async function getProxyVendors(force = false) {
    if (proxyVendors.value && !force) {
      return proxyVendors.value
    }
    const { code, data, msg } = await API.proxy.userGetProxyVendorListList()
    onlyErrorToast(code, msg)
    if (code === 0) {
      proxyVendors.value = data
    }
    return proxyVendors.value
  }

  return { proxyVendors, getProxyVendors }
}, {
  persist: false,
})
