import { ApiApi, BaseApi, HttpClient, LimitApi, LoggingApi, PlatformApi, PluginsApi, ProxyApi, TeamApi, WindowApi } from '@roxy/backend-api'
import { app } from 'electron'
import https from 'node:https'
import { getGatewayConfig } from '/@/api/getGatewayConfig'
import { handleRequest, handleResponse } from '/@/api/util'
import { osConfig } from '/@/constants/osConfig'
import { store } from '/@/modules/store'
import { isDev, isPackaged } from '/@/utils'

const agent = new https.Agent({
  rejectUnauthorized: false,
})

export const httpClient = new HttpClient({
  // baseURL: 'https://lumitest.lumibrowser.com/',
  timeout: 10000,
  httpsAgent: agent,
})

const commonRequestHeaders = {
  os: osConfig.os,
  osVersion: osConfig.osVersion,
  osBit: osConfig.osBit,
  appVersion: app.getVersion(),
}

let baseURL = ''
httpClient.instance.interceptors.request.use(async (config) => {
  if (!baseURL) {
    baseURL = await getGatewayConfig()
  }
  config.baseURL = config.ossUrl || baseURL

  if (isDev) {
    console.log('store.token', store.token)
    console.log('store.workspaceId', store.workspaceId)
    console.log('config.headers.workspaceId', config.headers.workspaceId)
  }
  // handleRequest(config)
  config.headers.token = store.token
  Object.assign(config.headers, {
    ...commonRequestHeaders,
    workspaceId: config.headers.workspaceId || store.workspaceId,
    language: store.language,
  })
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
