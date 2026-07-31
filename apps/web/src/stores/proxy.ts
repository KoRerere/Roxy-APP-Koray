import type { UserGetProxyVendorListListData } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useWorkspaceStore } from '/@/stores/workspace'

type ProxyVendorList = UserGetProxyVendorListListData['data']

/** 供应商列表随 workspace 业务模式变化，缓存键需包含 workspaceType */
function buildProxyVendorCacheKey(workspaceId?: number, workspaceType?: number) {
  if (workspaceId == null || workspaceType == null)
    return undefined
  return `${workspaceId}:${workspaceType}`
}

export const useProxyStore = defineStore('proxy', () => {
  const [_, onlyErrorToast] = useResponseToast()
  const proxyVendors = ref<ProxyVendorList>()
  const proxyVendorsCacheKey = ref<string>()

  function clearProxyVendors() {
    proxyVendors.value = undefined
    proxyVendorsCacheKey.value = undefined
  }

  async function getProxyVendors(force = false) {
    const { currentWorkspace } = useWorkspaceStore()
    const cacheKey = buildProxyVendorCacheKey(
      currentWorkspace?.id,
      currentWorkspace?.workspaceType,
    )

    if (!force && proxyVendors.value && proxyVendorsCacheKey.value === cacheKey)
      return proxyVendors.value

    const { code, data, msg } = await API.proxy.userGetProxyVendorListList()
    onlyErrorToast(code, msg)
    if (code === 0) {
      proxyVendors.value = data
      proxyVendorsCacheKey.value = cacheKey
    }
    return proxyVendors.value
  }

  return { proxyVendors, getProxyVendors, clearProxyVendors }
}, {
  persist: false,
})
