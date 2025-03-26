import type { AxiosResponse } from "axios"
import { useUserStore } from "/@/stores/user"

/** 上一次版本 */
let lastVersion = ''
let isCheckingVersion = false

export async function checkPayInfoVersion(response: AxiosResponse<any, any>) {
  const remoteVersion = response.headers['r_pay_info_version']

  if (!lastVersion) {
    lastVersion = remoteVersion
    return
  }

  if (isCheckingVersion) {
    return
  }

  if (remoteVersion > lastVersion) {
    console.log('checkPayInfoVersion', remoteVersion, lastVersion)

    isCheckingVersion = true
    lastVersion = remoteVersion

    useUserStore().getUserPayInfo().finally(() => {
      isCheckingVersion = false
    })
  }
}
