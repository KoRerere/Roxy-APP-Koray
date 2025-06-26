<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

interface Props {
  closable?: boolean
}
const { closable = true } = defineProps<Props>()

defineEmits(['close'])
</script>

<template>
  <div class="rx-card">
    <RxSvgIcon v-if="closable" class="cursor-pointer rx-card-close" name="base/rx_ic_delete_fill" @click.stop="$emit('close')" />
    <slot></slot>
  </div>
</template>

<style lang="scss" scoped>
.rx-card {
  position: relative;
  padding: 10px 8px;
  border-radius: 6px;
  border: 1px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

  &-close {
    position: absolute;
    top: 0;
    right: 0;
    transform: translate(50%, -50%);
    color: var(--colors-icon-icon-secondary);
    font-size: 12px;
    line-height: 1;
    z-index: 1;
  }
}
</style>
