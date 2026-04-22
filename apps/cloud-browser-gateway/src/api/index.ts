import { BaseApi, HttpClient, PluginsApi, UserGetCloudBrowserRemainingUsageApi, WindowApi } from '@roxy/backend-api'
import { commonRequestHeaders } from '~/constants/common'

export const httpClient = new HttpClient({
  baseURL: process.env.API_BASE_URL || 'https://apitest.roxybrowser.co',
  timeout: 15000,
  proxy: false,
})

httpClient.instance.interceptors.request.use(async (config) => {
  Object.assign(config.headers, {
    ...commonRequestHeaders,
    ...config.headers,
  })
  return config
}, (error) => {
  return Promise.reject(error)
})

httpClient.instance.interceptors.response.use((response) => {
  return response
})

export const API = {
  window: new WindowApi(httpClient),
  base: new BaseApi(httpClient),
  plugins: new PluginsApi(httpClient),
  cloudBrowserRemainingUsage: new UserGetCloudBrowserRemainingUsageApi(httpClient),
} as const
