<script setup lang="tsx">
import type { CheckOtherDeviceLoginListParams, LoginCreateData, LoginCreatePayload } from '@roxy/backend-api'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import LanguageSelect from '/@/components/business/language-select/index.vue'
import { useDialog } from '/@/hooks/useDialog'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { decryptAESGCM, hidePageLoading, showPageLoading, useOauth2Callback, type OauthLoginType } from '/@/utils'
import { EmailCodeInputOtp, ResetPassword, SignForm, Verify2fa, RecoveryCode, RecoveryEmail } from './components/'
import MigrationTips from './components/migration-tips.vue'
import { type CurrentComp, provideLoginContext } from './hooks/useLoginContext'
import { useSimpleLocale } from '/@/stores/locale'
import { useThemeStore } from '/@/stores/theme'
import AppUpdater from './components/app-updater.vue'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { motion, AnimatePresence } from 'motion-v'
import RightIntro from './components/right-intro/index.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useResponseToast } from '/@/hooks/useResponseToast'

const themeStore = useThemeStore()
const signFormRef = useTemplateRef('signForm')
const isSupportGPU = ref(false)
const simpleLocaleStore = useSimpleLocale()
const { getOfficialWebsite, } = simpleLocaleStore
const { setToken, setPassword, initUserInfo, userInfo, setLoginWay } = useUserStore()
const { rememberMe, password } = storeToRefs(useUserStore())
const [_, onlyErrorToast] = useResponseToast()
const router = useRouter()
const toast = useToast()
const signFormData = ref<LoginCreatePayload>({
  user_name: userInfo.email || '',
  password: '',
})
const updateInfo = ref<ResourceUpdateMessage>()
const signFormSwitchRegister = ref(false)
const tempToken = ref()
const recoverType = ref()
const recoverEmail = ref()

const showUpdaterMessage = computed(() => {
  return currentComp.value === 'signForm' && updateInfo.value && updateInfo.value.percent === 100 && !signFormSwitchRegister.value
})

const currentComp = ref<CurrentComp>('signForm')
const currentCompProps = ref<Recordable>()
const [showModal] = useDialog()

async function decryptPassword() {
  if (password.value) {
    try {
      signFormData.value.password = atob(password.value)
    } catch (e) {
      try {
        signFormData.value.password = await decryptAESGCM(password.value)
      } catch (e) {
        console.error('decrypt password error', e)
      }
    }
  }
}

decryptPassword()

async function handleSubmit() {
  console.log(signFormData)
  signFormData.value.user_name = signFormData.value.user_name.trim()

  const isContinueLogin = await checkContinueLogin({ ...signFormData.value, login_type: 'login' })
  console.log('isContinueLogin', isContinueLogin)
  if (!isContinueLogin) {
    return
  }

  const { code, data, msg } = await API.base.loginCreate(signFormData.value)

  if (code !== 0) {
    if (code === 420) {
      to2faVerify(data)
      return
    }

    mixpanel.track('login', { method: 'password', success: false, error: msg })
    toast.add({ severity: 'error', summary: 'Error', detail: msg || $t('登录失败'), life: 2500 })
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
    mixpanel.track('login', { method: '2fa', success: false, error: msg })
    return
  }

  const { code: code2, data, msg: msg2 } = await API.base.get2FaLoginInfoList({ temp_token: tempToken.value, type: '2fa_code' })
  onlyErrorToast(code2, msg2)
  if (code2 !== 0) return
  afterLogin(data)
}

async function afterLogin(loginData: LoginCreateData['data'], method: 'password' | OauthLoginType = 'password') {
  setToken(loginData.token)
  console.log('rememberMe', rememberMe.value)
  await initUserInfo()
  showPageLoading()
  setPassword(rememberMe.value ? signFormData.value.password : '')
  setLoginWay(method)
  API.base.userSetUserConfigCreate({ language: simpleLocaleStore.currentLocale })
  await router.push({ name: 'home' })
  mixpanel.track('login', { method })
}

/** 是否继续登录，true 为继续，false 停止 */
async function checkContinueLogin(params: CheckOtherDeviceLoginListParams) {
  const { promise, resolve } = Promise.withResolvers<boolean>()
  const { code, data, msg } = await API.base.checkOtherDeviceLoginList(params)

  if (code !== 0) {
    toast.add({ severity: 'error', summary: 'Error', detail: msg || $t('登录失败'), life: 2500 })
    resolve(false)
    return promise
  }

  const has_other_login = data.has_other_login

  if (!has_other_login) {
    resolve(true)
  } else {
    showModal({
      header: $t('登录提醒'),
      style: {
        width: '420px',
      },
      okText: $t('继续登录'),
      slots: {
        default: () => <div>
          <div>{$t('您的账号已在另一台设备登录，继续登录将使其下线')}</div>
        </div>,
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

      const { code, data, msg = $t('登录失败') } = await api()

      if (code !== 0) {
        if (code === 420) {
          to2faVerify(data)
          return
        }

        mixpanel.track('login', { method: source, success: false, error: msg })
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 2500 })
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
      window.electronAPI.send('util:clearInstallerPath')// 清空安装时生成的邀请码，如果有的话
      afterLogin(data, source)
    }
    catch (e) {
      console.error('oauth2 error', e)
    } finally {
      signFormRef.value?.setSubmitLoading(false)
    }
  }
  else {
    console.error('google oauth2 code is null')
  }
})

