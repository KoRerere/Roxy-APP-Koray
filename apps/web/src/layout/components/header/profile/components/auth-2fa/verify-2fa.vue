<script setup lang="ts">
import { useThemeStore } from '/@/stores/theme'

const themeStore = useThemeStore()

const imgSrc = computed(() => {
  return new URL(`../../../../../../assets/images/${themeStore.realTheme === 'light' ? 'empty' : 'empty-dark'}/rx_illustration_verification.svg`, import.meta.url).href
})

const modelValue = defineModel<string>('modelValue')

const inputOtpRef = useTemplateRef<any>('inputOtpRef');

onMounted(() => {
  nextTick(() => {
    const inputs = inputOtpRef.value.$el.querySelectorAll('input');
    if (inputs.length > 0) {
      setTimeout(() => {
        inputs[0].focus();
      }, 200)
    }
  });
})
</script>

<template>
  <div>
    <div class="flex justify-center mb-38px">
      <img :src="imgSrc" />
    </div>

    <div class="flex flex-col gap-12px">
      <div class="text-[var(--colors-text-text-tertiary)] font-12px font-400 font-[Inter]">
        {{ $t('要继续，请检查您的身份验证应用并输入以下一次性密码：') }}
      </div>
      <InputOtp ref="inputOtpRef" class="inputotp-auto" name="passcode" :length="6" v-model="modelValue" />
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
    color: var(--colors-text-text-primary, #FAFAFA);
    text-align: center;
    font-family: 'JetBrains Mono';
    font-size: 24px;
    line-height: normal;
    text-transform: uppercase;
  }
}
</style>