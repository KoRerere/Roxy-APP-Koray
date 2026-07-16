<script setup lang="ts">
import {
  getProxyDownloadBlockDescription,
  getProxyDownloadBlockTitle,
  openProxyKycVerification,
} from '../utils/proxy-download-kyc-gate'
import type { ProxyDownloadBlockVariant } from '../utils/proxy-download-kyc-gate'

const props = defineProps<{
  variant: ProxyDownloadBlockVariant
}>()

const emit = defineEmits<{
  close: []
}>()

const title = computed(() => getProxyDownloadBlockTitle(props.variant))

const description = computed(() => getProxyDownloadBlockDescription(props.variant))

function onClose() {
  emit('close')
}

function onGoVerify() {
  openProxyKycVerification()
  onClose()
}

function onContactSupport() {
  showLiveChat()
  onClose()
}
</script>

<template>
  <div class="proxy-kyc-block flex flex-col gap-6 pa-6 pt-4 rounded-lg w-120">
    <div class="h-9 flex items-center justify-between">
      <span class="proxy-kyc-block__title">{{ title }}</span>
      <SvgIcon
        class="cursor-pointer"
        color="var(--colors-icon-icon-secondary)"
        size="20"
        name="base/rx_ic_delete"
        @click="onClose"
      />
    </div>

    <p class="proxy-kyc-block__desc">
      {{ description }}
    </p>

    <div class="flex justify-end gap-3">
      <RxButton
        severity="secondary"
        outlined
        :label="$t('关闭')"
        @click="onClose"
      />
      <RxButton
        v-if="variant === 'owner'"
        :label="$t('去认证')"
        @click="onGoVerify"
      />
      <RxButton
        v-if="variant === 'support'"
        :label="$t('联系技术支持')"
        @click="onContactSupport"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.proxy-kyc-block {
  &__title {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: normal;
  }

  &__desc {
    margin: 0;
    color: var(--colors-text-text-primary);
    font-size: 14px;
    line-height: 20px;
    white-space: pre-wrap;
  }
}
</style>
