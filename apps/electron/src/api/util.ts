import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { API } from '/@/api'
import { osConfig } from '/@/constants'
import { decryptAESGCM, encryptAESGCM } from '/@/utils'
import { isDev } from '/@/constants/common'

/** 需要使用 aes-256-gcm 加解密的接口数据 */
const requestHandleUrls = [
  '/user_add_window_info',
  '/user_batch_window_info',
  '/user_import_window_info',
  '/user_mdf_window_info_single',
  '/user_mdf_window_info_batch',
  '/user_mdf_window_sync_v2',
]

const responseHandleUrls = [
  '/user_get_window_info',
  '/user_get_window_info_recycle',
]

export function handleRequest(config: InternalAxiosRequestConfig<any>) {
  if (!isDev && config.method === 'post' && requestHandleUrls.some(url => config.url?.includes(url))) {
    console.log('config.url', config.url)
    config.data = {
      data: encryptAESGCM(JSON.stringify(config.data)),
    }
  }
}

export function handleResponse(response: AxiosResponse<any, any>) {
  if (!isDev && responseHandleUrls.some(url => response.config.url?.includes(url))) {
    response.data.data = decryptAESGCM(response.data.data)
  }
}

let lastRequestTime = 0
let lastWebDomain = ''
/** 获取 webDomain, 根据用户的IP切换对应的域名，如果是国内就用深圳，国外就是香港 */
export async function getWebDomain(force = true) {
  // 如果 force 为 false，则不强制更新 webDomain
  if (!force) {
    return lastWebDomain
  }

  if (lastWebDomain && Date.now() - lastRequestTime < 1000 * 60 * 5) {
    return lastWebDomain
  }
  const { code, data } = await API.base.getAppUpgradeCreate(osConfig)
  console.debug('getWebDomain', code, data)
  if (code === 0 && data.webDomain) {
    lastWebDomain = data.webDomain
    lastRequestTime = Date.now()
  }
  if (code !== 0) {
    console.error('getWebDomain error', osConfig)
  }
  return lastWebDomain
}
