<script setup lang="ts">
import type { InputNumberProps } from 'primevue/inputnumber'

type Size = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'

interface Props extends /* @vue-ignore */InputNumberProps {
  size?: Size
  fluid?: boolean
}

const { size = 'sm', fluid = true, ...props } = defineProps<Props>()

</script>

<template>
  <InputNumber :class="size" :fluid="fluid" v-bind="props" />
</template>

<style lang="scss" scoped>
.lg {
  :deep(.p-inputtext) {
    padding: 10px 10px 10px var(--spacing-xl, 12px);
    border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
    border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    color: var(--colors-text-text-primary, #111213);
    font-family: Inter;
    font-size: 14px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.md {
  :deep(.p-inputtext) {
    padding: 8px 8px 8px 10px;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    color: var(--colors-text-text-primary, #111213);
    font-family: Inter;
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.sm {
  :deep(.p-inputtext) {
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 8px;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    color: var(--colors-text-text-primary, #111213);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.xs {
  :deep(.p-inputtext) {
    padding: var(--spacing-md, 6px);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    color: var(--colors-text-text-primary, #111213);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.xxs {
  :deep(.p-inputtext) {
    padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    color: var(--colors-text-text-primary, #111213);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
