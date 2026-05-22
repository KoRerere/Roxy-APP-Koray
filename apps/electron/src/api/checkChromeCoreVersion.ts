import type { AxiosResponse } from 'axios'
import { isEqual } from 'es-toolkit'
import { coreManager } from '/@/modules/browser'
import { parseHeaderParams } from './util'

/** 上一次版本 */
let isCheckingCoreVersion = false

export async function checkChromeCoreVersion(response: AxiosResponse<any, any>) {
  let core_last_version_list = {}

  if (!response.headers['r-core_last_version_list']) {
    return
  }

  try {
    // 解析自定义响应头
    core_last_version_list = parseHeaderParams(response.headers['r-core_last_version_list'])
  }
  catch (error) {
    console.error('checkChromeCoreVersion parseHeaderParams error', error)
  }

  if (isEqual(core_last_version_list, coreManager.chromeCoreManager.lastCoreVersionList) || isCheckingCoreVersion) {
    return
  }

  isCheckingCoreVersion = true

  console.info('checkChromeCoreVersion', core_last_version_list, coreManager.chromeCoreManager.lastCoreVersionList)
  coreManager.chromeCoreManager.fetchAvailableCoreList().finally(() => {
    isCheckingCoreVersion = false
  })
}
