import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { isString } from 'es-toolkit'
import { decryptAESGCM, encryptAESGCM, isDev } from '/@/utils'

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

export const needDeviceIdApis = [
  '/reg',
  '/login',
  '/login_google_v2',
  '/login_github',
  '/login_vk',
  '/login_facebook',
  '/login_phone',
  '/send_phone_ver_code',
  '/send_email_register_verify_code',
  '/check_other_device_login',
  '/get_2fa_login_info',
  '/user_reg_gift',
  '/user_register_gift_config',
]

export async function handleRequest(config: InternalAxiosRequestConfig<any>) {
  if (!isDev && config.method === 'post' && requestHandleUrls.some(url => config.url?.includes(url))) {
    console.log('config.url', config.url)
    config.data = {
      data: await encryptAESGCM(JSON.stringify(config.data)),
    }
  }
}

export async function handleResponse(response: AxiosResponse<any, any>) {
  if (!isDev && responseHandleUrls.some(url => response.config.url?.includes(url))) {
    if (isString(response.data.data)) {
      response.data.data = await decryptAESGCM(response.data.data)
    }
  }
}

let commonHeadersPromise: Promise<Record<string, string>> | null = null
export async function getCommonHeaders() {
  if (commonHeadersPromise) {
    return commonHeadersPromise
  }
  commonHeadersPromise = globalThis.electronAPI.send('util:getCommonRequestHeaders')
    .catch(() => ({}))
    .finally(() => {
      commonHeadersPromise = null
    })
}

let getGatewayConfigPromise: Promise<string> | null = null
export async function getGatewayConfig() {
  if (getGatewayConfigPromise) {
    return getGatewayConfigPromise
  }
  getGatewayConfigPromise = globalThis.electronAPI.send('util:getGatewayConfig')
  return getGatewayConfigPromise.finally(() => {
    getGatewayConfigPromise = null
  })
}

let getInviteCodePromise: Promise<string> | null = null
export async function getInviteCode() {
  if (getInviteCodePromise) {
    return getInviteCodePromise
  }
  getInviteCodePromise = globalThis.electronAPI.send('util:getInviteCode')
    .catch(() => '')
  return getInviteCodePromise.finally(() => {
    getInviteCodePromise = null
  })
}

let getDeviceIdPromise: Promise<string> | null = null
export async function getDeviceId() {
  if (getDeviceIdPromise) {
    return getDeviceIdPromise
  }
  getDeviceIdPromise = globalThis.electronAPI.send('util:getDeviceId')
    .catch(() => '')
  return getDeviceIdPromise.finally(() => {
    getDeviceIdPromise = null
  })
}
