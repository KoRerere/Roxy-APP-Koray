import type { OsConfig } from '/@/constants/osConfig'
import { getBaseUrl, getGatewayConfig } from '/@/api/getGatewayConfig'
import { store } from '/@/modules/store'

/**
 * 解析 APP 网关 baseUrl，与 axios 拦截器逻辑保持一致
 */
export async function resolveAppGatewayBaseUrl(): Promise<string | undefined> {
  if (store.lastSelectedNetworkNode === 'auto') {
    return getBaseUrl() || await getGatewayConfig()
  }
  const gate = store.lastSelectedNetworkNode?.gate
  return gate ? `https://${gate}` : undefined
}

/**
 * 构建 electron-updater generic provider 的动态 feed URL
 * updater 会在此基础上请求 latest*.yml 并携带 query 参数
 */
export function buildAppUpdateFeedUrl(baseUrl: string, config: OsConfig): string {
  const url = new URL('/app_update/', baseUrl)
  url.searchParams.set('os', config.os)
  if (config.os === 'darwin') {
    url.searchParams.set('cpu', config.cpu)
  }
  else {
    url.searchParams.set('osBit', config.osBit)
  }
  return url.href
}
