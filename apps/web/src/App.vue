<script lang="ts" setup>
import GlobalComponent from '/@/components/business/global-component/index.vue'

console.log('__WEB_VERSION__', __WEB_VERSION__)
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

.p-tooltip-text {
  color: var(--Color-neutrals-0, #FFF);
  text-align: center;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
