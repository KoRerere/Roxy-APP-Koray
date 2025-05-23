<script setup lang="ts">
import type { PasswordProps } from 'primevue/password'

type Size = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'

interface Props extends /* @vue-ignore */PasswordProps {
  size?: Size
  fluid?: boolean
  feedback?: boolean
  toggleMask?: boolean
}

const { size = 'sm', fluid = true, toggleMask = true, feedback = false, ...props } = defineProps<Props>()

</script>

<template>
  <Password :class="size" :fluid="fluid" :feedback="feedback" :toggle-mask="toggleMask" v-bind="props" />
</template>

<style lang="scss" scoped>
.lg {
  :deep(.p-inputtext) {
    padding: 10px 10px 10px var(--spacing-xl, 12px);
    border-radius: var(--Component-Colors-TextInput-radius-radius-lg, 8px);
    border-width: 1px;
    font-family: Inter;
    font-size: 14px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.md {
  :deep(.p-inputtext) {
    padding: 8px 8px 8px 10px;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border-width: 1px;
    font-family: Inter;
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.sm {
  :deep(.p-inputtext) {
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 8px;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border-width: 1px;
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.xs {
  :deep(.p-inputtext) {
    padding: var(--spacing-md, 6px);
    border-radius: var(--radius-sm, 4px);
    border-width: 0.5px;
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.xxs {
  :deep(.p-inputtext) {
    padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
    border-radius: var(--radius-sm, 4px);
    border-width: 0.5px;
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
