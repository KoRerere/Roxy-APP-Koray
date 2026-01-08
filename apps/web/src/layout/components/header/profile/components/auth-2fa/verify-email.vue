<script setup lang="ts">
import { useUserStore } from '/@/stores/user'

defineProps<{
  request: (params: any) => Promise<any>
}>()

const { userInfo } = storeToRefs(useUserStore())
const modelValue = defineModel<string>()
const verifyDevice = computed(() => {
  return {
    label: userInfo.value.phone ? $t('手机号') : $t('邮箱'),
    value: userInfo.value.phone || userInfo.value.email,
  }
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <label for="verify">{{ verifyDevice.label }}</label>
      <InputText :value="verifyDevice.value" name="verify" class="w-full" disabled />
    </div>
    <div class="flex flex-col gap-1">
      <label for="verification-code">
        <span class="text-[#ff4d4f]">*</span>
        {{ $t('验证码') }}
      </label>
      <RxVerificationCodeSender v-model="modelValue" name="ver_code" :request="request" :placeholder="$t('请输入验证码')" />
    </div>
  </div>
</template>
