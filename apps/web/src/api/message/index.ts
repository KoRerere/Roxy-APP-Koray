import type { AxiosResponse } from 'axios'
import { checkAppVersion, } from './checkAppVersion'
import { checkCoreVersion, } from './checkCoreVersion'
import { checkNotify } from './checkNotify'
import { checkDictVersion } from './checkDictVersion'
import { checkSoftConfigVersion } from './checkSoftConfigVersion'
import { checkPermission } from './checkPermission'
import { checkPayInfoVersion } from './checkPayInfoVersion'

export function handleResponseHeaders(response: AxiosResponse) {
  checkAppVersion(response)
  checkCoreVersion(response)
  checkNotify(response)
  checkDictVersion(response)
  checkSoftConfigVersion(response)
  checkPermission(response)
  checkPayInfoVersion(response)
}
