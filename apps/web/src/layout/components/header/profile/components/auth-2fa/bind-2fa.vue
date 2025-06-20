<script setup lang="ts">
import QRCode from 'qrcode'
import { copyText } from '/@/utils';

const qrcodeBase64 = ref()
const secret = ref('LBOUA5BRGJPRKFAQ')
const copied = ref(false)

const onCopySecret = () => {
  copied.value = true
  copyText(secret.value)
}

const generateQrcode = async () => {
  const qrcode = await QRCode.toDataURL('otpauth://totp/roxy:anbin?secret=LBOUA5BRGJPRKFAQ&period=30&digits=6&algorithm=SHA1&issuer=roxy')
  qrcodeBase64.value = qrcode
}

generateQrcode();

</script>


<template>
  <div class="flex flex-col gap-16px">
    <div class="text-14px font-[Inter] font-600 text-[var(--colors-text-text-primary)]">{{ $t('设置您的身份验证器应用') }}
    </div>
    <div class="flex flex-col gap-6px">
      <div class="text-12px font-[Inter] font-600 text-[var(--colors-text-text-primary)]">{{ $t('步骤 1：扫描二维码：') }}
      </div>
      <div class="text-12px font-[Inter] font-400 text-[var(--colors-text-text-secondary)]">{{
        $t('使用身份验证器应用或浏览器扩展程序进行扫描。（例如 Google 身份验证应用或 Microsoft 身份验证应用）') }}</div>
    </div>

    <div class="flex justify-center items-center">
      <img :src="qrcodeBase64" class="border border-solid border-[var(--colors-border-border-subtle)] rounded-8px" />
    </div>

    <div class="flex flex-col gap-12px mb-32px">
      <div class="text-12px font-[Inter] font-600 text-[var(--colors-text-text-secondary)]">{{
        $t('如果您无法扫描此二维码，请在应用中手动输入以下字符串') }}</div>
      <div
        class="flex items-center justify-center gap-4px text-center text-16px font-[JetBrains_Mono] font-500 text-[var(--colors-text-text-primary)]">
        {{ secret }}
        <RxSvgIcon :name="copied ? 'base/rx_ic_check' : 'base/rx_ic_copy'" size="16px"
          :color="copied ? 'var(--colors-icon-icon-success)' : 'var(--colors-icon-icon-secondary)'"
          class="cursor-pointer" @click="onCopySecret" />
      </div>
    </div>

    <div class="text-12px font-[Inter] font-600 text-[var(--colors-text-text-primary)]">
      {{ $t('步骤 2：从应用中验证二维码') }}
    </div>

    <InputOtp class="inputotp-auto" name="passcode" :length="6" />
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