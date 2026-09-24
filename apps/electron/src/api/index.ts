import { ApiApi, AppTrackingEventApi, BaseApi, HttpClient, LimitApi, LoggingApi, PayApi, PlatformApi, PluginsApi, ProxyApi, TeamApi, WindowApi } from '@roxy/backend-api'
import { getBaseUrl, getGatewayConfig, getOpenAPIUrl, reGetGatewayConfigByCountryChange } from '/@/api/getGatewayConfig'
import { handleResponse } from '/@/api/util'
import { appCliStartArgs } from '/@/constants/common'
import { isUninstallFeedbackMode } from '/@/modules/app/uninstallFeedback'
import { executeUninstall } from '/@/modules/app/utils'
import { browserManager } from '/@/modules/browser'
import { ipcSender } from '/@/modules/ipc/sender'
import { store } from '/@/modules/store'
import { getCommonRequestHeaders } from '/@/utils'
// import { electronAdapter } from '/@/utils/request/electronAdapter'
import { attachAxiosLogger } from './axiosLogger'
// const agent = new https.Agent({
//   rejectUnauthorized: false,
// })

export const httpClient = new HttpClient({
  // baseURL: 'https://apitest.roxybrowser.co/',
  timeout: 15000,
  // 走 Electron net.request，跟随 proxy-manager 的 APP 网络代理设置
  // adapter: electronAdapter,
  proxy: false,
})

let commonRequestHeaders

// 打开窗口后会同步打开状态（userMdfWindowSyncV2Create）。权限系统有误报，正常请求也会返回 418，
// 拦截器据此关窗会导致窗口无法保持打开。后端修复前暂停。
// /** 被移出的是本次请求头里的空间，不能用之后切换到的当前空间 */
// function readWorkspaceIdHeader(headers: { workspaceId?: unknown, get?: (name: string) => unknown } | undefined) {
//   const raw = headers?.workspaceId ?? headers?.get?.('workspaceId')
//   if (raw === undefined || raw === null || raw === '') {
//     return undefined
//   }
//   const workspaceId = Number(raw)
//   return Number.isFinite(workspaceId) ? workspaceId : undefined
// }

// 开启请求日志
if (appCliStartArgs['roxy-log-level'] === 'debug') {
  attachAxiosLogger(httpClient.instance)
}

httpClient.instance.interceptors.request.use(async (config) => {
  commonRequestHeaders ||= getCommonRequestHeaders()

  if (store.lastSelectedNetworkNode === 'auto') {
    config.baseURL = getBaseUrl() || await getGatewayConfig()
  }
  else {
    config.baseURL = `https://${store.lastSelectedNetworkNode.gate}`
  }
  // api请求后端使用新域名
  if (config.headers.source === 'api') {
    config.baseURL = store.lastSelectedNetworkNode === 'auto' ? getOpenAPIUrl() : `https://${store.lastSelectedNetworkNode.api}`
    config.headers['r-api-token'] ||= store.userApiToken
  }

  // handleRequest(config)
  config.headers.token = store.token
  Object.assign(config.headers, {
    ...commonRequestHeaders,
    ...config.headers,
    workspaceId: config.headers.workspaceId || store.workspaceId,
    language: store.language,
  })

  config.metadata = {
    reqTime: Date.now(),
  }

  console.debug('config.headers', config.url, config.headers)
  // console.log('config.headers', config.headers)
  return config
}, (error) => {
  // 如果是连接被重置（ERR_CONNECTION_RESET）, 则重新获取后端地址
  if (error?.message?.includes('ERR_CONNECTION_RESET')) {
    getGatewayConfig()
  }
  return Promise.reject(error)
})

httpClient.instance.interceptors.response.use((response) => {
  const { url, baseURL } = response.config

  if (store.lastSelectedNetworkNode === 'auto') {
    reGetGatewayConfigByCountryChange({
      country: response.headers['r-real-country'],
      reqUrl: url ? new URL(url, baseURL).href : baseURL ?? '',
      reqTime: response.config.metadata?.reqTime ?? 0,
    })
  }

  const code = response.data.code
  if (code === 405) {
    ipcSender.user.kickedOut(response.data.data)
    browserManager.closeAll()
    if (isUninstallFeedbackMode) {
      executeUninstall()
    }
  }
  // 打开窗口后的 userMdfWindowSyncV2Create 在权限误报时也会返回 418，此处关窗会导致窗口无法打开。后端修复前暂停。
  // else if (code === 418) {
  //   const removedWorkspaceId = readWorkspaceIdHeader(response.config.headers)
  //   if (removedWorkspaceId !== undefined) {
  //     browserManager.closeByWorkspace(removedWorkspaceId)
  //   }
  // }
  handleResponse(response)
  return response
})

export const API = {
  window: new WindowApi(httpClient),
  proxy: new ProxyApi(httpClient),
  plugins: new PluginsApi(httpClient),
  logging: new LoggingApi(httpClient),
  team: new TeamApi(httpClient),
  base: new BaseApi(httpClient),
  platform: new PlatformApi(httpClient),
  limit: new LimitApi(httpClient),
  api: new ApiApi(httpClient),
  pay: new PayApi(httpClient),
  appTrackingEvent: new AppTrackingEventApi(httpClient),
} as const
