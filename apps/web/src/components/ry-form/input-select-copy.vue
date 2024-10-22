<script lang="ts" setup>
import type { SelectProps } from 'primevue/select'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

type Size = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | undefined

interface Props extends /* @vue-ignore */ SelectProps {
  size?: Size
  icon?: SvgNames
  name: string
}

defineOptions({
  inheritAttrs: false,
})

const { size = 'md', name, ...props } = defineProps<Props>()

const defaultProps: SelectProps = {
  filter: true,
  showClear: true,
  optionLabel: 'label',
  optionValue: 'value',
  inputId: name,
}
</script>

<template>
  <Select v-bind="{ ...defaultProps, ...props, ...$attrs }" :pt="{ root: size }">
    <template v-if="$attrs.optionValue === null || props.optionValue === null" #value="{ value: option, placeholder }">
      <div v-if="option" class="select-item">
        <RxSvgIcon v-if="option.icon || icon" :name="option.icon || icon" fallback="base/rx_ic_earth" />
        <img v-if="option.image" class="select-item__image" :src="option.image">
        <div>{{ option.label }}</div>
      </div>
      <div v-else>
        {{ placeholder }}
      </div>
    </template>
    <template #option="{ option }">
      <div class="select-item">
        <RxSvgIcon v-if="option.icon || icon" :name="option.icon || icon" fallback="base/rx_ic_earth" />
        <img v-if="option.image" class="select-item__image" :src="option.image">
        <div>{{ option.label }}</div>
      </div>
    </template>
  </Select>
</template>

<style lang="scss" scoped>
.select-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);

  &__image {
    width: 16px;
    height: 16px;
    aspect-ratio: 1;
  }
}

.lg {
  border-radius: var(--radius-lg, 8px);
  border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-select-label) {
    padding: 10px 10px 10px var(--spacing-xl, 12px);
    color: var(--Component-Colors-TextInput-text-text-placeholder, #7c8387);
    font-family: Inter;
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

  :deep(.p-select-label) {
    padding: 8px 8px 8px 10px;
    color: var(--Component-Colors-TextInput-text-text-placeholder, #7c8387);
    font-family: Inter;
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.sm {
  border-radius: var(--radius-md, 6px);
  border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-select-label) {
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 8px;
    color: var(--Component-Colors-TextInput-text-text-placeholder, #7c8387);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.xs {
  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-select-label) {
    padding: var(--spacing-md, 6px);
    color: var(--Component-Colors-TextInput-text-text-placeholder, #7c8387);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.xxs {
  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-select-label) {
    padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
    color: var(--Component-Colors-TextInput-text-text-placeholder, #7c8387);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
