import type { AxiosResponse } from 'axios'
import { checkAppVersion } from './checkAppVersion'
import { checkCoreVersion } from './checkCoreVersion'
import { checkNotify } from './checkNotify'
import { checkDictVersion } from './checkDictVersion'
import { checkSoftConfigVersion } from './checkSoftConfigVersion'
import { checkPermission } from './checkPermission'
import { checkPayInfoVersion } from './checkPayInfoVersion'

const ignoreUrl = [
  '/login',
  '/reg',
  '/send_email_register_verify_code',
  '/send_email_forget_verify_code',
  '/forget_password',
]

export function handleResponseHeaders(response: AxiosResponse) {
  if (ignoreUrl.includes(response.config.url || '')) {
    return
  }

  if (response.data?.code !== 0) {
    return
  }

  checkAppVersion(response)
  checkCoreVersion(response)
  checkNotify(response)
  checkDictVersion(response)
  checkSoftConfigVersion(response)
  checkPermission(response)
  checkPayInfoVersion(response)
}
