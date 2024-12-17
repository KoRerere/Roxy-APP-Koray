import type { AxiosResponse } from 'axios'
import { checkAppVersion, } from './checkAppVersion'
import { checkCoreVersion, } from './checkCoreVersion'
import { checkNotify } from './checkNotify'

export function handleResponseHeaders(response: AxiosResponse) {
  checkAppVersion(response)
  checkCoreVersion(response)
  checkNotify(response)
}
