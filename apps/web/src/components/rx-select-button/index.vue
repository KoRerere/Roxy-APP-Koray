<script setup lang="ts">
import SelectButton, { type SelectButtonProps } from 'primevue/selectbutton';

interface Props extends /* @vue-ignore */  Omit<SelectButtonProps, 'size' | 'allowEmpty'> {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  allowEmpty?: boolean
}

const { size = 'sm', allowEmpty = false, ...props } = defineProps<Props>()

</script>

<template>
  <SelectButton v-bind="props" :class="size" :allowEmpty="allowEmpty">
    <template v-for="(_, slotName) in $slots" v-slot:[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}"></slot>
    </template>
  </SelectButton>
</template>

<style scoped lang="scss">
:deep(.p-togglebutton-content) {
  font-weight: 400;
  border: 0.5px solid transparent;
}

:deep(.p-togglebutton-checked .p-togglebutton-content) {
  font-weight: 500;
  border: 0.5px solid var(--component-segment-border-selection-active);
}
</style>
