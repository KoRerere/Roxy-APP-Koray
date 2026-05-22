import type { AxiosResponse } from 'axios'
import { parseHeaderParams } from '/@/api/message/util'
import { isEqual } from 'es-toolkit'
import type { UserGetCoreUpgradeCreateData } from '@roxy/backend-api'
import { CoreType } from '/@/enums'

/** 上一次版本 */
let lastCoreVersionList = {}
let isCheckingCoreVersion = false

export async function checkFirefoxCoreVersion(response: AxiosResponse<any, any>) {
  let core_last_version_list = {}

  if (!response.headers['r-firefox_core_last_version_list']) {
    return
  }

  try {
    // 解析自定义响应头
    core_last_version_list = parseHeaderParams(response.headers['r-firefox_core_last_version_list'])
  }
  catch (error) {

  }

  if (isEqual(core_last_version_list, lastCoreVersionList) || isCheckingCoreVersion) {
    return
  }

  isCheckingCoreVersion = true

  console.debug('checkFirefoxCoreVersion', core_last_version_list, lastCoreVersionList)
  const result = await globalThis.electronAPI.send('app:reGetUpdateInfo', 'kernel', CoreType.Firefox).finally(() => {
    isCheckingCoreVersion = false
  }) as UserGetCoreUpgradeCreateData
  console.debug('checkFirefoxCoreVersion result', result)
  if (result.code === 0) {
    lastCoreVersionList = core_last_version_list
  }
}
