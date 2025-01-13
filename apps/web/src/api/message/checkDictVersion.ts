import type { AxiosResponse } from "axios"
import { getDictVersion } from "/@/utils"

/** 上一次版本 */
let lastVersion = localStorage.getItem('lastDictVersion') || ''
let isCheckingVersion = false

export async function checkDictVersion(response: AxiosResponse<any, any>) {
  const remoteVersion = response.headers['r-dict_version']

  if (!remoteVersion || isCheckingVersion) {
    return
  }

  isCheckingVersion = true

  if (remoteVersion > lastVersion) {
    console.info('checkAppVersion', remoteVersion, lastVersion)
    await getDictVersion().finally(() => {
      isCheckingVersion = false
    })
    lastVersion = remoteVersion
    localStorage.setItem('lastDictVersion', remoteVersion)
  }
  else {
    isCheckingVersion = false
  }
}
