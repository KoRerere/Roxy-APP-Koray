<script setup lang="ts">
import { API } from '/@/api'
import { getFormData } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useToast } from 'primevue/usetoast'

const { setUserInfo, setToken } = useUserStore()
const router = useRouter()

const toast = useToast()

const loading = ref(false)

const inputs = [
  {
    type: 'text',
    label: '用户名',
    name: 'user_name',
    placeholder: '请选择用户名',
    value: null,
    labelWidth: '80px',
  },
  {
    type: 'password',
    label: '密码',
    name: 'password',
    placeholder: '请输入密码',
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
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 3000 })
    return
  }

  afterLogin(data.token)
}

async function afterLogin(token: string) {
  setToken(token)
  const { data } = await API.base.userGetUserInfoList()

  setUserInfo(data)
  console.log(data)
  toast.add({ severity: 'success', summary: 'Success', detail: '登录成功', life: 3000 })

  window.electronAPI.send('user:setUserInfo', { token, ...data })
  router.push({ name: 'home' })
}

function openGoogleAuth2Login() {
  const redirect_url = 'https://www.lumibrowser.com/zh_CN/oauth2_google.html'
  const url = `https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email&response_type=code&redirect_uri=${redirect_url}&client_id=663574245714-elgschngb873e831n3d7ul9b6s4a8cvq.apps.googleusercontent.com`
  window.open(url)
}

async function googleAuth2Login(googleToken: string) {
  const { code, data, msg = '登录失败' } = await API.base.loginGoogleCreate({ googleToken })
  if (code === 0) {
    afterLogin(data.token)
  }
  else {
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 3000 })
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
    <Button type="button" class="mt-[20px] w-full" label="Search" icon="pi pi-search" :loading="loading" @click="handleSubmit">
      Log In
    </Button>
    <Divider align="center">
      OR
    </Divider>
    <ry-button class="w-full" outlined :loading="loading" @click="openGoogleAuth2Login">
      Log in with Google
    </ry-button>
  </div>
</template>

<style scoped></style>
