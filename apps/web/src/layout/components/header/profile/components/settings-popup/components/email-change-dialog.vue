<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { z } from 'zod';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import { Form, type FormInstance } from '@primevue/forms';
import { API } from '/@/api';
import { useResponseToast } from '/@/hooks/useResponseToast';

const { onSuccess } = defineProps<{
  onSuccess: () => void
}>()

const steps = [
  { label: $t("验证当前邮箱"), value: 'current' },
  { label: $t("设置新邮箱"), value: 'new' },
] as const

const [showToast, onlyErrorToast] = useResponseToast()
const userStore = useUserStore()
const formInstance = useTemplateRef<FormInstance>('form')
const verificationCodeSenderRef = useTemplateRef('verificationCodeSender')

const currentStep = ref<typeof steps[number]['value']>(steps[0].value)
const initialValues = ref({
  email: '',
  password: '',
  ver_code: ''
});
const usePasswordInstead = ref(false)
const submitLoading = ref(false)

const resolver = computed(() => {
  let obj = {}

  if (currentStep.value === 'new') {
    obj = {
      ver_code: z.string().min(1, { message: $t('请输入验证码') })
    }
  } else {
    if (usePasswordInstead.value) {
      obj = {
        password: z.string().min(1, { message: $t('请输入您的密码') })
      }
    } else {
      obj = {
        ver_code: z.string().min(1, { message: $t('请输入验证码') })
      }
    }
  }

  return zodResolver(
    z.object({
      email: z.string().min(1, { message: $t('请输入您的邮箱') }).email({ message: $t('请输入正确的邮箱') }),
      ...obj
    })
  )
})

async function sendCode() {
  const email = formInstance.value?.getFieldState('email')?.value
  const isCurrent = currentStep.value === 'current'
  console.log('email', email)
  if (!isCurrent && !email)
    return

  const { code, msg } = await API.base.userVerifyEmailCreate({
    source: isCurrent ? 'old' : 'new',
    email: isCurrent ? undefined : email
  })

  if (code === 0) {
    showToast(code, $t('验证码发送成功'))
  } else {
    showToast(code, msg)
  }

  return { code, msg }
}

async function verifyCurrentEmail() {
  const field = usePasswordInstead.value ? 'password' : 'ver_code'
  const { code, msg } = await API.base.userGetCheckOldEmailVerCodeList({
    [field]: formInstance.value?.getFieldState(field)?.value,
  })

  if (code !== 0) {
    showToast(code, msg)
    return Promise.reject()
  }
}

async function onFormSubmit({ valid }) {
  if (!valid) {
    return
  }
  submitLoading.value = true
  try {
    if (currentStep.value === 'current') {
      await verifyCurrentEmail()
      currentStep.value = steps[1].value
      formInstance.value?.reset()
      verificationCodeSenderRef.value?.clearInterval()
    } else if (currentStep.value === 'new') {
      const { code, msg } = await API.base.userChangeEmailCreate({
        email: formInstance.value?.getFieldState('email')?.value,
        ver_code: formInstance.value?.getFieldState('ver_code')?.value,
      })
      onlyErrorToast(code, msg)
      if (code === 0) {
        onSuccess()
      }
    }
  } finally {
    submitLoading.value = false
  }

}


onMounted(() => {
  formInstance.value?.setFieldValue('email', userStore.userInfo?.email)
})
</script>

<template>
  <div class="email-change-dialog">
    <div class="custom-steps">
      <template v-for="(step, index) in steps" :key="step.value">
        <div class="step-item" :class="{ 'active': step.value === currentStep }">
          <div class="step-number">{{ index + 1 }}</div>
          <div class="step-label">{{ step.label }}</div>
        </div>
        <div v-if="index < steps.length - 1" class="step-connector">
          <RxSvgIcon name="base/rx_ic_chevron_right" />
        </div>
      </template>
    </div>

    <Form ref="form" v-slot="$form" :resolver="resolver" :initialValues @submit="onFormSubmit" class="form-container">
      <div class="form-group">
        <label for="email">
          {{ $t('邮箱') }}
          <span class="required">*</span>
        </label>
        <InputText id="email" name="email" class="w-full" :disabled="currentStep === 'current'"
          :placeholder="$t('请输入您的邮箱地址')" />
        <Message v-if="$form.email?.invalid" severity="error" size="small" variant="simple">{{
          $form.email.error?.message }}
        </Message>
      </div>

      <template v-if="!usePasswordInstead || currentStep === 'new'">
        <div class="form-group verification-group">
          <label for="verification-code">
            {{ $t('验证码') }}
            <span class="required">*</span>
          </label>
          <div class="verification-input-group">
            <RxVerificationCodeSender ref="verificationCodeSender" name="ver_code" :request="sendCode" />
            <!-- <InputText id="verification-code" name="code" class="verification-input"
              :placeholder="$t('Code sent to your email')" />
            <RxButton :label="$t('发送验证码')" class="send-code-btn" :loading="codeSending" @click="sendCode" /> -->
          </div>
          <Message v-if="$form.ver_code?.invalid" severity="error" size="small" variant="simple">
            {{ $form.ver_code.error?.message }}
          </Message>
        </div>
      </template>

      <template v-else>
        <div class="form-group">
          <label for="password">
            {{ $t('密码') }}
            <span class="required">*</span>
          </label>
          <Password id="password" name="password" toggle-mask :feedback="false" input-class="w-full" />
          <Message v-if="$form.password?.invalid" severity="error" size="small" variant="simple">
            {{ $form.password.error?.message }}
          </Message>
        </div>
      </template>

      <div v-if="currentStep === 'current'" class="alternative-option">
        <span v-if="!usePasswordInstead">{{ $t('邮箱无法使用？') }}</span>
        <a href="#" @click.prevent="usePasswordInstead = !usePasswordInstead">{{ usePasswordInstead ? $t('使用邮箱验证') :
          $t('使用密码验证') }}</a>
      </div>

      <RxButton type="submit" size="md" :label="currentStep === 'current' ? $t('继续') : $t('确认')"
        class="continue-btn w-full" :loading="submitLoading" :disabled="submitLoading || formInstance?.invalid" />
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
