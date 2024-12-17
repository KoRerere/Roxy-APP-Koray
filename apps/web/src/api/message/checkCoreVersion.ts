import type { AxiosResponse } from "axios"
import { parseHeaderParams } from "/@/api/message/util"
import { isEqual } from "es-toolkit"
import type { UserGetCoreUpgradeCreateData } from "@roxy/backend-api"

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
