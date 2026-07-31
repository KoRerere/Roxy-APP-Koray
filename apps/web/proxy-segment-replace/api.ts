import {
  BaseApi,
  HttpClient,
  UserGetProxySegmentReplaceListApi,
} from '@roxy/backend-api'
import { serializeRequestParams } from '/@/api/serializeRequestParams'
import { getBaseUrl, getGatewayConfig, reGetGatewayConfigByCountryChange } from '/@/api/getGatewayConfig'
import { getCommonRequestHeaders } from '/@/electron-api-polyfill/utils/getCommonHeaders'
import { authToken } from './token'
import { pageLocale } from './locale'

export { authToken }

export const httpClient = new HttpClient({
  baseURL: import.meta.env.DEV ? 'https://apitest.roxybrowser.co' : 'https://hz.gate.roxybrowser.cn',
  paramsSerializer(params) {
    return serializeRequestParams(params)
  },
})

httpClient.instance.interceptors.request.use(async (config) => {
  const baseURL = getBaseUrl() || await getGatewayConfig()

  Object.assign(config.headers, getCommonRequestHeaders())

  config.metadata = {
    reqTime: Date.now(),
  }

  config.baseURL ||= baseURL
  config.headers.token = authToken
  config.headers.source = 'web'
  config.headers.language = pageLocale

  return config
}, (error) => {
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

  return response
})

export const API = {
  base: new BaseApi(httpClient),
  userGetProxySegmentReplaceList: new UserGetProxySegmentReplaceListApi(httpClient),
}
