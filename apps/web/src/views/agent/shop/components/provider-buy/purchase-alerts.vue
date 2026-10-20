<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert'
import { useProxyPurchaseLabels } from '../../utils/proxy-purchase-labels'

const { isCN, isDirect } = defineProps<{
  isCN: boolean
  isDirect: boolean
}>()

const labels = useProxyPurchaseLabels()
</script>

<template>
  <RxAlert v-if="isCN" class="!w-full shrink-0 whitespace-pre-wrap" type="warn" :content="labels.cnNetworkAlert" />
  <RxAlert v-if="isDirect && labels.mode === 'proxy'" class="!w-full shrink-0" type="warn" :content="$t('专为跨境电商深度优化，仅可访问电商网站，限 Roxy 生态内合规使用。Roxy 持续助力中国跨境电商高质量发展，倡导安全、健康的互联网环境。')" />
  <RxAlert v-if="isDirect && labels.mode === 'device'" class="!w-full shrink-0" type="warn" :content="$t('设备限 Roxy 生态内合规使用。Roxy 持续助力跨境电商高质量发展，倡导安全、健康的互联网环境。')" />
</template>
