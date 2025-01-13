import type { AxiosResponse } from 'axios'
import { checkAppVersion, } from './checkAppVersion'
import { checkCoreVersion, } from './checkCoreVersion'
import { checkNotify } from './checkNotify'
import { checkDictVersion } from './checkDictVersion'

export function handleResponseHeaders(response: AxiosResponse) {
  checkAppVersion(response)
  checkCoreVersion(response)
  checkNotify(response)
  checkDictVersion(response)
}
