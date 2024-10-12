import { BaseApi, HttpClient, LoggingApi, PluginsApi, ProxyApi, TeamApi, WindowApi } from '@roxy/backend-api'
import { app } from 'electron'
import { osConfig } from '/@/constants/osConfig'
import { store } from '/@/modules/store'

export const httpClient = new HttpClient({
  baseURL: 'https://lumitest.lumibrowser.com/',
})

const commonRequestHeaders = {
  os: osConfig.os,
  osVersion: osConfig.osVersion,
  osBit: osConfig.osBit,
  appVersion: app.getVersion(),
}

httpClient.instance.interceptors.request.use((config) => {
  if (import.meta.env.DEV) {
    console.log('store.token', store.token)
    console.log('store.workspaceId', store.workspaceId)
  }
  config.headers.token = store.token
  Object.assign(config.headers, {
    ...commonRequestHeaders,
    workspaceId: store.workspaceId,
  })
  return config
})

export const API = {
  window: new WindowApi(httpClient),
  proxy: new ProxyApi(httpClient),
  plugins: new PluginsApi(httpClient),
  logging: new LoggingApi(httpClient),
  team: new TeamApi(httpClient),
  base: new BaseApi(httpClient),
} as const
