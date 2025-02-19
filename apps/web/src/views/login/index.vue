<script setup lang="tsx">
import type { CheckOtherDeviceLoginListParams, LoginCreateData, LoginCreatePayload } from '@roxy/backend-api'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import LanguageSelect from '/@/components/business/language-select/index.vue'
import { useDialog } from '/@/hooks/useDialog'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { EmailCodeInputOtp, ResetPassword, SignForm } from './components/'
import MigrationTips from './components/migration-tips.vue'
import { type CurrentComp, provideLoginContext } from './hooks/useLoginContext'
import BgCanvas from './components/bg-canvas.vue'
import { hidePageLoading } from '/@/utils'

const isSupportGPU = ref(false)
const { getUserInfo, setToken, setPassword, userInfo } = useUserStore()
const { rememberMe, password } = storeToRefs(useUserStore())
const router = useRouter()
const toast = useToast()
const commonHeaders = { ['R-DEVICE-ID']: '' }
const signFormData = ref<LoginCreatePayload>({
  user_name: userInfo.email || '',
  password: password.value ? atob(password.value) : '',
})

const currentComp = ref<CurrentComp>('signForm')
const currentCompProps = ref<Recordable>()
const [dialog] = useDialog()

hidePageLoading()

async function handleSubmit() {
  console.log(signFormData)
  signFormData.value.user_name = signFormData.value.user_name.trim()

  const isContinueLogin = await checkContinueLogin({ ...signFormData.value, login_type: 'login' })
  console.log('isContinueLogin', isContinueLogin)
  if (!isContinueLogin) {
    return
  }

  const { code, data, msg } = await API.base.loginCreate(signFormData.value, { headers: await getCommonHeaders() })

  if (code !== 0) {
    mixpanel.track('login', { method: 'password', success: false, error: msg })
    toast.add({ severity: 'error', summary: 'Error', detail: msg || $t('登录失败'), life: 2500 })
    return
  }
  if (data.workspaceId === 0) {
    dialog.showModal({
      slots: {
        container: ({ closeCallback }) => (
          <MigrationTips closeCallback={closeCallback} token={data.token} onFinish={() => afterLogin(data)} />
        ),
      },
    })
    return
  }

  await afterLogin(data)
}

async function afterLogin(loginData: LoginCreateData['data'], method: 'password' | 'google' | 'github' = 'password') {
  setToken(loginData.token)
  console.log('rememberMe', rememberMe.value)
  await getUserInfo()
  setPassword(rememberMe.value ? signFormData.value.password : '')
  router.push({ name: 'home' })
  mixpanel.track('login', { method })
}

/** 是否继续登录，true 为继续，false 停止 */
async function checkContinueLogin(params: CheckOtherDeviceLoginListParams) {
  const { promise, resolve } = Promise.withResolvers<boolean>()
  const { code, data, msg } = await API.base.checkOtherDeviceLoginList(params, { headers: await getCommonHeaders() })

  if (code !== 0) {
    toast.add({ severity: 'error', summary: 'Error', detail: msg || $t('登录失败'), life: 2500 })
    resolve(false)
    return promise
  }

  const has_other_login = data.has_other_login

  if (!has_other_login) {
    resolve(true)
  } else {
    dialog.showModal({
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

// TODO 这里后面就要去掉了
async function googleAuth2Login(googleToken: string) {
  const isContinueLogin = await checkContinueLogin({ googleToken, login_type: 'google' })

  if (!isContinueLogin) {
    return
  }


  const { code, data, msg = $t('登录失败') } = await API.base.loginGoogleV2Create({ googleToken }, { headers: await getCommonHeaders() })
  if (code === 0) {
    if (data.workspaceId === 0) {
      dialog.showModal({
        slots: {
          container: ({ closeCallback }) => (
            <MigrationTips closeCallback={closeCallback} token={data.token} onFinish={() => afterLogin(data)} />
          ),
        },
      })
      return
    }
    afterLogin(data, 'google')
  }
  else {
    mixpanel.track('login', { method: 'google', success: false, error: msg })
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 2500 })
    return Promise.reject(msg)
  }
}

function setCurrentComponent(comp: CurrentComp, compProps?: Recordable) {
  currentComp.value = comp
  currentCompProps.value = compProps
}

const cancelCallback = window.electronAPI.on('oauth2:google-callback', async (searchStr) => {
  console.log('oauth2:google-callback', searchStr)
  const oauthCode = new URLSearchParams(searchStr).get('code')
  const source = new URLSearchParams(searchStr).get('source')
  if (oauthCode) {
    if (source === 'google') {
      googleAuth2Login(oauthCode)
    }
    else if (source === 'github') {
      const isContinueLogin = await checkContinueLogin({ githubToken: oauthCode, login_type: 'github' })

      if (!isContinueLogin) {
        return
      }
      const { code, data, msg = $t('登录失败') } = await API.base.loginGithubCreate({ githubToken: oauthCode }, { headers: await getCommonHeaders() })
      if (code === 0) {
        afterLogin(data, 'github')
      } else {
        mixpanel.track('login', { method: 'github', success: false, error: msg })
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 2500 })
      }
    }
  }
  else {
    console.error('google oauth2 code is null')
  }
})

