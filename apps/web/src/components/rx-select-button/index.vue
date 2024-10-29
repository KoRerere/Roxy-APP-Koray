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
  border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  background: var(--Color-neutrals-50, #fafbfc);

  :deep(.p-togglebutton) {
    padding: var(--spacing-xs, 2px) 10px;
    border: 0.5px solid transparent;
    border-radius: 4px !important;
    background: var(--Colors-Alpha-alpha-white-0, rgba(255, 255, 255, 0));

    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);

    &::before {
      content: none;
    }

    &.p-togglebutton-checked {
      color: var(--Colors-Text-text-primary, #171c1f);
      border-color: var(--Colors-Border-border-container, #c7cdd1);
      background: var(--Colors-Background-bg-body, #fff);
      box-shadow:
        0px 4px 4px -1px rgba(0, 0, 0, 0.02),
        0px 1px 1px 0px rgba(0, 0, 0, 0.06);
    }
  }
}
</style>
