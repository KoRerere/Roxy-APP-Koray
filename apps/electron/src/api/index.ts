import { BaseApi, HttpClient, LoggingApi, PluginsApi, ProxyApi, TeamApi, WindowApi } from '@roxy/backend-api'
import { app } from 'electron'
import https from 'node:https'
import { handleRequest, handleResponse } from '/@/api/util'
import { osConfig } from '/@/constants/osConfig'
import { store } from '/@/modules/store'
import { isDev } from '/@/utils'

const agent = new https.Agent({
  rejectUnauthorized: false,
})

export const httpClient = new HttpClient({
  baseURL: 'https://lumitest.lumibrowser.com/',
  timeout: 10000,
  httpsAgent: agent,
})

const commonRequestHeaders = {
  os: osConfig.os,
  osVersion: osConfig.osVersion,
  osBit: osConfig.osBit,
  appVersion: app.getVersion(),
}

httpClient.instance.interceptors.request.use((config) => {
  if (isDev) {
    console.log('store.token', store.token)
    console.log('store.workspaceId', store.workspaceId)
  }
  handleRequest(config)
  config.headers.token = store.token
  Object.assign(config.headers, {
    ...commonRequestHeaders,
    workspaceId: store.workspaceId,
    language: store.language,
  })
  return config
})

httpClient.instance.interceptors.response.use((response) => {
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
} as const
