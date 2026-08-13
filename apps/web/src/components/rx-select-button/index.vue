<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import type { SelectButtonProps } from 'primevue/selectbutton'

interface Props extends /* @vue-ignore */ Omit<SelectButtonProps, 'size' | 'allowEmpty'> {
  size?: 'xxs' | 'sm' | 'lg' | (string & {})
  allowEmpty?: boolean
}

const { size = 'sm', allowEmpty = false, ...props } = defineProps<Props>()
</script>

<template>
  <SelectButton v-bind="props" :class="size" :allow-empty="allowEmpty">
    <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
  </SelectButton>
</template>

<style scoped lang="scss">
.xxs {
  --button-padding: 2px;
  --padding: 2px 12px;
  --font-size: 12px;
  --border-width: 0.5px;
  --border-radius: 4px;
  --line-height: 12px;
}

.sm {
  --button-padding: 3px;
  --padding: 4px 12px;
  --font-size: 13px;
  --border-width: 1px;
  --border-radius: 6px;
  --line-height: 15px;
}

.lg {
  --button-padding: 4px;
  --padding: 6px 12px;
  --font-size: 13px;
  --border-width: 1px;
  --border-radius: 6px;
  --line-height: 18px;
}

:deep(.p-togglebutton) {
  padding: var(--button-padding);
  font-size: var(--font-size);
  line-height: var(--line-height);
}

:deep(.p-togglebutton-content) {
  font-weight: 400;
  padding: var(--padding);
  border-radius: var(--border-radius);
  border-width: var(--border-width);
  border-style: solid;
  border-color: transparent;
}

:deep(.p-togglebutton-checked .p-togglebutton-content) {
  font-weight: 500;
  border-color: var(--component-segment-border-selection-active);
}
</style>
