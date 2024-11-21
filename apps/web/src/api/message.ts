import type { UserGetAppUpgradeCreateData, UserGetCoreUpgradeCreateData } from '@roxy/backend-api'
import type { AxiosResponse } from 'axios'
import { isEqual } from 'es-toolkit'
import { API } from '/@/api'

/** 上一次版本 */
let lastAppVersion = ''
let isCheckingAppVersion = false

function version2Number(version: string) {
  return Number(version.replace(/\./g, ''))
}

export async function checkAppVersion(response: AxiosResponse<any, any>) {
  const remoteVersion = response.headers['r-app_last_version']

  if (!remoteVersion || isCheckingAppVersion) {
    return
  }

  isCheckingAppVersion = true

  lastAppVersion ||= await electronAPI.send('app:getAppVersion')

  if (lastAppVersion && version2Number(remoteVersion) > version2Number(lastAppVersion)) {
    console.info('checkAppVersion', remoteVersion, lastAppVersion)
    const result = await electronAPI.send('app:reGetUpdateInfo', 'app').finally(() => {
      isCheckingAppVersion = false
    }) as UserGetAppUpgradeCreateData
    console.info('userGetAppUpgradeCreate result', result.data)
    if (result.code === 0 && result.data.version === remoteVersion) {
      lastAppVersion = remoteVersion
    }
  }
  else {
    isCheckingAppVersion = false
  }
}

/** 上一次版本 */
let lastCoreVersionList = {}
let isCheckingCoreVersion = false

export async function checkCoreVersion(response: AxiosResponse<any, any>) {
  let core_last_version_list = {}

  try {
    // 解析自定义响应头
    core_last_version_list = parseHeaderParams(response.headers['r-core_last_version_list'])
  }
  catch (error) {

  }

  if (isEqual(core_last_version_list, lastCoreVersionList) || isCheckingCoreVersion) {
    return
  }

  isCheckingCoreVersion = true

  console.info('checkCoreVersion', core_last_version_list, lastCoreVersionList)
  const result = await electronAPI.send('app:reGetUpdateInfo', 'kernel').finally(() => {
    isCheckingCoreVersion = false
  }) as UserGetCoreUpgradeCreateData
  console.info('userGetCoreUpgradeCreate result', result.data)
  if (result.code === 0) {
    lastCoreVersionList = core_last_version_list
  }
}

function parseHeaderParams(headerValue: string) {
  const params: Recordable = {}
  // 将参数按分号分隔，遍历并解析每个键值对
  headerValue.split(';').forEach((part) => {
    const [key, value] = part.split('=').map(str => str.trim())
    if (key && value) {
      params[key] = value.replace(/^"|"$/g, '') // 移除引号（如果有）
    }
  })
  return params
}
