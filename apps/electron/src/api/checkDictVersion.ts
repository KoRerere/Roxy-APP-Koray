import type { AxiosResponse } from 'axios'
import { dictStore, getDictVersions } from '/@/modules/dict'

let isCheckingVersion = false

export async function checkDictVersion(response: AxiosResponse<any, any>) {
  const remoteVersion = response.headers['r-dict_version']

  if (!remoteVersion || isCheckingVersion) {
    return
  }

  isCheckingVersion = true

  if (remoteVersion > dictStore.latestVersion) {
    console.log('checkDictVersion', remoteVersion, dictStore.latestVersion)
    const result = await getDictVersions().finally(() => {
      isCheckingVersion = false
    })
    if (result.code === 0) {
      dictStore.latestVersion = remoteVersion
    }
  }
  else {
    isCheckingVersion = false
  }
}
