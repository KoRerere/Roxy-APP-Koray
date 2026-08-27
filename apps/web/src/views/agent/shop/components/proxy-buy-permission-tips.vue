<script setup lang="ts">
import { useProxyShopLabels } from '../utils/proxy-shop-labels'

const emit = defineEmits<{
  close: []
  /** 前往个人空间后再打开 RoxyIP 购买 */
  goPersonal: []
}>()

const shopLabels = useProxyShopLabels()

function onClose() {
  emit('close')
}

function onGoPersonal() {
  emit('goPersonal')
  onClose()
}
</script>

<template>
  <div class="w-96 flex flex-col gap-6 pa-6 pt-4 rounded-lg">
    <div class="h-9 flex items-center justify-between">
      <span class="text-4 font-600 leading-normal tt-primary">{{ shopLabels.noBuyPermissionTitle }}</span>
      <SvgIcon
        class="cursor-pointer"
        color="var(--colors-icon-icon-secondary)"
        size="20"
        name="base/rx_ic_delete"
        @click="onClose"
      />
    </div>
    <p class="text-3.5 leading-5 tt-primary">
      {{ shopLabels.noBuyPermissionDescription }}
    </p>
    <div class="flex justify-end">
      <RxButton :label="$t('前往个人空间购买')" @click="onGoPersonal" />
    </div>
  </div>
</template>
