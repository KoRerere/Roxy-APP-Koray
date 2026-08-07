import { BaseApi, HttpClient, WindowApi } from '@roxy/backend-api'
import { env } from '../config'

const httpClient = new HttpClient({
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
  base: new BaseApi(httpClient),
} as const
