<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

defineEmits(['close'])
</script>

<template>
  <div class="rx-card">
    <RxSvgIcon class="cursor-pointer rx-card-close" name="base/rx_ic_delete_fill" @click.stop="$emit('close')" />
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.rx-card {
  position: relative;
  padding: 10px 8px;
  border-radius: var(--radius-md, 6px);
  border: 1px solid var(--Colors-Border-border-container, #c7cdd1);
  background: var(--Colors-Background-bg-body, #fff);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

  &-close {
    position: absolute;
    top: 0;
    right: 0;
    transform: translate(50%, -50%);
    color: #7c8387;
    font-size: 12px;
    line-height: 1;
    z-index: 1;
  }
}
</style>
