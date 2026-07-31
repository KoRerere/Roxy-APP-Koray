import { debounce } from 'es-toolkit'
import { isEmpty } from 'es-toolkit/compat'
import { store } from '/@/modules/store'
import { getNetworkMode } from '/@/modules/store/networkMode'
import type { ProxyDetectionResult } from '/@/utils/proxyDetection'
import { detectNetwork } from '/@/utils/proxyDetection'

/** 恢复窗口对比用的客户端网络快照 */
export interface ClientNetworkSnapshot {
  ip: string
  country: string
  country_code: string
  city: string
}

/** 恢复前客户端网络变化检测结果 */
export interface RestoreClientNetworkCheckResult {
  changed: boolean
  previous?: ClientNetworkSnapshot
  current?: ClientNetworkSnapshot
}

/** 将代理检测结果裁剪为恢复对比快照 */
export function toClientNetworkSnapshot(result: ProxyDetectionResult): ClientNetworkSnapshot {
  return {
    ip: result.ip,
    country: result.country,
    country_code: result.country_code,
    city: result.city,
  }
}

/** 按 networkMode 检测当前客户端出站网络，与 header network.vue 一致 */
export async function detectClientNetwork(): Promise<ClientNetworkSnapshot | undefined> {
  try {
    const result = await detectNetwork(getNetworkMode())

    if (!result?.ip) {
      return undefined
    }

    return toClientNetworkSnapshot(result)
  }
  catch (error) {
    console.warn('[detectClientNetwork] detection failed', error)
    return undefined
  }
}

/** 对比上次快照与当前客户端网络是否变化 */
export async function checkRestoreClientNetworkChanged(): Promise<RestoreClientNetworkCheckResult> {
  const previous = store.lastRestoreClientNetwork
  const current = await detectClientNetwork()

  if (!previous?.ip || !current?.ip) {
    return { changed: false, previous, current }
  }

  return {
    changed: current.ip !== previous.ip,
    previous,
    current,
  }
}

const debouncedPersistRestoreClientNetworkSnapshot = debounce(async () => {
  if (store.autoRestoreWindow === 0 || isEmpty(store.waitingRestoreWindow)) {
    return
  }

  const snapshot = await detectClientNetwork()
  if (!snapshot) {
    return
  }

  store.lastRestoreClientNetwork = snapshot
}, 3000)

/** 记录恢复窗口列表时异步刷新客户端网络快照 */
export function scheduleRestoreClientNetworkSnapshotUpdate() {
  if (store.autoRestoreWindow === 0 || isEmpty(store.waitingRestoreWindow)) {
    return
  }

  void debouncedPersistRestoreClientNetworkSnapshot()
}
