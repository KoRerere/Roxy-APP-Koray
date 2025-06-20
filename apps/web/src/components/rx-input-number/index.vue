<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon'

const number = defineModel<number>()
</script>

<template>
  <InputNumber v-model="number" class="rx-input-number" button-layout="horizontal" show-buttons fluid v-bind="$attrs">
    <template #incrementicon>
      <RxSvgIcon name="base/rx_ic_plus" />
    </template>
    <template #decrementicon>
      <RxSvgIcon name="base/rx_ic_minus" />
    </template>
  </InputNumber>
</template>

<style lang="scss">
.rx-input-number {
  &.p-inputnumber {
    border-radius: 6px;
    border: 1px solid var(--colors-border-border-base);
    background: var(--colors-background-bg-action);

    .p-inputnumber-input {
      padding: 0;
      border: none;
      color: var(--colors-text-text-primary);
      text-align: center;
      font-size: 12px;
      line-height: 20px;
    }

    .p-inputnumber-button {
      padding: 6px;
      width: auto;
      border: none;
    }
  }
}
</style>
