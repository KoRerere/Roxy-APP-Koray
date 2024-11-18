import type { AxiosResponse } from 'axios'
import { API } from '/@/api'

let osConfig
/** 上一次版本 */
let lastAppVersion = ''
let isCheckingAppVersion = false

export async function checkAppVersion(response: AxiosResponse<any, any>) {
  const [[remoteVersion, isForceUpdate]] = Object.entries(response.data['R-APP_LAST_VERSION'] || {})

  if (!remoteVersion || isCheckingAppVersion) {
    return
  }

  isCheckingAppVersion = true

  lastAppVersion ||= await electronAPI.send('app:getAppVersion')
  osConfig ||= await electronAPI.send('const:osConfig')

  console.log('checkAppVersion', remoteVersion, lastAppVersion, isForceUpdate)
  if (lastAppVersion && remoteVersion !== lastAppVersion) {
    const result = await API.base.userGetAppUpgradeCreate(osConfig).finally(() => {
      isCheckingAppVersion = false
    })
    console.log('userGetAppUpgradeCreate result', result.data)
    if (result.code === 0 && result.data.version === remoteVersion) {
      lastAppVersion = remoteVersion
      await electronAPI.send('app:setAppUpdateData', result.data)
    }
  }
  else {
    isCheckingAppVersion = false
  }
}
