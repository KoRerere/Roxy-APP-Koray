import type { AxiosResponse } from "axios"
import { getDictVersion } from "/@/utils"

/** 上一次版本 */
let lastVersion = localStorage.getItem('r_max_software_version') || ''
let isCheckingVersion = false

export async function checkSoftConfigVersion(response: AxiosResponse<any, any>) {
  const remoteVersion = response.headers['r_max_software_version']

  if (!remoteVersion || isCheckingVersion) {
    return
  }

  isCheckingVersion = true

  if (remoteVersion > lastVersion) {
    console.info('checkDictVersion', remoteVersion, lastVersion)
    await globalThis.electronAPI.send('app:fetchSoftConfig').finally(() => {
      isCheckingVersion = false
    })
    lastVersion = remoteVersion
    localStorage.setItem('r_max_software_version', remoteVersion)
  }
  else {
    isCheckingVersion = false
  }
}
