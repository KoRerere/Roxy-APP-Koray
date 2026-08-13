<script setup lang="ts">
import { useNetworkStore } from '/@/stores/network'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { strConcat } from '/@/utils'
import type { SvgNames } from '/@/components/rx-icon/'

const network = useNetworkStore()
const [showToast] = useResponseToast()
const refreshing = ref(false)

async function refreshLocalNetwork() {
  refreshing.value = true
  try {
    const softConfig = await globalThis.electronAPI.send('app:getSoftConfig')
    const result = await globalThis.electronAPI.send('proxy:detectNetwork', softConfig.networkMode)
    network.setNetworkInfo(result)
  }
  catch {
    showToast(-1, $t('网络检测失败'))
  }
  finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-2 tt-tertiary text-3">
    <span>{{ $t('当前环境使用本机网络：') }}</span>
    <SvgIcon :name="(`country-code/${network.info?.country_code}` as SvgNames)" fallback="base/rx_ic_earth" />
    <span class="font-500">
      {{ strConcat(network.info?.country_code, strConcat('·', network.info?.city)) || '--' }}
    </span>
    <span class="font-500">{{ network.info?.ip || '--' }}</span>
    <SvgIcon class="cursor-pointer" :class="{ 'pi-spin': refreshing }" :name="refreshing ? 'base/rx_ic_progress_bar' : 'base/rx_ic_refresh'" size="14" color="var(--colors-icon-icon-tertiary)"
             @click="refreshLocalNetwork"
    />
  </div>
</template>

<style lang="scss" scoped></style>
