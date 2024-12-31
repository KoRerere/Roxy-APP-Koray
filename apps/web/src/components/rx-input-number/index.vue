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
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    background: var(--Component-Colors-TextInput-bg-bg, #fff);

    .p-inputnumber-input {
      padding: 0;
      border: none;
      color: var(--Component-Colors-TextInput-text-text, #171c1f);
      text-align: center;
      font-family: Inter;
      font-size: 12px;
      line-height: var(--Line-Height-text-lg, 20px);
    }

    .p-inputnumber-button {
      padding: var(--spacing-md, 6px);
      width: auto;
      border: none;
    }
  }
}
</style>
