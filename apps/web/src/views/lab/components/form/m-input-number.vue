<script setup lang="ts">
import type { InputNumberProps } from 'primevue/inputnumber'

interface Props extends /* @vue-ignore */Omit<InputNumberProps, 'size' | 'fluid'> {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  fluid?: boolean
}

const { size = 'sm', fluid = true, ...props } = defineProps<Props>()

</script>

<template>
  <InputNumber :class="size" :fluid="fluid" v-bind="props" />
</template>

<style lang="scss" scoped>
.lg {
  --input-padding: 10px;
  --input-left-padding: var(--spacing-xl, 12px);
  --input-border-width: 1px;
  --input-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
  --input-font-size: 14px;
  --input-line-height: var(--Line-Height-text-lg, 20px);
}

.md {
  --input-padding: 8px;
  --input-left-padding: 10px;
  --input-border-width: 1px;
  --input-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
  --input-font-size: 13px;
  --input-line-height: var(--Line-Height-text-lg, 20px);
}

.sm {
  --input-padding: var(--spacing-md, 6px);
  --input-left-padding: 8px;
  --input-border-width: 1px;
  --input-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
  --input-font-size: 12px;
  --input-line-height: var(--Line-Height-text-lg, 20px);
}

.xs {
  --input-padding: var(--spacing-md, 6px);
  --input-left-padding: var(--spacing-md, 6px);
  --input-border-width: 0.5px;
  --input-radius: var(--radius-sm, 4px);
  --input-font-size: 12px;
  --input-line-height: var(--Line-Height-text-xs, 16px);
}

.xxs {
  --input-padding: var(--spacing-sm, 4px);
  --input-left-padding: var(--spacing-md, 6px);
  --input-border-width: 0.5px;
  --input-radius: var(--radius-sm, 4px);
  --input-font-size: 12px;
  --input-line-height: var(--Line-Height-text-xs, 16px);
}

:deep(.p-inputtext) {
  padding: var(--input-padding);
  font-size: var(--input-font-size);
  line-height: var(--input-line-height);
  color: var(--colors-text-text-primary);
  font-family: Inter;
  border-style: solid;
  border-color: var(--colors-border-border-base);
  border-width: var(--input-border-width);
  border-radius: var(--input-radius);
}
</style>
