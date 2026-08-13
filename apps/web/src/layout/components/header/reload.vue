<script setup lang="ts">
function reload() {
  window.location.reload()
}
</script>

<template>
  <RxButton v-tooltip.left="{ value: $t('刷新客户端'), pt: { root: '!max-w-60' } }" class="shrink-0" severity="secondary" variant="outlined" icon="base/rx_ic_refresh" size="xs" @click="reload" />
</template>
