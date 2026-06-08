import type { AxiosResponse } from 'axios'
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

  // 以 lastCoreVersionList 的 key 为准，只要有任意一个 key 在新版本列表中的值发生了变化，才触发重新拉取
  const lastVersionList = coreManager.chromeCoreManager.lastCoreVersionList
  const hasChanged = Object.keys(lastVersionList).some(
    key => core_last_version_list[key] !== undefined
      && core_last_version_list[key] !== lastVersionList[key],
  )

  if (!hasChanged || isCheckingCoreVersion) {
    return
  }

  isCheckingCoreVersion = true

  console.info('checkChromeCoreVersion', core_last_version_list, coreManager.chromeCoreManager.lastCoreVersionList)
  coreManager.chromeCoreManager.fetchAvailableCoreList().finally(() => {
    isCheckingCoreVersion = false
  })
}
