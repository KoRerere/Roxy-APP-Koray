<script setup lang="ts">
import SelectButton, { type SelectButtonProps } from 'primevue/selectbutton';

interface Props extends /* @vue-ignore */ SelectButtonProps { }
defineProps<Props>()

</script>

<template>
  <SelectButton v-bind="$props">
    <template v-for="(_, slotName) in $slots" v-slot:[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}"></slot>
    </template>
  </SelectButton>
</template>

<style scoped lang="scss">
.p-selectbutton {
  padding: 2px 3px;
  border-radius: 6px;
  border: 0.5px solid var(--colors-border-border-base);
  background: var(--component-segment-bg-tab);

  :deep(.p-togglebutton) {
    min-width: 64px;
    padding: 0;
    border: none;
    border-radius: 4px;
    color: var(--colors-text-text-secondary);

    &:first-child {
      border-radius: 4px;
    }

    &:last-child {
      border-radius: 4px;
    }

    &.p-togglebutton-checked {
      box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
      color: var(--colors-text-text-primary);
    }
  }
}

:deep(.p-togglebutton-checked .p-togglebutton-content) {
  border-color: var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  box-shadow: none;
}

:deep(.p-togglebutton-content) {
  border: 0.5px solid transparent;
  border-radius: 4px;
}
</style>
