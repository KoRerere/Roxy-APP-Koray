<script setup lang="ts">
import type { UnwrapRowType, UserGetProxyListMergedListData } from '@roxy/backend-api'
import { strConcat } from '/@/utils'
import { ProxyExpireStatus, ProxyOrderStatus } from '/@/enums/proxy'

type Data = UnwrapRowType<UserGetProxyListMergedListData>

const { data, showUpgrade = false, onUpgrade = () => { } } = defineProps<{
  data: Data
  showUpgrade?: boolean
  onUpgrade?: (data: any) => void
}>()

const isUpgrade = computed(() => {
  return data.proxyExpireStatus !== ProxyExpireStatus.expired && data.orderStatus === ProxyOrderStatus.done && data.canBandwidthUpgrade
})
</script>

<template>
  <div class="flex items-center gap-4">
    <div>{{ data.bandwidthSpeed ? strConcat(data.bandwidthSpeed.toString(), 'Mbps') : '--' }}</div>
    <RxButton v-if="showUpgrade && isUpgrade" outlined severity="secondary" size="xxs" icon="base/rx_ic_double_up" :label="$t('升级')"
              @click.stop="onUpgrade"
    />
  </div>
</template>

<style lang="scss" scoped></style>