async function getCommonHeaders() {
  if (!commonHeaders['R-DEVICE-ID']) {
    console.time('获取设备 ID 耗时')
  }
  commonHeaders['R-DEVICE-ID'] ||= await electronAPI.send('util:getDeviceId').finally(() => {
    console.timeEnd('获取设备 ID 耗时')
  })
  return commonHeaders
}

electronAPI.send('app:getGPUFeatureStatus').then((res) => {
  isSupportGPU.value = res['2d_canvas'] === 'enabled' && res['webgl'] === 'enabled'
})

onMounted(() => {
  getCommonHeaders()
})

onUnmounted(() => {
  cancelCallback?.()
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
  <div class="login-container" :class="{ 'not-support-gpu': !isSupportGPU }">
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
      <SignForm v-if="currentComp === 'signForm'" v-model="signFormData" v-bind="currentCompProps" />
      <EmailCodeInputOtp v-else-if="currentComp === 'emailCodeInputOtp'" type="signUp" v-bind="currentCompProps" />
      <ResetPassword v-else-if="currentComp === 'resetPassword'" v-bind="currentCompProps" />
    </div>
    <div class="footer">
      <i18n-t :keypath="$t('注册或登录即表示您同意我们的 {terms} 和 {policy} 。', { terms: '{terms}', policy: '{policy}' })">
        <template #terms>
          <a href="https://roxybrowser.com/copyright/user" target="_blank">{{ $t('用户协议') }}</a>
        </template>
        <template #policy>
          <a href="https://roxybrowser.com/copyright/privacy" target="_blank">{{ $t('隐私政策') }}</a>
        </template>
      </i18n-t>
    </div>
    <BgCanvas v-if="isSupportGPU" />
  </div>
</template>

<style lang="scss" scoped>
.login-container {
  width: 100vw;
  height: 100vh;

  &.not-support-gpu {
    background-image: url('/login_bg_2x.jpg');
    background-position: center;
    background-size: 100% 100%;
  }
}

.logo {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: white;
  z-index: 10;

  .logo-text {
    color: white;
    font-family: Archivo;
    font-size: 18px;
    font-style: normal;
    line-height: 20px;
    font-weight: bold;
  }
}

.footer {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 20px;
  z-index: 10;
  color: var(--Colors-Text-text-action-primary, #FFF);
  text-align: center;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);

  a {
    color: rgba(255, 255, 255, 0.8);
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
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  padding: var(--spacing-4xl, 24px) 32px;
  display: flex;
  width: var(--width-xs, 384px);
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2xl, 16px);
  border-radius: 8px;
  border: 0.5px solid var(--Color-neutrals-0, #FFF);
  background: #FFF;
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
