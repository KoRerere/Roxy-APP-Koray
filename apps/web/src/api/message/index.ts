import type { AxiosResponse } from 'axios'
import { checkAppVersion, } from './checkAppVersion'
import { checkCoreVersion, } from './checkCoreVersion'
import { checkAnnt } from './checkAnnt'

export function handleResponseHeaders(response: AxiosResponse) {
  checkAppVersion(response)
  checkCoreVersion(response)
  checkAnnt(response)
}
