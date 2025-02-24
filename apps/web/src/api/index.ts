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
import { handleResponseHeaders } from '/@/api/message/'
import { emitter } from '/@/utils/eventBus'
import { debounce } from 'es-toolkit'

console.log('VITE_BASE_URL', import.meta.env.VITE_BASE_URL)

export const httpClient = new HttpClient({
  /**
   * baseURL: import.meta.env.VITE_BASE_URL,
   */
  paramsSerializer(params) {
    return qs.stringify(params, { arrayFormat: 'comma' })
  },
})

let baseURL = ''
let commonRequestHeaders
let getGatewayConfigPromise: Promise<any> | null = null
let getCommonRequestHeadersPromise: Promise<any> | null = null

httpClient.instance.interceptors.request.use(async (config) => {
  baseURL ||= await (getGatewayConfigPromise ||= electronAPI.send('util:getGatewayConfig')).finally(() => {
    getGatewayConfigPromise = null
  })
  commonRequestHeaders ||= await (getCommonRequestHeadersPromise ||= electronAPI.send('util:getCommonRequestHeaders').catch(() => electronAPI.send('const:osConfig')).finally(() => {
    getCommonRequestHeadersPromise = null
  }))

  config.baseURL = baseURL

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
  config.headers['R-OS'] ||= commonRequestHeaders.os === 'darwin' ? 'mac' : 'win'
  config.headers['R-OSBIT'] ||= commonRequestHeaders.os === 'darwin' ? commonRequestHeaders.cpu : commonRequestHeaders.osBit
  Object.assign(config.headers, commonRequestHeaders)
  // await handleRequest(config)

  return config
})

const closeOtherWindow = debounce(async () => {
  const isMainWindow = await electronAPI.send('app:isMainWindow')
  if (!isMainWindow) {
    window.close()
  }
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
    router.push({ name: 'login' })
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
}
