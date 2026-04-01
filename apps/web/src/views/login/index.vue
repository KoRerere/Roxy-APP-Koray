<script setup lang="tsx">
import IntoWorkspace from '/@/components/business/global-component/invite-into-workspace.vue'
import type { CheckOtherDeviceLoginListParams, LoginCreateData, LoginCreatePayload, LoginPhoneCreatePayload } from '@roxy/backend-api'
import { API } from '/@/api'
import LanguageSelect from '/@/components/business/language-select/index.vue'
import { useDialog } from '/@/hooks/useDialog'

import { useUserStore } from '/@/stores/user'
import { decryptAESGCM, hidePageLoading, showPageLoading, useOauth2Callback } from '/@/utils'
import type { OauthLoginType } from '/@/utils'
import { EmailCodeInputOtp, RecoveryCode, RecoveryEmail, ResetPassword, SignForm, Verify2fa } from './components/'
import MigrationTips from './components/migration-tips.vue'
import { provideLoginContext } from './hooks/useLoginContext'
import type { CurrentComp } from './hooks/useLoginContext'
import { useSimpleLocale } from '/@/stores/locale'
import AppUpdater from './components/app-updater.vue'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { AnimatePresence, motion } from 'motion-v'
import RightIntro from './components/right-intro/index.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { Role, WorkspaceType } from '/@/enums'
import { getInviteCode } from '/@/api/util'
import { useWindowSize } from '@vueuse/core'

const loginEventCommonParams = {
  login_client: globalThis.isElectron ? 'PC_APP' : 'WEB',
}

const signFormRef = useTemplateRef('signForm')
const { width: windowWidth } = useWindowSize()
const isSupportGPU = ref(false)
const simpleLocaleStore = useSimpleLocale()
const { getOfficialWebsite } = simpleLocaleStore
const { setToken, setPassword, initUserInfo, setLoginWay } = useUserStore()

const { rememberMe, password, userInfo } = storeToRefs(useUserStore())
const [showToast, onlyErrorToast] = useResponseToast()
const [showModal] = useDialog()
const router = useRouter()
const signFormData = ref<LoginCreatePayload & LoginPhoneCreatePayload>({
  user_name: userInfo.value.email || '',
  password: '',
  phone: '',
  verCode: '',
})
const updateInfo = ref<ResourceUpdateMessage>()
const signFormSwitchRegister = ref(false)
const tempToken = ref()
const recoverType = ref()
const recoverEmail = ref()
const loginWay = ref<'password' | 'phone' | OauthLoginType>('password')
const inviteDiscountInfo = ref()

const currentComp = ref<CurrentComp>('signForm')
const currentCompProps = ref<Recordable>()

const showUpdaterMessage = computed(() => {
  return currentComp.value === 'signForm' && updateInfo.value && updateInfo.value.percent === 100 && !signFormSwitchRegister.value
})

async function decryptPassword() {
  if (password.value) {
    try {
      signFormData.value.password = atob(password.value)
    }
    catch (e) {
      try {
        signFormData.value.password = await decryptAESGCM(password.value)
      }
      catch (e) {
        console.error('decrypt password error', e)
      }
    }
  }
}

async function getInviteDiscount() {
  const inviteCode = await getInviteCode()
  if (!inviteCode)
    return

  const { code, data } = await API.base.getPromotionLinkDiscountAndUsernameList({})
  if (code !== 0) {
    return
  }
  inviteDiscountInfo.value = data
}

decryptPassword()
getInviteDiscount()

