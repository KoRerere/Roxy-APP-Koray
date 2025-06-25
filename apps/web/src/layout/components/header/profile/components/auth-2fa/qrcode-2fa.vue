<script setup lang="ts">
import QRCode from 'qrcode'
import { copyText } from '/@/utils';
import { RxSvgIcon } from '/@/components/rx-icon'

const moduleValue = defineModel<{ qrcode: string, secret: string, code: string }>('modelValue', {
  default: () => ({
    qrcode: '',
    secret: '',
    code: '',
  })
})


const base64 = ref('');

const copied = ref(false)

const onCopySecret = () => {
  if (moduleValue.value.secret) {
    copied.value = true
    copyText(moduleValue.value.secret)
  }
}

const generateQrcode = async () => {
  if (moduleValue.value.qrcode) {
    const __base64 = await QRCode.toDataURL(moduleValue.value.qrcode)
    base64.value = __base64
  }
}

watch(() => moduleValue.value.qrcode, () => {
  generateQrcode();
}, { immediate: true })

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
  <div class="flex flex-col gap-16px">
    <div class="text-14px font-[Inter] font-600 text-[var(--colors-text-text-primary)]">{{ $t('绑定您的身份验证器应用') }}
    </div>
    <div class="flex flex-col gap-6px">
      <div class="text-12px font-[Inter] font-600 text-[var(--colors-text-text-primary)]">{{ $t('步骤 1：扫描二维码：') }}
      </div>
      <div class="text-12px font-[Inter] font-400 text-[var(--colors-text-text-secondary)]">{{
        $t('使用身份验证器应用进行扫描。（例如 Google Authenticator）') }}</div>
    </div>

    <div class="flex justify-center items-center">
      <img :src="base64" class="border border-solid border-[var(--colors-border-border-subtle)] rounded-8px" />
    </div>

    <div class="flex flex-col gap-12px mb-32px">
      <div class="text-12px font-[Inter] font-600 text-[var(--colors-text-text-secondary)]">{{
        $t('如果您无法扫描此二维码，请在应用中手动输入以下字符串') }}</div>
      <div class="flex items-center justify-center gap-4px text-center text-16px font-[JetBrains_Mono] font-500 text-[var(--colors-text-text-primary)]">
        {{ moduleValue.secret }}
        <RxSvgIcon :name="copied ? 'base/rx_ic_check' : 'base/rx_ic_copy'" size="16px" :color="copied ? 'var(--colors-icon-icon-success)' : 'var(--colors-icon-icon-secondary)'" class="cursor-pointer"
          @click="onCopySecret" />
      </div>
    </div>

    <div class="text-12px font-[Inter] font-600 text-[var(--colors-text-text-primary)]">
      {{ $t('步骤 2：输入身份验证器应用中的验证码') }}
    </div>

    <InputOtp class="inputotp-auto" name="passcode" :length="6" v-model="moduleValue.code" ref="inputOtpRef" />
  </div>
</template>

<style scoped lang="scss">
.inputotp-auto {
  margin: 0 auto;
  gap: var(--spacing-md, 6px);

  :deep(.p-inputotp-input) {
    display: flex;
    width: 67px;
    height: 74px;
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