import type { AxiosResponse } from 'axios'
import { API } from '/@/api'
import { checkDictVersion } from '/@/api/checkDictVersion'
import { osConfig } from '/@/constants'
import { store } from '/@/modules/store'
import { checkChromeCoreVersion } from './checkChromeCoreVersion'
import { checkFirefoxCoreVersion } from './checkFirefoxCoreVersion'

export function handleResponse(response: AxiosResponse<any, any>) {
  if (response.data?.code === 0 && store.token) {
    checkChromeCoreVersion(response)
    checkFirefoxCoreVersion(response)
    checkDictVersion(response)
  }
}

export function parseHeaderParams(headerValue: string) {
  const params: Record<string, string> = {}
  // 将参数按分号分隔，遍历并解析每个键值对
  headerValue.split(';').forEach((part) => {
    const [key, value] = part.split('=').map(str => str.trim())
    if (key && value) {
      params[key] = value.replace(/^"|"$/g, '') // 移除引号（如果有）
    }
  })
  return params
}

let lastRequestTime = 0
let lastWebDomain = ''
/** 获取 webDomain, 根据用户的IP切换对应的域名，如果是国内就用深圳，国外就是香港 */
export async function getWebDomain(force = true) {
  // 如果 force 为 false，则不强制更新 webDomain
  if (!force && lastWebDomain) {
    return lastWebDomain
  }

  if (lastWebDomain && Date.now() - lastRequestTime < 1000 * 60 * 5) {
    return lastWebDomain
  }
  const { code, data, msg } = await API.base.getAppUpgradeCreate(osConfig)
  console.debug('getWebDomain', code, data)
  if (code === 0 && data.webDomain) {
    lastWebDomain = data.webDomain
    lastRequestTime = Date.now()
  }
  if (code !== 0) {
    console.error('getWebDomain error', osConfig, msg)
  }
  return lastWebDomain
}
