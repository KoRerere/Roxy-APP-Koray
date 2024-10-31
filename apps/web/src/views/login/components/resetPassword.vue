<script lang="ts" setup>
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert/'
import { RxForm } from '/@/components/rx-form'
import { $t } from '/@/locales'
import { useLoginContext } from '../hooks/useLoginContext'
import EmailCodeInputOtp from './emailCodeInputOtp.vue'
import { getResetPasswordSchemas } from './schemas'

const { setCurrentComponent, setSignFormData } = useLoginContext()
const toast = useToast()

const rxFormRef = useTemplateRef('rxForm')
const email = ref('')
const emailCode = ref('')
const resetPwdFormData = ref({ email: '', newPassword: '', confirmPassword: '' })
const currentStep = ref<'step1' | 'step2' | 'step3'>('step1')
const isShowAlert = ref(false)

async function handleSubmit() {
  if (currentStep.value === 'step1') {
    const { code, msg } = await API.base.sendEmailForgetVerifyCodeList({
      email: email.value,
    })

    if (code === 0) {
      // toast.add({ severity: 'success', summary: $t('#Verification code sent!'), detail: $t('#Please checkout your email.'), life: 2500 })
      currentStep.value = 'step2'
    }
    else {
      mixpanel.track('resetPassword', { method: 'email', success: false, error: msg })
      toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 2500 })
    }
  }
  else if (currentStep.value === 'step3') {
    const formData = await rxFormRef.value?.submit()
    const { code, msg } = await API.base.forgetPasswordCreate({
      email: email.value,
      new_pwd: formData?.newPassword,
      ver_code: emailCode.value,
    })
    if (code === 0) {
      mixpanel.track('resetPassword', { method: 'email', success: true })
      toast.add({ severity: 'success', summary: 'Success', detail: $t('密码重置成功'), life: 2500 })
      setSignFormData({ user_name: email.value, password: '' })
      setCurrentComponent('signForm')
    }
    else {
      mixpanel.track('resetPassword', { method: 'email', success: false, error: msg })
      toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 2500 })
    }
  }
}

function backToSignIn() {
  console.log('backToSignIn')
  setCurrentComponent('signForm')
}

function receiveEmailCode(code: string) {
  console.log('receiveEmailCode', code)
  emailCode.value = code
  currentStep.value = 'step3'
}
</script>

<template>
  <template v-if="currentStep !== 'step2'">
    <div class="reset-password">
      <div class="box">
        <RxAlert v-model:visible="isShowAlert" type="error" :title="$t('该邮件尚未注册')" :content="$t('请检查您的邮箱并重试')" />
        <div class="title">
          {{ $t('重置密码') }}
        </div>
        <div class="flex flex-col gap-2 w-full">
          <template v-if="currentStep === 'step1'">
            <InputText id="email" v-model="email" :placeholder="$t('请输入您的邮箱')" />
          </template>
          <template v-else>
            <RxForm ref="rxForm" v-model="resetPwdFormData" :schemas="getResetPasswordSchemas()" :colon="false" :footer="false" layout="vertical" @keydown.enter="handleSubmit" />
          </template>
        </div>
      </div>
      <RxButton class="w-full" @click="handleSubmit">
        {{ currentStep === 'step1' ? $t('前往验证') : $t('确认') }}
      </RxButton>
      <a class="text-sm text-blue-500 cursor-pointer" @click="backToSignIn">{{ $t('返回登录') }}</a>
    </div>
  </template>
  <template v-else>
    <EmailCodeInputOtp type="resetPassword" :email @ok="receiveEmailCode" />
  </template>
</template>

<style lang="scss" scoped>
.message {
  :deep(.p-message-content) {
    align-items: flex-start;
  }

  .message-body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    align-self: stretch;

    .message-title {
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;
    }

    .message-desc {
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: 18px;
      /* 150% */
    }
  }
}

.reset-password {
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-2xl, 16px);
  align-self: stretch;

  :deep(.p-inputtext) {
    width: 100%;
  }
}

.box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;

  .title {
    width: 100%;
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 700;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 100% */
  }

  .description {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-lg, 20px);
    /* 166.667% */
  }

  .label {
    color: var(--Component-Colors-TextInput-label-label, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px);
    /* 166.667% */
  }
}
</style>
