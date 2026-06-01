<script setup lang="ts">
import { useSimpleLocale } from '/@/stores/locale'

const { getOfficialWebsite } = useSimpleLocale()

function toDownload() {
  const url = getOfficialWebsite('/download')
  window.open(url, '_blank')
}
</script>

<template>
  <RxButton v-tooltip.bottom="{ value: $t('下载 Roxy AI 浏览器客户端\n解锁更多跨境出海工具与 Roxy AI 能力'), pt: { root: '!max-w-60' } }" class="shrink-0" icon="base/rx_ic_download" size="xs" :label="$t('下载客户端')"
            @click="toDownload"
  />
</template>
