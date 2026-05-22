import { ApiApi, BaseApi, HttpClient, LimitApi, LoggingApi, PlatformApi, PluginsApi, ProxyApi, TeamApi, WindowApi } from '@roxy/backend-api'
import { env } from '../config'

export const httpClient = new HttpClient({
  timeout: 15000,
  proxy: false,
})

let baseURL = env.ROXY_SERVER_URL || ''
process.parentPort?.on('message', (e) => {
  console.log('base_url_changed', e.data.baseUrl)
  baseURL = e.data.baseUrl || baseURL
})

httpClient.instance.interceptors.request.use(async (config) => {
  config.baseURL = env.ROXY_SERVER_URL

  // handleRequest(config)
  config.headers.token = env.ROXY_USER_TOKEN

  Object.assign(config.headers, {
    ...env.ROXY_SERVER_HEADERS,
    ...config.headers,
    workspaceId: env.ROXY_WORKSPACE_ID,
    language: env.SYSTEM_LANGUAGE,
  })
  console.debug('config.headers', config.url, config.headers)
  return config
}, (error) => {
  return Promise.reject(error)
})

httpClient.instance.interceptors.response.use((response) => {
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
