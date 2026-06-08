import type { AxiosResponse } from 'axios'
import { useSimpleLocale } from '/@/stores/locale'
import { API } from '/@/api'
import { useCommonStore } from '/@/stores/common'

// r-annc_v en=xxx;zh=xxx;ru=xxx;...

/** 上一次版本 */
let lastVersion = 0
let isCheckingAppVersion = false

export async function checkAnncVersion(response: AxiosResponse<any, any>) {
  if (isCheckingAppVersion || typeof response.headers.r_annc_v !== 'string') {
    return
  }

  isCheckingAppVersion = true

  const simpleLocaleStore = useSimpleLocale()
  const { setAnntList } = useCommonStore()

  const remoteVersions = response.headers.r_annc_v.split(';').map((item: string) => item.split('='))
  const remoteVersion = Number(remoteVersions?.find(([locale]: string[]) => simpleLocaleStore.currentLocale.startsWith(locale))?.[1])

  if (!remoteVersion) {
    isCheckingAppVersion = false
    return
  }

  if (remoteVersion > lastVersion) {
    console.info('checkAnncVersion', remoteVersion, lastVersion)
    const result = await API.base.userGetAnntListList().finally(() => {
      isCheckingAppVersion = false
    })
    if (result.code === 0) {
      lastVersion = remoteVersion
      setAnntList(result.data?.rows || [])
    }
  }
  else {
    isCheckingAppVersion = false
  }
}
