<script lang="ts" setup>
import type { SelectProps } from 'primevue/select'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

type Size = 'xxs' | 'xs' | 'sm' | 'md' | 'lg'

interface Props extends Omit<SelectProps, 'size' | 'filter' | 'optionLabel' | 'optionValue'> {
  name: string
  icon?: SvgNames
  iconColor?: string
  size?: Size
  filter?: boolean
  optionLabel?: string
  optionValue?: string
}

defineOptions({
  inheritAttrs: false,
})

const {
  name,
  icon,
  iconColor = 'var(--Component-Colors-TextInput-text-text, #171c1f)',
  size = 'sm',
  filter = true,
  optionLabel = 'label',
  optionValue,
  ...props
} = defineProps<Props>()

defineEmits(['change'])

</script>

<template>
  <Select class="w-full" v-bind="{ filter, optionLabel, optionValue, ...props, ...$attrs }" :inputId="name" :pt="{ root: size, option: classes.option }" @change="$emit('change', $event)">
    <template #dropdownicon>
      <RxSvgIcon name="base/rx_ic_chevron_down" />
    </template>
    <template v-if="!optionValue" #value="{ value, placeholder }">
      <div v-if="value" class="select-item">
        <RxSvgIcon v-if="value.icon || icon" :name="value.icon || icon" :color="iconColor" fallback="base/rx_ic_earth" />
        <img v-if="value.image" class="select-item__image" :src="value.image">
        <div>{{ value.label }}</div>
      </div>
      <div v-else>{{ placeholder }}</div>
    </template>
    <template #option="{ option }">
      <div class="select-item">
        <RxSvgIcon v-if="option.icon || icon" :name="option.icon || icon" :color="iconColor" fallback="base/rx_ic_earth" />
        <img v-if="option.image" class="select-item__image" :src="option.image">
        <div>{{ option.label }}</div>
        <slot name="option-extra" :option="option" />
      </div>
    </template>
  </Select>
</template>

<style lang="scss" module="classes">
.option {
  font-size: 13px;

  &[data-p-selected='true']:not([data-p-focused='true']) {
    color: var(--Colors-Text-text-brand, #12a3fc) !important;
    background: #e8f5fc !important;
  }
}
</style>

<style lang="scss" scoped>
.select-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);
  flex: 1;

  &__image {
    width: 16px;
    height: 16px;
    aspect-ratio: 1;
  }
}

:deep(.p-select-label) {
  color: var(--Component-Colors-TextInput-text-text, #171c1f);
  font-family: Inter;
}

.lg {
  border-radius: var(--radius-lg, 8px);
  border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-select-label) {
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

  :deep(.p-select-label) {
    padding: 8px 8px 8px 10px;
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.sm {
  border-radius: var(--radius-md, 6px);
  border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-select-label) {
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 8px;
    font-size: 12px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.xs {
  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-select-label) {
    padding: var(--spacing-md, 6px);
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.xxs {
  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);

  :deep(.p-select-label) {
    padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
