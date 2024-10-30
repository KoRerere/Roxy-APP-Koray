import {
  ApiApi,
  BaseApi,
  HttpClient,
  LimitApi,
  LoggingApi,
  PlatformApi,
  PluginsApi,
  ProxyApi,
  TeamApi,
  WindowApi,
} from '@roxy/backend-api'
import qs from 'qs'
import { handleRequest, handleResponse } from '/@/api/util'
import router from '/@/router'
import { useSimpleLocale } from '/@/stores/locale'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'

console.log('VITE_BASE_URL', import.meta.env.VITE_BASE_URL)

export const httpClient = new HttpClient({
  /**
   * baseURL: import.meta.env.VITE_BASE_URL,
   */
  paramsSerializer(params) { return qs.stringify(params, { arrayFormat: 'comma' }) },
})

let baseURL = ''
httpClient.instance.interceptors.request.use(async (config) => {
  if (!baseURL) {
    baseURL = await electronAPI.send('util:getGatewayConfig')
  }
  config.baseURL = baseURL

  const { token, appVersion } = useUserStore()
  const { currentWorkspace } = useWorkspaceStore()
  const { currentLocale } = useSimpleLocale()
  config.headers.token ||= token
  config.headers.language = currentLocale
  config.headers.appVersion = appVersion
  config.headers.workspaceId = currentWorkspace?.id

  await handleRequest(config)

  return config
})

httpClient.instance.interceptors.response.use(async (response) => {
  if (response.data.code === 405) {
    // 未登录
    useUserStore().clearUserInfo()
    router.push({ name: 'login' })
    return response
  }
  await handleResponse(response)
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
}
