<script lang="ts" setup>
import type { MultiSelectProps } from 'primevue/multiselect'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

type Size = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | undefined

interface Props extends /* @vue-ignore */ Omit<MultiSelectProps, 'size'> {
  size?: Size
}

defineOptions({
  inheritAttrs: false,
})

const { size = 'sm', ...props } = defineProps<Props>()

defineEmits(['change'])

const defaultProps: MultiSelectProps = {
  filter: true,
  optionLabel: 'label',
  optionValue: 'value',
}
</script>

<template>
  <MultiSelect v-bind="{ ...defaultProps, ...props, ...$attrs }" :pt="{ root: size, optionlabel: classes.optionlabel }"
    @change="$emit('change')">
    <template #dropdownicon>
      <RxSvgIcon name="base/rx_ic_chevron_down" />
    </template>
  </MultiSelect>
</template>

<style module="classes">
.optionlabel {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>

<style lang="scss" scoped>
:deep(.p-multiselect-label) {
  color: var(--colors-text-text-primary, #111213);
  font-family: Inter;
}

.lg {
  border-radius: var(--radius-lg, 8px);
  border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-multiselect-label) {
    padding: 10px 10px 10px var(--spacing-xl, 12px);
    font-size: 14px;
    line-height: var(--Line-Height-text-lg, 20px);
  }

  .select-item {
    gap: 8px;
  }
}

.md {
  border-radius: var(--radius-md, 6px);
  border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-multiselect-label) {
    padding: 8px 8px 8px 10px;
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.sm {
  border-radius: var(--radius-md, 6px);
  border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-multiselect-label) {
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 8px;
    font-size: 12px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.xs {
  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-multiselect-label) {
    padding: var(--spacing-md, 6px);
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.xxs {
  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-multiselect-label) {
    padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
