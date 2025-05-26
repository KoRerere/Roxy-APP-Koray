<script setup lang="ts">
import type { SelectButtonProps } from 'primevue/selectbutton'

interface Props extends SelectButtonProps {

}

defineProps<Props>()
</script>

<template>
  <SelectButton v-bind="{ ...$props, ...$attrs }" />
</template>

<style lang="scss" scoped>
.p-selectbutton {
  display: flex;
  align-items: center;
  padding: var(--spacing-xs, 2px);
  gap: var(--spacing-xs, 2px);
  border-radius: 6px;
  border: 0.5px solid var(--colors-border-border-base, #AFB7BB);
  background: var(--p-component-segment-bg-tab, #F1F5F8);

  :deep(.p-togglebutton) {
    min-width: 64px;
    padding: 2px var(--spacing-xl, 12px);
    border: 0.5px solid transparent;
    border-radius: 4px !important;
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);

    &::before {
      content: none;
    }

    &.p-togglebutton-checked {
      color: var(--colors-text-text-primary, #fafafa);
      border-color: var(--colors-border-border-base, #c7cdd1);
      background: var(--colors-background-bg-app, #fff);
      box-shadow:
        0px 4px 4px -1px rgba(0, 0, 0, 0.02),
        0px 1px 1px 0px rgba(0, 0, 0, 0.06);
    }

    .p-togglebutton-content {
      background: transparent;
      padding: 0;
      box-shadow: none;
    }
  }
}
</style>
