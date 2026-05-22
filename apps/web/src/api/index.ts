import {
  ApiApi,
  AppTrackingEventApi,
  BaseApi,
  HttpClient,
  LimitApi,
  LoggingApi,
  PayApi,
  PlatformApi,
  PluginsApi,
  ProxyApi,
  TeamApi,
  UserAddUninstallReasonAnswerApi,
  WindowApi,
} from '@roxy/backend-api'
import { serializeRequestParams } from '/@/api/serializeRequestParams'
import { getBaseUrl, getGatewayConfig, reGetGatewayConfigByCountryChange } from '/@/api/getGatewayConfig'
import { getCommonHeaders, getDeviceId, getInviteCode, needDeviceIdApis } from '/@/api/util'
import { useSimpleLocale } from '/@/stores/locale'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { handleResponseHeaders } from '/@/api/message/'
import { emitter } from '/@/utils/eventBus'
import { debounce } from 'es-toolkit'
import { isMainWindow } from '/@/utils'
import { markSessionLost } from '/@/utils/sessionLost'
// import { AxiosError } from 'axios'

console.log('VITE_BASE_URL', import.meta.env.VITE_BASE_URL)

export const httpClient = new HttpClient({
  /**
   * baseURL: import.meta.env.VITE_BASE_URL,
   */
  /**
   * baseURL: 'https://roxybrowser.app/api',
   */
  paramsSerializer(params) {
    return serializeRequestParams(params)
  },
})

let commonHeaders
let deviceId = ''
let inviteCode: string

const closeOtherWindow = debounce(() => {
  if (!isMainWindow) {
    window.close()
  }
}, 200)

const showBackDefaultWorkspace = debounce(() => {
  emitter.emit('backDefaultWorkspace')
}, 200)

httpClient.instance.interceptors.request.use(async (config) => {
  const baseURL = getBaseUrl() || await getGatewayConfig()
  commonHeaders ||= await getCommonHeaders()
  inviteCode ??= await getInviteCode()

  if (needDeviceIdApis.some(api => config.url?.includes(api))) {
    deviceId ||= await getDeviceId()
    config.headers['R-DEVICE-ID'] = deviceId
  }

  Object.assign(config.headers, {
    ...commonHeaders,
    ...config.headers,
  })

  console.debug('baseURL', baseURL)
  config.baseURL ||= baseURL

  const { token, appVersion } = useUserStore()
  const { currentWorkspace } = useWorkspaceStore()
  const { currentLocale } = useSimpleLocale()
  config.headers.token ||= token
  config.headers.source = globalThis.isElectron ? 'app' : 'web'
  config.headers.language = currentLocale
  config.headers.appVersion = appVersion
  config.headers.workspaceId = currentWorkspace?.id
  config.headers['R-INVITE-CODE'] = inviteCode
  config.metadata = {
    reqTime: Date.now(),
  }
  // R-OS:mac/win
  // R-OSBIT:apple/intel/64/11
  // R-VERSION:1.0.0
  // await handleRequest(config)

  return config
}, (error) => {
  console.error('request error', error)
  if (error?.message?.includes('ERR_CONNECTION_RESET')) {
    getGatewayConfig()
  }
  return Promise.reject(error)
})

httpClient.instance.interceptors.response.use(async (response) => {
  const { url, baseURL } = response.config

  reGetGatewayConfigByCountryChange({
    country: response.headers['r-real-country'],
    reqUrl: url ? new URL(url, baseURL).href : baseURL ?? '',
    reqTime: response.config.metadata?.reqTime ?? 0,
  })

  const code = response.data.code
  if (code === 405) {
    // 记录首次掉登录态时间（不重复覆盖，避免轮询 403 重置 1 小时计时）
    markSessionLost()
    // 踢出登录
    emitter.emit('kickedOut', response.data.data)
    closeOtherWindow()
    return response
  }
  else if (code === 403) {
    markSessionLost() // 同上，仅记录首次失效时间
    closeOtherWindow()
    // 未登录，跳转登录页；强制升级弹窗由 useForceUpgradeOnSessionLostReturn 在用户回到 APP 时触发
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
    globalThis.electronAPI.send('mcp:close')
    return response
  }
  else if (code === 422) {
    showBackDefaultWorkspace()
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
  appTrackingEvent: new AppTrackingEventApi(httpClient),
  userAddUninstallReasonAnswer: new UserAddUninstallReasonAnswerApi(httpClient),
}
