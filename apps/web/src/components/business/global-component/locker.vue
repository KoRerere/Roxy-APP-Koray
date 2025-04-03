<template>
  <div>
    <RxInputText v-model="password" placeholder="请输入密码" class="w-90" />
    <RxButton class="w-20" @click="handleUnlock">解锁</RxButton>
    <RxButton class="w-20" @click="handleLogout">退出登录</RxButton>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { $t } from "/@/locales";

const userPassword = ref('')
const password = ref('')
const emit = defineEmits(['show', 'close'])
const toast = useToast()

// 触发解锁动作
const handleUnlock = () => {
  if (password.value === '123456') {
    emit('close')
  } else {
    toast.add({ severity: 'error', summary: '密码错误', detail: '请重新输入密码', life: 3000 });
  }
}

// 退出登录
const handleLogout = () => {
  emit('close')
  setTimeout(() => {
    window.location.href = '/login'
  }, 200)
}

// TODO: 发送请求获取用户设置的密码

</script>

<style scoped lang="scss">

</style>
