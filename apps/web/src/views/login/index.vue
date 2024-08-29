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
    placeholder: '请选择语言',
    value: '',
  },
  {
    type: 'password',
    label: '密码',
    name: 'password',
    placeholder: '请输入密码',
    value: '',
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
</script>

<template>
  <div>
    <ry-form :inputs="inputs" label-position="left" />
    <ry-button @click="handleSubmit">
      登录
    </ry-button>
  </div>
</template>

<style scoped></style>
