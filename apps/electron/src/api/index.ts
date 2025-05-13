import { ApiApi, BaseApi, HttpClient, LimitApi, LoggingApi, PlatformApi, PluginsApi, ProxyApi, TeamApi, WindowApi } from '@roxy/backend-api'
import { getBaseUrl, getGatewayConfig, getOpenAPIUrl } from '/@/api/getGatewayConfig'
import { handleRequest, handleResponse } from '/@/api/util'
import { osConfig } from '/@/constants/osConfig'
import { store } from '/@/modules/store'
import { appCliStartArgs, getCommonRequestHeaders, isDev, isPackaged } from '/@/utils'
import { attachAxiosLogger } from './axiosLogger'
// const agent = new https.Agent({
//   rejectUnauthorized: false,
// })

export const httpClient = new HttpClient({
  // baseURL: 'https://lumitest.lumibrowser.com/',
  timeout: 15000,
  // httpsAgent: agent,
  // adapter: 'fetch',
})

let commonRequestHeaders

// 开启请求日志
if (appCliStartArgs['roxy-log-level'] === 'debug') {
  attachAxiosLogger(httpClient.instance)
}

httpClient.instance.interceptors.request.use(async (config) => {
  commonRequestHeaders ||= getCommonRequestHeaders()
  config.baseURL = getBaseUrl() || await getGatewayConfig()

  // handleRequest(config)
  config.headers.token = store.token
  Object.assign(config.headers, {
    ...commonRequestHeaders,
    ...config.headers,
    workspaceId: config.headers.workspaceId || store.workspaceId,
    language: store.language,
  })
  // api请求后端使用新域名
  if (config.headers.source === 'api') {
    config.baseURL = getOpenAPIUrl()
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
  // handleResponse(response)
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
} as const
