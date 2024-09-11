<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { getFormData } from '/@/utils'

const { setUserInfo, setToken } = useUserStore()
const router = useRouter()

const toast = useToast()

const loading = ref(false)

const inputs = [
  {
    type: 'text',
    label: 'Email',
    name: 'user_name',
    placeholder: 'Email address',
    value: null,
    labelWidth: '80px',
  },
  {
    type: 'password',
    label: 'Password',
    name: 'password',
    placeholder: 'Login password',
    value: null,
    labelWidth: '80px',
  },
]

async function handleSubmit() {
  loading.value = true
  const params = getFormData(inputs)
  console.log(params)
  const { code, data, msg = '登录失败' } = await API.base.loginCreate(params).finally(() => {
    loading.value = false
  })

  if (code !== 0) {
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
    return
  }

  afterLogin(data.token)
}

async function afterLogin(token: string) {
  setToken(token)
  const { data } = await API.base.userGetUserInfoList()

  setUserInfo(data)
  console.log(data)
  toast.add({ severity: 'success', summary: 'Success', detail: '登录成功', life: 5000 })

  window.electronAPI.send('user:setUserInfo', { token, ...data })
  router.push({ name: 'home' })
}

function openGoogleAuth2Login() {
  const redirect_url = 'https://www.lumibrowser.com/zh_CN/oauth2_google.html'
  const url = `https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email&response_type=code&redirect_uri=${redirect_url}&client_id=663574245714-elgschngb873e831n3d7ul9b6s4a8cvq.apps.googleusercontent.com`
  window.open(url)
}

async function googleAuth2Login(googleToken: string) {
  const { code, data, msg = '登录失败' } = await API.base.loginGoogleV2Create({ googleToken })
  if (code === 0) {
    afterLogin(data.token)
  }
  else {
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
    return Promise.reject(msg)
  }
}

window.electronAPI.on('oauth2:google-callback', (searchStr) => {
  console.log('oauth2:google-callback', searchStr)
  const code = new URLSearchParams(searchStr).get('code')
  googleAuth2Login(code)
})
</script>

<template>
  <div class="w-[300px] mx-[auto]">
    <ry-form :inputs="inputs" />
    <div class="login-ways">
      <Button type="button" class="mt-[20px] w-full" label="Search" icon="pi pi-search" :loading="loading"
              @click="handleSubmit"
      >
        Log In
      </Button>
      <Divider align="center" class="!m-0">
        OR
      </Divider>
      <ry-button class="w-full" outlined :loading="loading" @click="openGoogleAuth2Login">
        <img src="/google.svg"> Log in with Google
      </ry-button>
      <div class="signup-tips">
        Didn’t have an account? <RouterLink :to="{ name: 'signup' }">
          Sign up
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login-ways {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2xl, 16px);
  align-self: stretch;
}

.signup-tips {
  color: #000;
  text-align: center;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}
</style>
