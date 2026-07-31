<script setup lang="ts">
import { ProxyType } from '/@/enums/proxy'
import { strConcat } from '/@/utils'

const { data } = defineProps<{
  data: any
}>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-1.5">
      <SvgIcon fallback="base/rx_ic_earth" :name="(`country-code/${data.lastCountry}` as any)" color="var(--colors-icon-icon-inactive)" />
      <span>{{ data.lastCountry || '--' }}{{ strConcat('/', data.lastCity) }}</span>
    </div>
    <div class="flex items-center gap-1.5 leading-none">
      <SvgIcon name="base/rx_ic_monitor" color="var(--colors-icon-icon-tertiary)" />
      <span>{{ [data.proxyType, data.buyProxyType].includes(ProxyType.buy) ? $t('平台设备:') : $t('自备设备:') }}</span>
      <span class="font-[JetBrains_Mono]">{{ [data.proxyType, data.buyProxyType].includes(ProxyType.buy) ? data.lastIp : data.host }}</span>
    </div>
  </div>
</template>

<style scoped></style>
