<script lang="ts" setup>
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert/'
import { RxForm } from '/@/components/rx-form'

import { useLoginContext } from '../hooks/useLoginContext'
import EmailCodeInputOtp from './emailCodeInputOtp.vue'
import Verify2fa from './verify-2fa.vue'
import { getEmailSchemas, getResetPasswordSchemas } from './schemas'
import SignCardHeader from './sign-card-header.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'

const { setCurrentComponent, setSignFormData, getSignFormData } = useLoginContext()
const toast = useToast()
const [showToast, onlyErrorToast] = useResponseToast()

const rxFormRef = useTemplateRef('rxForm')
const emailFormData = ref({
  user_name: getSignFormData().user_name,
})

const resetPasswordEventCommonParams = {
  reset_password_client: globalThis.isElectron ? 'PC_APP' : 'WEB',
}

const emailCode = ref('')
const resetPwdFormData = ref({ email: '', newPassword: '', confirmPassword: '' })
const currentStep = ref<'step1' | 'step2' | 'step3'>('step1')
const step2Type = ref<'email' | '2fa'>()
const isShowAlert = ref(false)

async function handleSubmit() {
  isShowAlert.value = false

  if (currentStep.value === 'step1') {
    const { code, data, msg } = await API.base.checkEmailOr2FaVerifyList({ email: emailFormData.value.user_name })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return

    step2Type.value = data.verify_type as 'email' | '2fa'

    if (step2Type.value === '2fa') {
      currentStep.value = 'step2'
    }
    else {
      sendEmailCode()
    }
  }
  else if (currentStep.value === 'step3') {
    const formData = await rxFormRef.value?.submit()
    const { code, msg } = await API.base.forgetPasswordCreate({
      email: emailFormData.value.user_name,
      new_pwd: formData?.newPassword,
      ver_code: emailCode.value,
    })
    if (code === 0) {
      mixpanel.track('resetPassword', { method: 'email', success: true, ...resetPasswordEventCommonParams })
      toast.add({ severity: 'success', summary: $t('密码重置成功'), life: 2500 })
      setSignFormData({ user_name: emailFormData.value.user_name, password: '' })
      setCurrentComponent('signForm')
    }
    else {
      mixpanel.track('resetPassword', { method: 'email', success: false, error: msg, ...resetPasswordEventCommonParams })
      toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 2500 })
    }
  }
}

async function sendEmailCode() {
  const { code, msg } = await API.base.sendEmailForgetVerifyCodeList({
    email: emailFormData.value.user_name,
  })

  if (code === 0) {
    toast.add({ severity: 'success', summary: $t('验证码已发送'), detail: $t('请检查您的邮箱。'), life: 2500 })
    currentStep.value = 'step2'
  }
  else {
    mixpanel.track('resetPassword', { method: 'email', success: false, error: msg, ...resetPasswordEventCommonParams })
    if (code === 102) {
      isShowAlert.value = true
    }
    else {
      isShowAlert.value = false
      showToast(code, msg)
    }
  }
}

function backToSignIn() {
  setCurrentComponent('signForm')
}

async function receive2faCode(ver_code: string) {
  const { code, msg } = await API.base.getCheckBindEmailVerCodeList({
    email: emailFormData.value.user_name,
    ver_code,
  })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return
  receiveEmailCode(ver_code)
}

function receiveEmailCode(code: string) {
  emailCode.value = code
  currentStep.value = 'step3'
}
</script>

<template>
  <template v-if="currentStep !== 'step2'">
    <div class="reset-password">
      <RxAlert v-model:visible="isShowAlert" type="error" :title="$t('该邮件尚未注册')" :content="$t('请检查您的邮箱并重试')" class="w-full" />
      <SignCardHeader :sub-title="$t('重置密码')" :description="currentStep === 'step1' ? $t('请输入您的邮箱，我们将向您发送验证码') : $t('请在下方设置您的新密码')" />
      <div class="box">
        <div class="flex flex-col gap-2 w-full">
          <template v-if="currentStep === 'step1'">
            <RxForm ref="rxForm" v-model="emailFormData" :schemas="getEmailSchemas()" :colon="false" :footer="false" layout="vertical" @keydown.enter="handleSubmit" />
          </template>
          <template v-else>
            <RxForm ref="rxForm" v-model="resetPwdFormData" :schemas="getResetPasswordSchemas()" :colon="false" :footer="false" layout="vertical" @keydown.enter="handleSubmit" />
          </template>
        </div>
      </div>
      <RxButton class="w-full" size="md" @click="handleSubmit">
        {{ currentStep === 'step1' ? $t('前往验证') : $t('确认') }}
      </RxButton>
      <RxButton class="w-full" severity="secondary" outlined size="md" @click="backToSignIn">
        {{ $t('返回登录') }}
      </RxButton>
    </div>
  </template>
  <template v-else>
    <EmailCodeInputOtp v-if="step2Type === 'email'" type="resetPassword" :email="emailFormData.user_name" @ok="receiveEmailCode" @back="currentStep = 'step1'" />
    <Verify2fa v-if="step2Type === '2fa'" recover-type="code" :recover="false" :on-confirm="receive2faCode" />
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
      color: var(--colors-text-text-primary, #fafafa);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;
    }

    .message-desc {
      color: var(--colors-text-text-secondary, #b2b6b8);
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
    display: flex;
    height: 20px;
    justify-content: space-between;
    align-items: center;
    align-self: stretch;
  }

  .description {
    color: var(--colors-text-text-tertiary, #575d60);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-lg, 20px);
    /* 166.667% */
  }

  .label {
    color: var(--colors-text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px);
    /* 166.667% */
  }
}
</style>
