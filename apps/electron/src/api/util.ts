import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
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