electronAPI.send('app:getGPUFeatureStatus').then((res) => {
  isSupportGPU.value = res['2d_canvas'] === 'enabled' && res['webgl'] === 'enabled'
})

electronAPI.send('app:isShowLongTimeNotLoginTips').then((res) => {
  console.log('isShowLongTimeNotLoginTips', res)
  if (res) {
    setPassword('')
    signFormData.value.password = ''
    toast.add({ severity: 'info', summary: $t('您已长时间未登录，请重新登录'), life: 5000 })
    nextTick(() => {
      signFormRef.value?.clearValidateMessages()
    })
  }
})

// 如果app有更新
window.electronAPI.on('app:resource-update', (data) => {
  if (data.type === 'app') {
    updateInfo.value = data
  }
})

electronAPI.send('app:checkForUpdates')

requestIdleCallback(hidePageLoading)
let timer = setInterval(hidePageLoading, 3000)

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
})
</script>

<template>
  <div class="flex w-full h-100vh">
    <div class="w-47% h-full relative bg-[var(--colors-background-bg-page)] overflow-hidden">
      <div class="relative z-10 h-full">
        <div class="flex justify-between p-5">
          <div class="logo">
            <SvgIcon name="base/logo" size="36" />
            <div class="logo-text">
              RoxyBrowser
            </div>
          </div>
          <LanguageSelect />
        </div>

        <div class="sign-card">
          <SignForm ref="signForm" v-if="currentComp === 'signForm'" v-model="signFormData" v-bind="currentCompProps" @register="val => signFormSwitchRegister = val" />
          <EmailCodeInputOtp v-else-if="currentComp === 'emailCodeInputOtp'" type="signUp" v-bind="currentCompProps" />
          <ResetPassword v-else-if="currentComp === 'resetPassword'" v-bind="currentCompProps" />
          <Verify2fa v-else-if="currentComp === 'verify2fa'" :recover-type="recoverType" :onConfirm="handleSubmitBy2fa" />
          <RecoveryCode v-else-if="currentComp === 'recoveryCode'" :temp-token="tempToken" @success="afterLogin" />
          <RecoveryEmail v-else-if="currentComp === 'recoveryEmail'" :temp-token="tempToken" :recover-email="recoverEmail" @success="afterLogin" />
        </div>

        <div class="footer">
          <i18n-t :keypath="$t('注册或登录即表示您同意我们的 {terms} 和 {policy} 。', { terms: '{terms}', policy: '{policy}' })">
            <template #terms>
              <a :href="getOfficialWebsite('copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
            </template>
            <template #policy>
              <a :href="getOfficialWebsite('copyright/privacy')" target="_blank">{{ $t('隐私政策') }}</a>
            </template>
          </i18n-t>
        </div>

        <AnimatePresence>
          <motion.div v-show="showUpdaterMessage" :initial="{ opacity: 0, y: 20, x: '-50%' }" :animate="{ opacity: 1, y: 0, x: '-50%' }" :exit="{ opacity: 0, y: -20, x: '-50%' }"
            :transition="{ duration: 0.2 }" class="app-updater-motion">
            <AppUpdater :version="updateInfo?.version" :current-version="updateInfo?.currentVersion" />
          </motion.div>
        </AnimatePresence>
      </div>

      <RxSvgIcon name="login/blob1" class="opacity-40 text-[60vw] z-9 absolute -bottom-60% -left-60%" />
      <RxSvgIcon name="login/blob2" class="opacity-40 text-[60vw] z-9 absolute -bottom-60% -right-50%" />
    </div>
    <div class="w-53% h-full relative overflow-hidden right-panel">
      <RightIntro />
    </div>
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
  box-shadow: 0px 3px 8px 0px rgba(0, 0, 0, 0.07), 0px 2px 5px 0px rgba(0, 0, 0, 0.07), 0px 1px 1px 0px rgba(0, 0, 0, 0.07);
  cursor: pointer;
}

.logo {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: white;
  z-index: 10;

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
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 20px;
  z-index: 10;
  color: var(--colors-text-text-tertiary, #FFF);
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
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: var(--spacing-4xl, 24px);
  display: flex;
  max-width: var(--width-sm, 480px);
  min-width: var(--width-sm, 424px);
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

.right-panel {
  background: linear-gradient(180deg, #12A3FC 0%, #CDEBFE 100%);
}

[data-theme="dark"] {
  .right-panel {
    background: linear-gradient(180deg, #0A5D9D 0%, #5C8F9E 100%);
  }
}
</style>
