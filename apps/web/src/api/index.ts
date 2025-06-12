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
  PayApi,
} from '@roxy/backend-api'
import qs from 'qs'
import { handleRequest, handleResponse } from '/@/api/util'
import { useSimpleLocale } from '/@/stores/locale'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { handleResponseHeaders } from '/@/api/message/'
import { emitter } from '/@/utils/eventBus'
import { debounce } from 'es-toolkit'
import { isMainWindow } from '/@/utils'
import { AxiosError } from 'axios'

console.log('VITE_BASE_URL', import.meta.env.VITE_BASE_URL)

export const httpClient = new HttpClient({
  /**
   * baseURL: import.meta.env.VITE_BASE_URL,
   */
  baseURL: 'https://roxybrowser.app/api',
  paramsSerializer(params) {
    return qs.stringify(params, { arrayFormat: 'comma' })
  },
})

httpClient.instance.interceptors.request.use(async (config) => {

  const { token, appVersion } = useUserStore()
  const { currentWorkspace } = useWorkspaceStore()
  const { currentLocale } = useSimpleLocale()
  config.headers.token ||= token
  config.headers.language = currentLocale
  config.headers.source = 'app'
  config.headers.appVersion = appVersion
  config.headers.workspaceId = currentWorkspace?.id
  // R-OS:mac/win
  // R-OSBIT:apple/intel/64/11
  // R-VERSION:1.0.0
  // await handleRequest(config)

  return config
}, (error) => {
  if (error?.message?.includes('ERR_CONNECTION_RESET')) {
    reGetGatewayConfig()
  }
  return Promise.reject(error)
})

const closeOtherWindow = debounce(() => {
  if (!isMainWindow) {
    window.close()
  }
}, 200)

const reGetGatewayConfig = debounce(() => {
  electronAPI.send('util:getGatewayConfig')
}, 200)

httpClient.instance.interceptors.response.use(async (response) => {
  const code = response.data.code
  if (code === 405) {
    // 踢出登录
    emitter.emit('kickedOut', response.data.data)
    closeOtherWindow()
    return response
  } else if (code === 403) {
    closeOtherWindow()
    // 未登录
    useUserStore().clearUserInfo()
    const { default: router } = await import('/@/router')
    router.push({ name: 'login' })
    return response
  }
  // 没有空间权限或被移出空间
  else if (code === 418) {
    const { defaultWorkspace, setCurrentWorkspace, fetchWorkspaceList } = useWorkspaceStore()
    setCurrentWorkspace(defaultWorkspace!.id!)
    fetchWorkspaceList()
    return response
  }
  const { config } = response
  if (config.headers.token) {
    handleResponseHeaders(response)
  }
  // await handleResponse(response)
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
  pay: new PayApi(httpClient),
}