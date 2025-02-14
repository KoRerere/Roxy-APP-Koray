<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core';
import { formatProxyTime } from '/@/utils';

const props = defineProps<{
  loading?: boolean,
}>()

// 最后一次刷新时间
let lastRefreshTime = Date.now()
const refreshTimeText = ref('')

watch(() => props.loading, (loading) => {
  if (!loading) {
    lastRefreshTime = Date.now()
    formatRefreshTimeText()
  }
})

function formatRefreshTimeText() {
  refreshTimeText.value = formatProxyTime(String(lastRefreshTime))
}

useIntervalFn(formatRefreshTimeText, 1000 * 60)

</script>

<template>
  <div class="position-relative flex">
    <RxButton severity="secondary" size="xxs" outlined icon="base/rx_ic_refresh" :label="$t('刷新')" v-tooltip.left="{
      value: $t('最后刷新: {time}', { time: refreshTimeText }),
      pt: { text: '' }
    }" :disabled="loading" />
  </div>
</template>
