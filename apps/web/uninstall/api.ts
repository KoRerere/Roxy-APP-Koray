import {
  BaseApi,
  HttpClient,
  UserAddUninstallReasonAnswerApi,
} from '@roxy/backend-api'
import { serializeRequestParams } from '/@/api/serializeRequestParams'
import { getBaseUrl, getGatewayConfig, reGetGatewayConfigByCountryChange } from '/@/api/getGatewayConfig'
import { getCommonHeaders, getDeviceId, needDeviceIdApis } from '/@/api/util'
import { emitter } from '/@/utils/eventBus'
import { debounce } from 'es-toolkit'

export const httpClient = new HttpClient({
  baseURL: import.meta.env.DEV ? 'https://apitest.roxybrowser.co' : 'https://hz.gate.roxybrowser.cn',
  paramsSerializer(params) {
    return serializeRequestParams(params)
  },
})

let commonHeaders
let deviceId = ''
let appVersion = ''

httpClient.instance.interceptors.request.use(async (config) => {
  const baseURL = getBaseUrl() || await getGatewayConfig()
  appVersion ||= await globalThis.electronAPI.send('app:getAppVersion')
  commonHeaders ||= await getCommonHeaders()

  if (needDeviceIdApis.some(api => config.url?.includes(api))) {
    deviceId ||= await getDeviceId()
    config.headers['R-DEVICE-ID'] = deviceId
  }

  Object.assign(config.headers, {
    ...commonHeaders,
    ...config.headers,
  })

  config.metadata = {
    reqTime: Date.now(),
  }

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
    getGatewayConfig()
  }
  return Promise.reject(error)
})

const closeOtherWindow = debounce(() => {
  globalThis.electronAPI.send('app:uninstall-directly')
}, 200)

httpClient.instance.interceptors.response.use(async (response) => {
  const { url, baseURL } = response.config

  reGetGatewayConfigByCountryChange({
    country: response.headers['r-real-country'],
    reqUrl: url ? new URL(url, baseURL).href : baseURL ?? '',
    reqTime: response.config.metadata?.reqTime ?? 0,
  })

  console.log('response.data', response.data)
  const code = response.data.code
  if (code === 405) {
    // 踢出登录
    emitter.emit('kickedOut', response.data.data)
    // closeOtherWindow()
    return response
  }
  else if (code === 403) {
    // closeOtherWindow()
    return response
  }
  // await handleResponse(response)
  return response
})

export const API = {
  base: new BaseApi(httpClient),
  userAddUninstallReasonAnswer: new UserAddUninstallReasonAnswerApi(httpClient),
}
