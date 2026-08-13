import type { AxiosResponse } from 'axios'
import { checkAppVersion } from './checkAppVersion'
import { checkChromeCoreVersion } from './checkChromeCoreVersion'
import { checkFirefoxCoreVersion } from './checkFirefoxCoreVersion'
import { checkNotify } from './checkNotify'
import { checkMessageTips } from './checkMessageTips'
import { checkDictVersion } from './checkDictVersion'
import { checkSoftConfigVersion } from './checkSoftConfigVersion'
import { checkIdentity } from './checkIdentity'
import { checkPermission } from './checkPermission'
import { checkPayInfoVersion } from './checkPayInfoVersion'
import { checkAnncVersion } from './checkAnncVersion'
import { useUserStore } from '/@/stores/user'

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

  const userStore = useUserStore()

  checkAppVersion(response)
  checkChromeCoreVersion(response)
  checkFirefoxCoreVersion(response)
  checkDictVersion(response)
  checkSoftConfigVersion(response)

  // 只有在用户已登录的情况下才检查身份和权限等信息
  if (userStore.token) {
    checkNotify(response)
    checkMessageTips(response)
    checkIdentity(response)
    checkAnncVersion(response)
    checkPayInfoVersion(response)
    checkPermission(response)
  }
}
