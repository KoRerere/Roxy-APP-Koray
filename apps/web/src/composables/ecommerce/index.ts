import { API } from '/@/api'
import { useProjectStore } from '/@/stores/project'

export function useAccountList() {
  function fetchAccountTable(params: Record<string, unknown> = {}) {
    return API.window.userGetWindowInfoListList({ ...params, isDelete: 0 } as never)
  }

  return {
    fetchAccountTable,
  }
}

export function useAccountGroups() {
  const projectStore = useProjectStore()

  function fetchGroupTable(params: Record<string, unknown> = {}) {
    projectStore.getProjects()
    return API.limit.userGetProjectInfoByWorkspaceList({ ...params, default: 2 } as never)
  }

  return {
    fetchGroupTable,
  }
}

export function useDeviceList() {
  function fetchDeviceTable(params: Record<string, unknown> = {}) {
    return API.proxy.userGetProxyListMergedList(params as never)
  }

  return {
    fetchDeviceTable,
  }
}

export function usePluginList() {
  function fetchInstalledPlugins(params: Record<string, unknown> = {}) {
    return API.plugins.userGetPluginListList(params as never)
  }

  return {
    fetchInstalledPlugins,
  }
}