async function handleSubmit() {
  const { user_name, password } = signFormData.value

  const params = {
    user_name: user_name.trim(),
    password: password.trim(),
  }

  const isContinueLogin = await checkContinueLogin({ ...params, login_type: 'login' })
  if (!isContinueLogin) {
    return
  }

  loginWay.value = 'password'
  const { code, data, msg } = await API.base.loginCreate(params)

  if (code !== 0) {
    if (code === 420) {
      to2faVerify(data)
      return
    }

    mixpanel.track('login', { method: 'password', success: false, error: msg, ...loginEventCommonParams })
    onlyErrorToast(code, msg || $t('登录失败'))
    return
  }
  if (data.workspaceId === 0) {
    showModal({
      slots: {
        container: ({ hideModal }) => (
          <MigrationTips closeCallback={hideModal} token={data.token} onFinish={() => afterLogin(data)} />
        ),
      },
    })
    return
  }

  await afterLogin(data)
}

async function handleSubmitByPhone() {
  const { phone, verCode } = signFormData.value

  const params = {
    phone: phone.trim(),
    verCode: verCode.trim(),
  }

  const isContinueLogin = await checkContinueLogin({ ...params, login_type: 'login' })
  if (!isContinueLogin) {
    return
  }

  loginWay.value = 'phone'
  const { code, data, msg } = await API.base.loginPhoneCreate(params)

  if (code !== 0) {
    if (code === 420) {
      to2faVerify(data)
      return
    }

    mixpanel.track('login', { method: 'password', success: false, error: msg, ...loginEventCommonParams })
    onlyErrorToast(code, msg || $t('登录失败'))
    return
  }
  if (data.workspaceId === 0) {
    showModal({
      slots: {
        container: ({ hideModal }) => (
          <MigrationTips closeCallback={hideModal} token={data.token} onFinish={() => afterLogin(data)} />
        ),
      },
    })
    return
  }

  await afterLogin(data)
}

function to2faVerify(data: any) {
  tempToken.value = data.token
  recoverType.value = data.recover_type!
  recoverEmail.value = data.recover_email!
  setCurrentComponent('verify2fa')
}

async function handleSubmitBy2fa(faCode: string) {
  const { code, msg } = await API.base.getPersonalVerifyValidatorCodeList({ temp_token: tempToken.value, code: faCode, type: 'login_2fa' })
  onlyErrorToast(code, msg)
  if (code !== 0) {
    mixpanel.track('login', { method: '2fa', success: false, error: msg, ...loginEventCommonParams })
    return
  }

  const { code: code2, data, msg: msg2 } = await API.base.get2FaLoginInfoList({ temp_token: tempToken.value, type: '2fa_code' })
  onlyErrorToast(code2, msg2)
  if (code2 !== 0)
    return
  afterLogin(data)
}

async function afterLogin(loginData: LoginCreateData['data']) {
  setToken(loginData.token)
  console.log('rememberMe', rememberMe.value)

  const searchParams = new URLSearchParams(window.location.search)
  const officialSiteRedirect = searchParams.get('official-site-redirect')
  if (officialSiteRedirect) {
    window.location.replace(officialSiteRedirect)
    return
  }

  await checkWorkspaceInvitation()
}

async function checkWorkspaceInvitation() {
  const { code, data } = await API.base.userGetInviteNotifyList()
  if (code !== 0 || !data)
    return jumpHome()

  setCurrentComponent('inviteIntoWorkspace', {
    inviteInfo: data.paramData,
    onClose: async (intoWorkspaceId: number) => {
      if (intoWorkspaceId) {
        API.base.userReadNotifyCreate({ ids: [data.id] })
      }
      await jumpHome(intoWorkspaceId)
    },
  })
}

async function jumpHome(intoWorkspaceId?: number) {
  await initUserInfo(intoWorkspaceId)
  setPassword(rememberMe.value ? signFormData.value.password : '')
  setLoginWay(loginWay.value)
  API.base.userSetUserConfigCreate({ language: simpleLocaleStore.currentLocale })

  const name = userInfo.value.workspaceType === WorkspaceType.Public && userInfo.value.role !== Role.OWNER ? 'shared' : 'home'
  await router.push({ name })

  mixpanel.track('login', { method: loginWay.value, ...loginEventCommonParams })
}

