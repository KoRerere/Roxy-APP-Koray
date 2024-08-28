import { BaseApi, HttpClient, LoggingApi, PluginsApi, ProxyApi, TeamApi, WindowApi } from '@roxy/backend-api'
import { store } from '/@/modules/store'
import { app } from 'electron'
import { osConfig } from '/@/constants/osConfig'

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
  console.log('store.userInfo.token', store.userInfo.token)
  config.headers.token = store.userInfo.token
  Object.assign(config.headers, commonRequestHeaders)
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
