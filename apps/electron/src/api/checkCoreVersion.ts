import type { AxiosResponse } from 'axios'
import { isEqual } from 'es-toolkit'
import { coreManager } from '/@/modules/browser'
import { parseHeaderParams } from './util'

/** 上一次版本 */
let isCheckingCoreVersion = false

export async function checkCoreVersion(response: AxiosResponse<any, any>) {
  let core_last_version_list = {}

  try {
    // 解析自定义响应头
    core_last_version_list = parseHeaderParams(response.headers['r-core_last_version_list'])
  }
  catch (error) {

  }

  if (isEqual(core_last_version_list, coreManager.lastChromeCoreVersionList) || isCheckingCoreVersion) {
    return
  }

  isCheckingCoreVersion = true

  console.info('checkCoreVersion', core_last_version_list, coreManager.lastChromeCoreVersionList)
  coreManager.fetchAvailableCoreList().finally(() => {
    isCheckingCoreVersion = false
  })
}
