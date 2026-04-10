import type { Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { API } from '/@/api'
import { filterFieldByValue, getFormData, isEmptyValue } from '/@/utils'
import { parseBrowserOpenQuery } from '/@/views/browser/list/profiles/utils/browserQuery'
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'

type Data = UserGetWindowInfoListListData['data']['rows'][number]

export function useProfilesTable(options: {
  tableRef: Ref<{ refresh: (params?: Record<string, unknown>, force?: boolean) => void } | null>
  filtersMenu: Ref<any>
  getCurrentFilterParams: () => Record<string, unknown> | undefined
  route: RouteLocationNormalizedLoaded
  router: Router
  openBrowserBefore: (data: Data | Data[]) => Promise<void>
}) {
  const hasFiltered = ref(false)
  const hasTempProfile = ref(false)

  function onRefreshTable(tabParams: Record<string, unknown> = {}, force = false) {
    const params = {
      ...options.getCurrentFilterParams(),
      ...tabParams,
      ...filterFieldByValue(getFormData(options.filtersMenu.value)),
    }
    hasFiltered.value = !isEmptyValue(params)
    options.tableRef.value?.refresh(params, force)
  }

  function autoOpenBrowser(list: Data[]) {
    const query = parseBrowserOpenQuery(options.route.query.browser)
    if (query?.openBrowser) {
      const data = list.find(item => item.id === query.windowId)
      options.router.replace({ name: options.route.name as string })
      if (data)
        options.openBrowserBefore(data)
    }
  }

  async function tableRequest(params: Record<string, unknown>) {
    const data = await API.window.userGetWindowInfoListList({ projectIds: options.route.params.id, ...params, isDelete: 0 } as any)

    if (data.code === 0 && data.data.rows.length > 0) {
      const rows = data.data.rows.map(item => ({
        ...item,
        projectName: item.projectName === '无项目' ? $t('默认项目') : item.projectName,
      }))
      hasTempProfile.value = rows.some(item => item.isTemporary)
      autoOpenBrowser(rows)
      data.data.rows = rows
    }

    return data
  }

  return {
    hasFiltered,
    hasTempProfile,
    onRefreshTable,
    tableRequest,
  }
}
