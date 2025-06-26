<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import { $t } from '/@/locales'

const modelValue = defineModel<{ email: string, code: string }>({
  default: () => ({ email: '', emailError: false, code: '', codeError: false }),
})

defineProps<{
  sendCodeRequest: () => Promise<any>
}>()

</script>

<template>
  <div class="flex flex-col gap-12px">
    <div class="text-[var(--colors-text-text-primary)] font-14px font-600 font-[Inter]">
      {{ $t('设置您的恢复邮箱') }}
    </div>
    <div class="text-[var(--colors-text-text-secondary)] font-12px font-400 font-[Inter]">
      {{ $t('您可以在无法使用身份验证器应用时利用恢复邮箱来进行账号恢复。') }}
    </div>

    <div class="flex flex-col gap-4px">
      <label for="email">
        <span class="text-[#ff4d4f]">*</span>
        {{ $t('恢复邮箱') }}
      </label>
      <TsFormInputText v-model="modelValue.email" class="w-full" :placeholder="$t('请输入您的邮箱地址')" />
    </div>
    <div class="flex flex-col gap-4px">
      <label for="verification-code">
        <span class="text-[#ff4d4f]">*</span>
        {{ $t('验证码') }}
      </label>
      <div class="verification-input-group">
        <RxVerificationCodeSender v-model="modelValue.code" :request="sendCodeRequest" :placeholder="$t('请输入验证码')" />
      </div>
    </div>
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
