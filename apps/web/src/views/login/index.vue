<script setup lang="ts">
import { API } from '/@/api'
import { getFormData } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useToast } from 'primevue/usetoast'

const { setUserInfo } = useUserStore()
const router = useRouter()

const toast = useToast()

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
  const params = getFormData(inputs)
  console.log(params)
  const { data } = await API.base.loginCreate(params)
  setUserInfo(data)

  const { data: userInfo } = await API.base.userGetUserInfoList()
  userInfo.token = data.token
  setUserInfo(data)
  console.log(data)
  toast.add({ severity: 'success', summary: 'Success', detail: '登录成功', life: 3000 })

  window.electronAPI.send('user:setUserInfo', userInfo)
  router.push({ name: 'home' })
}

function googleLogin() {
  const redirect_url = 'https://www.lumibrowser.com/zh_CN/oauth2_google.html'
  const url = `https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email&response_type=code&redirect_uri=${redirect_url}&client_id=663574245714-elgschngb873e831n3d7ul9b6s4a8cvq.apps.googleusercontent.com`
  window.open(url)
}
</script>

<template>
  <div class="w-[300px] mx-[auto]">
    <ry-form :inputs="inputs" />
    <ry-button class="w-full mt-[12px]" @click="handleSubmit">
      Log In
    </ry-button>
    <Divider align="center">
      OR
    </Divider>
    <ry-button class="w-full" outlined @click="googleLogin">
      Log in with Google
    </ry-button>
  </div>
</template>

<style scoped></style>
