<script lang="ts" setup>
import GlobalComponent from '/@/components/business/global-component/index.vue'
</script>

<template>
  <RouterView />
  <GlobalComponent />
</template>

<style lang="scss">
.rx-dialog {
  min-width: 350px;
}

.p-tooltip-arrow {
  display: none;
}
</style>
