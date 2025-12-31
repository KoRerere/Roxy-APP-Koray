<script setup lang="ts">
import PhoneInput from '/@/views/login/components/phone-login/phone.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { zodResolver } from '@primevue/forms/resolvers/zod'
import { Form } from '@primevue/forms'
import type { FormInstance } from '@primevue/forms'
import { z } from 'zod'

import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { useResponseToast } from '/@/hooks/useResponseToast'

const { onSuccess } = defineProps<{
  onSuccess: () => void
}>()

const [showToast, onlyErrorToast] = useResponseToast()
const { userInfo } = storeToRefs(useUserStore())
const formInstance = useTemplateRef<FormInstance>('form')
const verificationCodeSenderRef = useTemplateRef('verificationCodeSender')

const steps = [
  { label: $t('验证当前手机号'), value: 'current' },
  { label: $t('设置新手机号'), value: 'new' },
] as const

const currentStep = ref<typeof steps[number]['value']>(userInfo.value?.phone ? 'current' : 'new')

const initialValues = ref({
  phone: '',
  verCode: '',
})

const submitLoading = ref(false)

const resolver = zodResolver(
  z.object({
    phone: z.string().min(1, $t('请输入您的手机号')).max(11, $t('请输入正确的手机号')),
    verCode: z.string().min(1, $t('请输入您的验证码')).max(6, $t('验证码不超过 {num} 位', { num: 6 })),
  }),
)

onMounted(() => {
  formInstance.value?.setFieldValue('phone', userInfo.value?.phone)
})

async function sendCode() {
  const phone = formInstance.value?.getFieldState('phone')?.value
  const isCurrent = currentStep.value === 'current'

  if (!isCurrent && !phone)
    return { code: -1, msg: $t('请输入您的手机号') }

  const { code, msg } = await API.base.sendPhoneVerCodeCreate({
    source: isCurrent ? 'old' : 'new',
    phone: isCurrent ? undefined : phone,
  })
  showToast(code, msg)

  return { code, msg }
}

async function verifyCurrentPhone() {
  const verCode = formInstance.value?.getFieldState('verCode')?.value

  if (!verCode?.trim()) {
    throw onlyErrorToast(-1, $t('请输入您的验证码'))
  }

  const { code, msg } = await API.base.userGetCheckPhoneVerCodeCreate({ verCode })

  showToast(code, msg)
  if (code !== 0) {
    throw new Error(msg)
  }
}

async function onFormSubmit({ valid }: any) {
  if (!valid) {
    return
  }
  submitLoading.value = true
  try {
    if (currentStep.value === 'current') {
      await verifyCurrentPhone()
      currentStep.value = steps[1].value
      formInstance.value?.reset()
      verificationCodeSenderRef.value?.clearInterval()
    }
    else if (currentStep.value === 'new') {
      const { code, msg } = await API.base.userBindPhoneCreate({
        phone: formInstance.value?.getFieldState('phone')?.value,
        verCode: formInstance.value?.getFieldState('verCode')?.value,
      })
      onlyErrorToast(code, msg)
      if (code === 0) {
        onSuccess()
      }
    }
  }
  finally {
    submitLoading.value = false
  }
}
</script>

<template>
  <div class="email-change-dialog">
    <div v-if="userInfo?.phone" class="custom-steps">
      <template v-for="(step, index) in steps" :key="step.value">
        <div class="step-item" :class="{ active: step.value === currentStep }">
          <div class="step-number">
            {{ index + 1 }}
          </div>
          <div class="step-label">
            {{ step.label }}
          </div>
        </div>
        <div v-if="index < steps.length - 1" class="step-connector">
          <RxSvgIcon name="base/rx_ic_chevron_right" />
        </div>
      </template>
    </div>

    <Form ref="form" v-slot="$form" :resolver="resolver" :initial-values class="form-container" @submit="onFormSubmit">
      <div class="form-group">
        <label for="email">
          {{ $t('手机号') }}
          <span class="required">*</span>
        </label>
        <PhoneInput id="phone" name="phone" class="w-full" :disabled="currentStep === 'current'" :placeholder="$t('请输入您的手机号')" />
        <Message v-if="$form.phone?.invalid" severity="error" size="small" variant="simple">
          {{ $form.phone.error?.message }}
        </Message>
      </div>

      <div class="form-group verification-group">
        <label for="verification-code">
          {{ $t('验证码') }}
          <span class="required">*</span>
        </label>
        <div class="verification-input-group">
          <RxVerificationCodeSender ref="verificationCodeSender" name="verCode" :request="sendCode" />
        </div>
        <Message v-if="$form.verCode?.invalid" severity="error" size="small" variant="simple">
          {{ $form.verCode.error?.message }}
        </Message>
      </div>
      <RxButton type="submit" size="md" :label="currentStep === 'current' ? $t('继续') : $t('确认')" class="continue-btn w-full" :loading="submitLoading"
                :disabled="submitLoading || !formInstance?.valid"
      />
    </Form>
  </div>
</template>

<style lang="scss" scoped>
.email-change-dialog {
  width: 100%;
  max-width: 480px;

  .custom-steps {
    display: flex;
    margin-bottom: 24px;
    position: relative;

    .step-item {
      display: flex;
      align-items: center;
      flex: 1;
      position: relative;

      .step-number {
        display: flex;
        width: 24px;
        height: 24px;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 10px;
        border-radius: 4px;
        background: var(--primitives-neutrals-100, #f0f3f5);
        color: var(--colors-text-text-inactive);
      }

      .step-label {
        margin-left: 8px;
        color: var(--colors-text-text-inactive, #a3a9ad);
        text-align: center;
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: normal;
      }

      &.active {
        .step-number {
          background-color: #e8f5fc;
          color: #12a3fc;
        }

        .step-label {
          color: var(--colors-text-text-primary, #fafafa);
          text-align: center;
          font-family: Inter;
          font-size: 12px;
          font-style: normal;
          font-weight: 600;
          line-height: normal;
        }
      }
    }

    .step-connector {
      width: 40px;
      display: flex;
      align-items: center;
    }
  }

  .form-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;

    label {
      font-size: 14px;
      font-weight: 500;
      color: var(--colors-text-text-primary);

      .required {
        color: #ff4d4f;
      }
    }
  }

  .verification-group {
    .verification-input-group {
      display: flex;
      gap: 12px;

      .verification-input {
        flex: 1;
      }

      .send-code-btn {
        white-space: nowrap;
      }
    }
  }

  .alternative-option {
    font-size: 14px;
    color: #666;

    a {
      color: #1890ff;
      text-decoration: none;
      margin-left: 4px;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .continue-btn {
    margin-top: 8px;
    background-color: #1890ff;
    border: none;

    &:hover {
      background-color: #40a9ff;
    }
  }
}
</style>
