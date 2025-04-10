import { ApiApi, BaseApi, HttpClient, LimitApi, LoggingApi, PlatformApi, PluginsApi, ProxyApi, TeamApi, WindowApi } from '@roxy/backend-api'
import { app } from 'electron'
import https from 'node:https'
import { getGatewayConfig, getOpenAPIUrl } from '/@/api/getGatewayConfig'
import { handleRequest, handleResponse } from '/@/api/util'
import { osConfig } from '/@/constants/osConfig'
import { store } from '/@/modules/store'
import { getCommonRequestHeaders, isDev, isPackaged } from '/@/utils'

// const agent = new https.Agent({
//   rejectUnauthorized: false,
// })

export const httpClient = new HttpClient({
  // baseURL: 'https://lumitest.lumibrowser.com/',
  timeout: 15000,
  // httpsAgent: agent,
  adapter: 'fetch',
})

let commonRequestHeaders

let baseURL = ''
httpClient.instance.interceptors.request.use(async (config) => {
  if (!baseURL) {
    baseURL = await getGatewayConfig()
  }
  commonRequestHeaders ||= await getCommonRequestHeaders()
  config.baseURL = baseURL

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

  if (isDev) {
    console.log('config.headers', config.url, config.headers)
  }

  // console.log('config.headers', config.headers)
  return config
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
