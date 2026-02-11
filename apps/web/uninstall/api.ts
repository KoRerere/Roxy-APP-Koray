import {
  BaseApi,
  HttpClient,
  UserAddUninstallReasonAnswerApi,
} from '@roxy/backend-api'
import qs from 'qs'
import { getCommonHeaders, getDeviceId, getGatewayConfig, needDeviceIdApis } from '/@/api/util'
import { emitter } from '/@/utils/eventBus'
import { debounce } from 'es-toolkit'
import { isDev, isMainWindow } from '/@/utils'

export const httpClient = new HttpClient({
  baseURL: isDev ? 'https://apitest.roxybrowser.co' : 'https://hz.gate.roxybrowser.cn',
  paramsSerializer(params) {
    return qs.stringify(params, { arrayFormat: 'comma' })
  },
})

let baseURL = ''
let commonHeaders
let deviceId = ''
let appVersion = ''

globalThis?.globalThis.electronAPI?.on('app:backend-url-change', (url) => {
  console.log('app:backend-url-change', url)
  baseURL = url
})

httpClient.instance.interceptors.request.use(async (config) => {
  appVersion ||= await globalThis.electronAPI.send('app:getAppVersion')
  baseURL ||= await getGatewayConfig()
  commonHeaders ||= await getCommonHeaders()

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

  config.headers.token ||= globalThis.$softConfig.token
  config.headers.language = globalThis.$softConfig.language
  config.headers.source = 'app'
  config.headers.appVersion = appVersion
  config.headers.workspaceId = globalThis.$softConfig.workspaceId
  // R-OS:mac/win
  // R-OSBIT:apple/intel/64/11
  // R-VERSION:1.0.0
  // await handleRequest(config)
  console.log('config.headers', config.headers)
  return config
}, (error) => {
  if (error?.message?.includes('ERR_CONNECTION_RESET')) {
    reGetGatewayConfig()
  }
  return Promise.reject(error)
})

const closeOtherWindow = debounce(() => {
  globalThis.electronAPI.send('app:uninstall-directly')
}, 200)

const reGetGatewayConfig = debounce(() => {
  globalThis.electronAPI.send('util:getGatewayConfig')
}, 200)

const reGetGatewayConfigByIpChange = debounce((ip: string) => {
  globalThis.electronAPI.send('util:reGetGatewayConfigByIpChange', ip)
}, 200)

httpClient.instance.interceptors.response.use(async (response) => {
  reGetGatewayConfigByIpChange(response.headers['r-real-ip'])
  console.log('response.data', response.data)
  const code = response.data.code
  if (code === 405) {
    // 踢出登录
    emitter.emit('kickedOut', response.data.data)
    closeOtherWindow()
    return response
  }
  else if (code === 403) {
    closeOtherWindow()
    return response
  }
  // await handleResponse(response)
  return response
})

export const API = {
  base: new BaseApi(httpClient),
  userAddUninstallReasonAnswer: new UserAddUninstallReasonAnswerApi(httpClient),
}
