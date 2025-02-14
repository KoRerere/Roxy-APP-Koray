<script setup lang="ts">
import { API } from '../api';
import { useResponseToast } from '../hooks/useResponseToast';

const { interval = 60, email } = defineProps<{
  /** 发送验证码间隔时间 */
  interval?: number,
  email: string,
}>()

const modelValue = defineModel<string>()

const [showToast, onlyErrorToast] = useResponseToast()

const countdown = ref(0)

async function handleSendCode() {
  countdown.value = interval

  const { code, msg } = await API.base.userSettingPasswordVerifyCodeList({ email })

  if (code !== 0) {
    countdown.value = 0
    return onlyErrorToast(-1, msg)
  }

  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
}
</script>

<template>
  <div class="w-full flex justify-between items-center gap-[12px]">
    <InputText v-model="modelValue" type="text" v-bind="$attrs" />
    <RxButton severity="secondary" outlined class="flex-shrink-0" :disabled="countdown > 0" @click="handleSendCode">
      {{ countdown > 0 ? $t('{time} 秒后可重新获取', { time: countdown }) : $t('发送验证码') }}
    </RxButton>
  </div>
</template>