/** 是否继续登录，true 为继续，false 停止 */
async function checkContinueLogin(params: CheckOtherDeviceLoginListParams) {
  const { promise, resolve } = Promise.withResolvers<boolean>()
  const { code, data, msg } = await API.base.checkOtherDeviceLoginList(params)

  if (code !== 0) {
    onlyErrorToast(code, msg || $t('登录失败'))
    resolve(false)
    return promise
  }

  const has_other_login = data.has_other_login

  if (!has_other_login) {
    resolve(true)
  }
  else {
    showModal({
      header: $t('登录提醒'),
      style: {
        width: '420px',
      },
      okText: $t('继续登录'),
      slots: {
        default: () => (
          <div>
            <div>{$t('您的账号已在另一台设备登录，继续登录将使其下线')}</div>
          </div>
        ),
      },
      handleOk() {
        resolve(true)
      },
      handleCancel() {
        resolve(false)
      },
    })
  }

  return promise
}

function setCurrentComponent(comp: CurrentComp, compProps?: Recordable) {
  currentComp.value = comp
  currentCompProps.value = compProps
}

useOauth2Callback(async (params) => {
  const { oauthCode, source, api } = params
  if (oauthCode) {
    try {
      signFormRef.value?.setSubmitLoading(true)
      const isContinueLogin = await checkContinueLogin({ login_token: oauthCode })

      if (!isContinueLogin) {
        return
      }

      loginWay.value = source
      const { code, data, msg = $t('登录失败') } = await api()

      if (code !== 0) {
        if (code === 420) {
          to2faVerify(data)
          return
        }

        mixpanel.track('login', {
          method: source,
          success: false,
          error: msg,
          ...loginEventCommonParams,
        })
        onlyErrorToast(code, msg)
        return
      }

      if (source === 'google' && data.workspaceId === 0) {
        showModal({
          slots: {
            container: ({ hideModal }) => (
              <MigrationTips closeCallback={hideModal} token={data.token} onFinish={() => afterLogin(data)} />
            ),
          },
        })
        return
      }
      globalThis.electronAPI.send('util:clearInstallerPath')// 清空安装时生成的邀请码，如果有的话
      afterLogin(data)
    }
    catch (e) {
      console.error('oauth2 error', e)
    }
    finally {
      signFormRef.value?.setSubmitLoading(false)
    }
  }
  else {
    console.error('google oauth2 code is null')
  }
})

globalThis.electronAPI.send('app:getGPUFeatureStatus').then((res) => {
  isSupportGPU.value = globalThis.isElectron ? res?.['2d_canvas'] === 'enabled' && res.webgl === 'enabled' : true
})

globalThis.electronAPI.send('app:isShowLongTimeNotLoginTips').then((res) => {
  console.log('isShowLongTimeNotLoginTips', res)
  if (res) {
    setPassword('')
    signFormData.value.password = ''
    showToast(0, '', { severity: 'info', summary: $t('您已长时间未登录，请重新登录'), life: 5000 })
    nextTick(() => {
      signFormRef.value?.clearValidateMessages()
    })
  }
})

// 如果app有更新
globalThis.electronAPI.on('app:resource-update', (data) => {
  if (data.type === 'app') {
    updateInfo.value = data
  }
})

globalThis.electronAPI.send('app:checkForUpdates')

requestIdleCallback(hidePageLoading)
const timer = setInterval(hidePageLoading, 3000)

onBeforeUnmount(() => {
  clearInterval(timer)
})

provideLoginContext({
  setCurrentComponent,
  setSignFormData(data) {
    signFormData.value = data
  },
  getSignFormData() {
    return signFormData.value
  },
  toSignIn: handleSubmit,
  toSignInByPhone: handleSubmitByPhone,
})
</script>

