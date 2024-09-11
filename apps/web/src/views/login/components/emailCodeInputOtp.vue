<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { useLoginContext } from '../hooks/useLoginContext'
import { API } from '/@/api'

const emailCode = defineModel('emailCode', { default: '' })

const loginContext = useLoginContext()
const toast = useToast()

const loading = ref(false)

function toReEnter() {
  loginContext.setCurrentComponent('signForm')
}

async function handleSubmit() {
  if (emailCode.value.length !== 6) {
    return
  }
  loading.value = true
  const signFormData = loginContext.getSignFormData()
  const { code, msg } = await API.base.postBase({
    ...signFormData,
    // TODO: remove this hardcode
    user_name: 'bqytest5',
    email: signFormData.user_name,
    ver_code: emailCode.value,
  }).finally(() => {
    loading.value = false
  })
  if (code === 0) {
    await loginContext.toSignIn().finally(() => {
      loading.value = false
    })
  }
  else {
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
  }
}
</script>

<template>
  <div class="container">
    <div class="title">
      Check your email for a code
    </div>
    <div class="description">
      We've send a 6-character verification code to your email: <br>
      <span class="email-text">support@roxybrowser.com</span> <br><br>
      Please checkout your email and fill the code below to complete the sign up.
    </div>
    <InputOtp v-model="emailCode" class="inputotp" :length="6" />
    <ry-button class="w-full" :loading="loading" @click="handleSubmit">
      Complete sign up
    </ry-button>
    <div class="tips">
      <span>
        Can't find the email? Check your spam, or
      </span> <br>
      <a class="re-enter-text" @click="toReEnter">re-enter your email and try again.</a>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-4xl, 24px);
  align-self: stretch;

  .title {
    align-self: stretch;
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 700;
    line-height: var(--Line-Height-text-xs, 16px); /* 100% */
  }

  .description {
    align-self: stretch;
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-lg, 20px); /* 166.667% */
  }
}

.inputotp {
  gap: var(--spacing-md, 6px);
  :deep(.p-inputotp-input) {
    display: flex;
    width: 50px;
    height: 60px;
    flex-direction: column;
    justify-content: center;
    flex-shrink: 0;
    color: #000;
    text-align: center;
    font-family: 'JetBrains Mono';
    font-size: 24px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    text-transform: uppercase;
  }
}

.email-text {
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-lg, 20px); /* 166.667% */
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-lg, 20px);
}

.tips {
  align-self: stretch;
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px); /* 160% */
}

.re-enter-text {
  color: var(--Colors-Text-text-brand, #12a3fc);
  font-family: Inter;
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
  text-decoration-line: underline;
  cursor: pointer;
}
</style>
