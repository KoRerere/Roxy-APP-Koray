<script setup lang="ts">
import type { PasswordProps } from 'primevue/password'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

interface Props extends /* @vue-ignore */PasswordProps {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  preIcon?: SvgNames
  fluid?: boolean
  fieldProps?: Record<string, any>,
  feedback?: boolean
  toggleMask?: boolean
}

const { size = 'sm', preIcon, fieldProps, fluid = true, toggleMask = true, feedback = false, ...props } = defineProps<Props>()

defineEmits(['preIconClick'])

const attrs = useAttrs()

</script>

<template>
  <IconField class="w-full" :class="size" v-bind="fieldProps">
    <InputIcon v-if="preIcon">
      <RxSvgIcon class="cursor-pointer" :name="preIcon" @click="$emit('preIconClick')" />
    </InputIcon>
    <Password :fluid="fluid" :feedback="feedback" :toggle-mask="toggleMask" v-bind="{ ...attrs, ...props }" />
  </IconField>
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
