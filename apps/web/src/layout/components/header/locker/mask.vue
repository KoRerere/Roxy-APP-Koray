<template>
  <div>
    <div class="flex gap-2">
      <RxInputText v-model="password" placeholder="请输入密码" class="flex-1" />
      <RxButton class="step-plus" outlined severity="secondary">
        <template #icon>
          <SvgIcon name="base/rx_ic_arrow_right_2" size="12" />
        </template>
      </RxButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { $t } from "/@/locales";
import { useLock } from '/@/stores/lock'

const userPassword = ref('')
const password = ref('')
const emit = defineEmits(['show', 'close'])
const toast = useToast()

const { lockData, setLockData } = useLock()

// 触发解锁动作
const handleUnlock = () => {
  if (password.value === lockData.password) {
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
</script>

<style scoped lang="scss"></style>
