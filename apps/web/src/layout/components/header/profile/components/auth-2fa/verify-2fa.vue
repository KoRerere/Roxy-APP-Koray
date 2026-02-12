<script setup lang="ts">
import { useThemeStore } from '/@/stores/theme'

const themeStore = useThemeStore()

const imgSrc = computed(() => {
  return new URL(`../../../../../../assets/images/${themeStore.realTheme === 'light' ? 'empty' : 'empty-dark'}/rx_illustration_verification.svg`, import.meta.url).href
})

const modelValue = defineModel<string>('modelValue')

const inputOtpRef = useTemplateRef<any>('inputOtpRef')

onMounted(() => {
  nextTick(() => {
    const inputs = inputOtpRef.value.$el.querySelectorAll('input')
    if (inputs.length > 0) {
      setTimeout(() => {
        inputs[0].focus()
      }, 200)
    }
  })
})
</script>

<template>
  <div>
    <div class="flex justify-center mb-38px">
      <img :src="imgSrc">
    </div>

    <div class="flex flex-col gap-12px">
      <div class="text-[var(--colors-text-text-tertiary)] font-12px font-400 font-[Inter]">
        {{ $t('请检查身份验证器应用以获取验证码。') }}
      </div>
      <InputOtp ref="inputOtpRef" v-model="modelValue" class="inputotp-auto" name="passcode" :length="6" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.inputotp-auto {
  margin: 0 auto;
  gap: var(--spacing-md, 6px);

  :deep(.p-inputotp-input) {
    display: flex;
    width: 51px;
    height: 60px;
    flex-direction: column;
    justify-content: center;
    flex-shrink: 0;
    color: var(--colors-text-text-primary, #fafafa);
    text-align: center;
    font-family: 'JetBrains Mono';
    font-size: 24px;
    line-height: normal;
    text-transform: uppercase;

    @media (max-width: 768px) {
      width: calc(100% / 6 - 5px);
      height: 64px;
      font-size: 20px;
    }
  }
}
</style>
