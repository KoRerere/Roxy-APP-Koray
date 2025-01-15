import type { AxiosResponse } from 'axios'
import { checkAppVersion, } from './checkAppVersion'
import { checkCoreVersion, } from './checkCoreVersion'
import { checkNotify } from './checkNotify'
import { checkDictVersion } from './checkDictVersion'
import { checkSoftConfigVersion } from './checkSoftConfigVersion'

export function handleResponseHeaders(response: AxiosResponse) {
  checkAppVersion(response)
  checkCoreVersion(response)
  checkNotify(response)
  checkDictVersion(response)
  checkSoftConfigVersion(response)
}
