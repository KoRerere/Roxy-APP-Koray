import type { Ref } from 'vue'
import { mapOpenedProxyInfoToSilentParams, silentUpdateProxy } from '/@/views/browser/list/profiles/components/util'
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'

type Row = UserGetWindowInfoListListData['data']['rows'][number]

/** 路由自动打开：登记 dirId，启动成功后把主进程代理检测结果静默合并到列表行 */
export function useAutoOpenProxySync(dataList: Ref<Row[]>) {
  const pendingDirIds = new Set<string>()

  function markRouteAutoOpen(dirId: string | number) {
    pendingDirIds.add(String(dirId))
  }

  function clearPendingAutoOpen(dirId: string | number) {
    pendingDirIds.delete(String(dirId))
  }

  async function syncOpenedProxyToRow(dirId: string | number) {
    const key = String(dirId)
    if (!pendingDirIds.delete(key))
      return

    const opened = await globalThis.electronAPI.send('browser:getOpenedBrowser') as Array<{
      dirId?: string | number
      $proxyInfo?: Record<string, any>
    }>
    const params = mapOpenedProxyInfoToSilentParams(
      opened.find(item => String(item.dirId) === key)?.$proxyInfo,
    )
    if (!params)
      return

    const row = dataList.value.find(item => String(item.dirId) === key)
    if (row)
      silentUpdateProxy(row, params, { replaceProxy: false })
  }

  return { markRouteAutoOpen, clearPendingAutoOpen, syncOpenedProxyToRow }
}
