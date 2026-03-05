import type { LoginCreatePayload, LoginPhoneCreatePayload } from '@roxy/backend-api'

const injectKey = Symbol('loginContext')

export function provideLoginContext(context: LoginContext) {
  provide(injectKey, context)
}

export function useLoginContext() {
  return inject(injectKey) as LoginContext
}

export type CurrentComp = 'emailCodeInputOtp' | 'signForm' | 'resetPassword' | 'inviteIntoWorkspace' | 'verify2fa' | 'recoveryCode' | 'recoveryEmail'

export interface LoginContext {
  /** 登录 */
  toSignIn: () => Promise<void>
  /** 手机登录 */
  toSignInByPhone: () => Promise<void>
  /** 切换组件 */
  setCurrentComponent: (comp: CurrentComp, compProps?: Recordable) => void
  /** 保存当前表单的数据 */
  setSignFormData: (signFormData: LoginCreatePayload & LoginPhoneCreatePayload) => void
  /** 获取当前表单的数据 */
  getSignFormData: () => LoginCreatePayload
}
