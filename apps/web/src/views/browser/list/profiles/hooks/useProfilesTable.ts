import type { Ref } from 'vue'
import { API } from '/@/api'
import { filterFieldByValue, getFormData, isEmptyValue } from '/@/utils'
import { parseBrowserOpenQuery } from '/@/views/browser/list/profiles/utils/browserQuery'
import { useAutoOpenProxySync } from '/@/views/browser/list/profiles/hooks/useAutoOpenProxySync'
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'
import { emitter } from '/@/utils/eventBus'
import { useWorkspaceStore } from '/@/stores/workspace'

type Data = UserGetWindowInfoListListData['data']['rows'][number]

export function useProfilesTable(options: {
  tableRef: Ref<{ refresh: (params?: Record<string, unknown>, force?: boolean) => void } | null>
  filtersMenu: Ref<any>
  getCurrentFilterParams: () => Record<string, unknown> | undefined
  openBrowserBefore: (data: Data | Data[]) => Promise<void>
}) {
  const route = useRoute()
  const router = useRouter()
  const workspaceStore = useWorkspaceStore()

  const hasFiltered = ref(false)
  const hasTempProfile = ref(false)
  /** 与 tableRequest 返回的 rows 同一引用，供测速、静默更新代理等使用 */
  const dataList = ref<Data[]>([])
  const { markRouteAutoOpen, clearPendingAutoOpen, syncOpenedProxyToRow } = useAutoOpenProxySync(dataList)

  watch(() => workspaceStore.currentWorkspace, (newValue, oldValue) => {
    if (newValue?.workspaceName !== oldValue?.workspaceName) {
      onRefreshTable()
    }
  })

  function onRefreshTable(tabParams: Record<string, unknown> = {}, force = false) {
    const params = {
      ...options.getCurrentFilterParams(),
      ...tabParams,
      ...filterFieldByValue(getFormData(options.filtersMenu.value)),
    }
    hasFiltered.value = !isEmptyValue(params)
    options.tableRef.value?.refresh(params, force)
  }

  function autoOpenBrowser() {
    const query = parseBrowserOpenQuery(route.query.browser)
    if (!query?.openBrowser)
      return

    const data = dataList.value.find(item => item.id === query.windowId)
    router.replace({ name: route.name as string })
    if (!data)
      return

    markRouteAutoOpen(data.dirId!)
    options.openBrowserBefore(data)
  }

  async function tableRequest(params: Record<string, unknown>) {
    const data = await API.window.userGetWindowInfoListList({ projectIds: route.params.id, ...params, isDelete: 0 } as any)

    if (data.code === 0) {
      const rows = data.data.rows.map(item => ({
        ...item,
        projectName: item.projectName === '无项目' ? $t('默认项目') : item.projectName,
      }))
      dataList.value = rows
      data.data.rows = rows
      hasTempProfile.value = rows.some(item => item.isTemporary)
      if (rows.length > 0)
        autoOpenBrowser()
    }

    emitter.emit('updateProfileList', data.data.rows)

    return data
  }

  return {
    dataList,
    hasFiltered,
    hasTempProfile,
    clearPendingAutoOpen,
    syncOpenedProxyToRow,
    onRefreshTable,
    tableRequest,
  }
}
