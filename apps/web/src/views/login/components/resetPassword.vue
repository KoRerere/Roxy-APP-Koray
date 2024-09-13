<script lang="ts" setup>
import { useToast } from 'primevue/usetoast'
import { useLoginContext } from '../hooks/useLoginContext'
import EmailCodeInputOtp from './emailCodeInputOtp.vue'
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert/'

const { setCurrentComponent } = useLoginContext()
const toast = useToast()

const email = ref('')
const emailCode = ref('')
const newPassword = ref('')
const reNewPassword = ref('')
const currentStep = ref<'step1' | 'step2' | 'step3'>('step1')
const isShowAlert = ref(false)

async function handleSubmit() {
  if (currentStep.value === 'step1') {
    const { code, msg } = await API.base.sendEmailForgetVerifyCodeList({
      email: email.value,
    })

    if (code === 0) {
      toast.add({ severity: 'success', summary: '邮件发送成功，请注意查收！', life: 5000 })
      currentStep.value = 'step2'
    }
    else {
      toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
    }
  }
  else if (currentStep.value === 'step3') {
    if (newPassword.value !== reNewPassword.value) {
      toast.add({ severity: 'error', summary: 'Error', detail: 'The two passwords are inconsistent', life: 5000 })
      return
    }
    if (newPassword.value.length < 6) {
      toast.add({ severity: 'error', summary: 'Error', detail: 'Password must be at least 6 characters', life: 5000 })
      return
    }

    const { code, msg } = await API.base.forgetPasswordCreate({
      email: email.value,
      new_pwd: newPassword.value,
      ver_code: emailCode.value,
    })
    if (code === 0) {
      toast.add({ severity: 'success', summary: 'Success', detail: 'Password reset successfully', life: 5000 })
      setCurrentComponent('signForm')
    }
    else {
      toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
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
        <RxAlert
          v-model:visible="isShowAlert"
          type="error"
          title="Your email haven’t been signed up."
          content="Please checkout your email and try again."
        />
        <div class="title">
          Reset your password
        </div>
        <div class="description">
          Enter your email address and we will send you a code for your reset process.
        </div>
        <div class="flex flex-col gap-2 w-full">
          <template v-if="currentStep === 'step1'">
            <label for="email" class="label">Email</label>
            <InputText id="email" v-model="email" placeholder="Email for your account" />
          </template>
          <template v-else>
            <label for="new-password" class="label">New password</label>
            <Password id="new-password" v-model="newPassword" :feedback="false" placeholder="Enter new password" />
            <label for="re-new-password" class="label">Re-enter new password</label>
            <Password id="re-new-password" v-model="reNewPassword" :feedback="false" placeholder="Re-enter new password" />
          </template>
        </div>
      </div>
      <ry-button class="w-full" @click="handleSubmit">
        {{ currentStep === 'step1' ? 'Next' : 'Confirm' }}
      </ry-button>
      <a class="text-sm text-blue-500 cursor-pointer" @click="backToSignIn">Back to sign in</a>
    </div>
  </template>
  <template v-else>
    <EmailCodeInputOtp type="resetPassword" @ok="receiveEmailCode" />
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
      line-height: 18px; /* 150% */
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
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 700;
    line-height: var(--Line-Height-text-xs, 16px); /* 100% */
  }

  .description {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-lg, 20px); /* 166.667% */
  }

  .label {
    color: var(--Component-Colors-TextInput-label-label, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px); /* 166.667% */
  }
}
</style>
