<script setup lang="ts">
import { useSimpleLocale } from '/@/stores/locale'

const { getOfficialWebsite } = useSimpleLocale()

function toDownload() {
  const url = getOfficialWebsite('/download')
  window.open(url, '_blank')
}
</script>

<template>
  <RxButton class="shrink-0" icon="base/rx_ic_download" size="xs" :label="$t('下载客户端')" @click="toDownload" />
</template>
