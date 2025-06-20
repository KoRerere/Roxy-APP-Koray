<script setup lang="ts">
import { useUserStore } from '/@/stores/user'
import { API } from '/@/api'

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)

const verificationCodeSender = ref()

const sendCode = async () => {
  await API.base.userSendEmailCode({
    email: userInfo.value.email,
  })
}

</script>

<template>
  <div class="flex flex-col gap-12px">
    <div class="flex flex-col gap-4px">
      <label for="email">{{ $t('邮箱') }}</label>
      <InputText v-model="userInfo.email" name="email" class="w-full" disabled :placeholder="$t('请输入您的邮箱地址')" />
    </div>
    <div class="flex flex-col gap-4px">
      <label for="verification-code">
        <span class="text-[#ff4d4f]">*</span>
        {{ $t('验证码') }}
      </label>
      <div class="verification-input-group">
        <RxVerificationCodeSender ref="verificationCodeSender" name="ver_code" :request="sendCode"
          :placeholder="$t('请输入验证码')" />
      </div>
    </div>
  </div>
</template>