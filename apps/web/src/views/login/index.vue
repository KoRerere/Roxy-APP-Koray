<script setup lang="tsx">
import type { LoginCreateData, LoginCreatePayload } from '@roxy/backend-api'
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
import BlobBg from '/@/components/blob-bg.vue'

const { getWorkspaceList, setCurrentWorkspace } = useWorkspaceStore()
const { getUserInfo, setToken, setPassword, userInfo } = useUserStore()
const { rememberMe, password } = storeToRefs(useUserStore())
const router = useRouter()
const toast = useToast()
const signFormData = ref<LoginCreatePayload>({
  user_name: userInfo.email || '',
  password: password.value ? atob(password.value) : '',
})

const currentComp = ref<CurrentComp>('signForm')
const currentCompProps = ref<Recordable>()
const [dialog] = useDialog()

async function handleSubmit() {
  console.log(signFormData)
  signFormData.value.user_name = signFormData.value.user_name.trim()
  const { code, data, msg } = await API.base.loginCreate(signFormData.value)

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

async function afterLogin(loginData: LoginCreateData['data'], method: 'password' | 'google' = 'password') {
  setToken(loginData.token)
  console.log('rememberMe', rememberMe.value)
  await getUserInfo()
  setPassword(rememberMe.value ? signFormData.value.password : '')
  await getWorkspaceList()
  setCurrentWorkspace(loginData.workspaceId)
  router.push({ name: 'home' })
  mixpanel.track('login', { method })
}

async function googleAuth2Login(googleToken: string) {
  const { code, data, msg = $t('登录失败') } = await API.base.loginGoogleV2Create({ googleToken })
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

const cancelCallback = window.electronAPI.on('oauth2:google-callback', (searchStr) => {
  console.log('oauth2:google-callback', searchStr)
  const code = new URLSearchParams(searchStr).get('code')
  if (code) {
    googleAuth2Login(code)
  }
  else {
    console.error('google oauth2 code is null')
  }
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
  <div class="flex justify-end p-5">
    <LanguageSelect />
  </div>
  <div class="sign-card">
    <div class="sign-card-header">
      <div class="sign-card-content">
        <img src="/logo.svg" class="w-[64px] h-[64px]">
        <div class="logo-text">
          RoxyBrowser
        </div>
      </div>
    </div>
    <SignForm v-if="currentComp === 'signForm'" v-model="signFormData" v-bind="currentCompProps" />
    <EmailCodeInputOtp v-else-if="currentComp === 'emailCodeInputOtp'" type="signUp" v-bind="currentCompProps" />
    <ResetPassword v-else-if="currentComp === 'resetPassword'" v-bind="currentCompProps" />
  </div>
  <BlobBg />
</template>

<style lang="scss" scoped>
.sign-card {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  display: flex;
  width: 330px;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2xl, 16px);
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

  .logo-text {
    align-self: stretch;
    color: #000;
    font-family: Archivo;
    font-size: 24px;
    font-style: normal;
    font-weight: 700;
    line-height: 20px; /* 83.333% */
  }
}

</style>
