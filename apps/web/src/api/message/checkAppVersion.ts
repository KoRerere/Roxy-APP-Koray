import type { UserGetAppUpgradeCreateData } from "@roxy/backend-api"
import type { AxiosResponse } from "axios"

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
