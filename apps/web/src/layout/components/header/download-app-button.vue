<script setup lang="ts">
import { useSimpleLocale } from '/@/stores/locale'

const { getOfficialWebsite } = useSimpleLocale()

function toDownload() {
  const url = getOfficialWebsite('download')
  window.open(url, '_blank')
}
</script>

<template>
  <RxButton class="shrink-0 !aspect-auto" icon="base/rx_ic_download" size="xs" @click="toDownload">
    {{ $t('下载客户端') }}
  </RxButton>
</template>
