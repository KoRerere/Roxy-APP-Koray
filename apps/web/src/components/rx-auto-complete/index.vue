<script setup lang="ts">
import AutoComplete, { type AutoCompleteProps } from 'primevue/autocomplete';

interface Props extends /* @vue-ignore */  Omit<AutoCompleteProps, 'size'> {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
}

const { size = 'sm', ...props } = defineProps<Props>()

</script>

<template>
  <AutoComplete :class="size" v-bind="props">
    <template v-for="(_, slotName) in $slots" v-slot:[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps"></slot>
    </template>
  </AutoComplete>
</template>

<style lang="scss" scoped>
.lg {
  --input-padding: 10px;
  --input-border-width: 1px;
  --input-radius: var(--component-colors-textinput-radius-radius-lg, 8px);
  --input-font-size: 14px;
  --input-line-height: var(--line-height-text-lg, 20px);
}

.md {
  --input-padding: 8px;
  --input-border-width: 1px;
  --input-radius: var(--component-colors-textinput-radius-radius-md, 6px);
  --input-font-size: 13px;
  --input-line-height: var(--line-height-text-lg, 20px);
}

.sm {
  --input-padding: var(--spacing-md, 6px);
  --input-border-width: 1px;
  --input-radius: var(--component-colors-textinput-radius-radius-md, 6px);
  --input-font-size: 12px;
  --input-line-height: var(--line-height-text-lg, 20px);
}

.xs {
  --input-padding: var(--spacing-md, 6px);
  --input-border-width: 0.5px;
  --input-radius: var(--radius-sm, 4px);
  --input-font-size: 12px;
  --input-line-height: var(--line-height-text-xs, 16px);
}

.xxs {
  --input-padding: var(--spacing-sm, 4px);
  --input-border-width: 0.5px;
  --input-radius: var(--radius-sm, 4px);
  --input-font-size: 12px;
  --input-line-height: var(--line-height-text-xs, 16px);
}

:deep(.p-inputtext) {
  width: 100%;
  padding: var(--input-padding);
  border-radius: var(--input-radius);
  border-width: var(--input-border-width);
  border-color: var(--colors-border-border-base, #AFB7BB);
  color: var(--colors-text-text-primary, #111213);
  font-size: var(--input-font-size);
  line-height: var(--input-line-height);
}
</style>