<template>
  <div class="flex w-full h-100vh">
    <div class="lg:w-47% w-full h-full relative bg-[var(--colors-background-bg-page)]">
      <div class="relative z-10 h-full flex-col flex-bc">
        <div class="w-full flex justify-between sm:p-5 p-3">
          <div class="logo">
            <SvgIcon name="base/logo" size="36" />
            <div class="logo-text">
              RoxyBrowser
            </div>
          </div>
          <LanguageSelect />
        </div>

        <div class="sign-card">
          <SignForm v-if="currentComp === 'signForm'" ref="signForm" v-model="signFormData" v-bind="currentCompProps" :invite-discount-info="inviteDiscountInfo"
                    @register="val => signFormSwitchRegister = val"
          />
          <EmailCodeInputOtp v-else-if="currentComp === 'emailCodeInputOtp'" type="signUp" v-bind="currentCompProps" />
          <ResetPassword v-else-if="currentComp === 'resetPassword'" v-bind="currentCompProps" />
          <Verify2fa v-else-if="currentComp === 'verify2fa'" :recover-type="recoverType" :on-confirm="handleSubmitBy2fa" />
          <RecoveryCode v-else-if="currentComp === 'recoveryCode'" :temp-token="tempToken" @success="afterLogin" />
          <RecoveryEmail v-else-if="currentComp === 'recoveryEmail'" :temp-token="tempToken" :recover-email="recoverEmail" @success="afterLogin" />
          <IntoWorkspace v-else-if="currentComp === 'inviteIntoWorkspace'" v-bind="currentCompProps" />
        </div>

        <div class="footer">
          <i18n-t :keypath="$t('注册或登录即表示您同意我们的 {terms} 和 {policy} 。', { terms: '{terms}', policy: '{policy}' })">
            <template #terms>
              <a :href="getOfficialWebsite('/copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
            </template>
            <template #policy>
              <a :href="getOfficialWebsite('/copyright/privacy')" target="_blank">{{ $t('隐私政策') }}</a>
            </template>
          </i18n-t>
        </div>

        <AnimatePresence>
          <motion.div v-show="showUpdaterMessage" :initial="{ opacity: 0, y: 20, x: '-50%' }" :animate="{ opacity: 1, y: 0, x: '-50%' }" :exit="{ opacity: 0, y: -20, x: '-50%' }"
                      :transition="{ duration: 0.2 }" class="app-updater-motion"
          >
            <AppUpdater :version="updateInfo?.version" :current-version="updateInfo?.currentVersion" />
          </motion.div>
        </AnimatePresence>
      </div>

      <RxSvgIcon name="login/blob1" class="opacity-40 text-[60vw] z-9 absolute -bottom-60% -left-60%" />
      <RxSvgIcon name="login/blob2" class="opacity-40 text-[60vw] z-9 absolute -bottom-60% -right-50%" />
    </div>
    <RightIntro v-if="windowWidth > 1024" />
  </div>
</template>

<style lang="scss" scoped>
.app-updater-motion {
  position: absolute;
  top: 64px;
  left: 50%;
  width: 360px;
  padding: 12px;
  gap: 8px;
  border-radius: 4px;
  border: 0.5px solid var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);
  cursor: pointer;
}

.logo {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: white;
  z-index: 10;

  @media (max-width: 768px) {
    gap: 6px;
  }

  .logo-text {
    color: var(--colors-text-text-primary);
    font-family: Archivo;
    font-size: 18px;
    font-style: normal;
    line-height: 20px;
    font-weight: bold;
  }
}

.footer {
  margin-bottom: 20px;
  color: var(--colors-text-text-tertiary, #fff);
  text-align: center;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);

  a {
    color: var(--colors-text-text-link);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}

.sign-card {
  width: 100%;
  padding: var(--spacing-4xl, 24px);
  display: flex;
  max-width: var(--width-sm, 480px);
  flex-direction: column;
  gap: 16px;
  align-items: center;
  // border-radius: 8px;
  // background: var(--colors-background-bg-overlay);
}

.sign-card-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 11px;
  align-self: stretch;

  .sign-card-content {
    display: flex;
    width: 155px;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
}
</style>
