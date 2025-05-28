<script lang="ts" setup>
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

interface Props {
  name: string
  icon?: SvgNames
  iconColor?: string
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
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
  iconColor = 'var(--colors-text-text-placeholder, #575D60);',
  size = 'sm',
  filter = true,
  optionLabel = 'label',
  optionValue,
} = defineProps<Props>()

defineEmits(['change'])

const attrs = useAttrs()
</script>

<template>
  <Select class="w-full" v-bind="attrs" :optionLabel="optionLabel" :optionValue="optionValue" :filter="filter" :inputId="name" :pt="{ root: size, option: classes.option }"
    @change="$emit('change', $event)">
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
        <slot name="option-extra" :option="option"></slot>
      </div>
    </template>
  </Select>
</template>

<style lang="scss" module="classes">
.option {
  font-size: 13px;
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
  font-family: Inter;
}

.lg {
  border-radius: var(--radius-lg, 8px);
  border-width: 1px;

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
  border-width: 1px;

  :deep(.p-select-label) {
    padding: 8px 8px 8px 10px;
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.sm {
  border-radius: var(--radius-md, 6px);
  border-width: 1px;

  :deep(.p-select-label) {
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 8px;
    font-size: 12px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.xs {
  border-radius: var(--radius-sm, 4px);
  border-width: 0.5px;

  :deep(.p-select-label) {
    padding: var(--spacing-md, 6px);
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.xxs {
  border-radius: var(--radius-sm, 4px);
  border-width: 0.5px;

  :deep(.p-select-label) {
    padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
