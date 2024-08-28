<script setup lang="ts">
import { API } from '/@/api'
import { getFormData } from '/@/utils'

const inputs = [
  {
    type: 'text',
    label: '用户名',
    name: 'user_name',
    placeholder: '请选择语言',
    value: null,
  },
  {
    type: 'password',
    label: '密码',
    name: 'password',
    placeholder: '请输入密码',
    value: null,
  },
]

async function handleSubmit() {
  const params = getFormData(inputs)
  console.log(params)
  const { data } = await API.base.loginCreate(params)
  console.log(data)
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
