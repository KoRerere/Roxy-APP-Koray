<script lang="ts" setup>
import type { SelectProps } from 'primevue/select'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { isLikeFunction } from '/@/utils'

interface Props extends Omit<SelectProps, 'size' | 'optionLabel' | 'optionValue'> {
  icon?: SvgNames
  iconColor?: string
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
  options?: any[]
  optionLabel?: string
  optionValue?: string
  getOptions?: () => any[] | Promise<any[]>
  onChange?: (value: any) => void
}

const {
  icon,
  iconColor = 'var(--colors-text-text-primary, #171c1f)',
  size = 'sm',
  options,
  optionLabel = 'label',
  optionValue,
  getOptions,
  onChange,
  ...props
} = defineProps<Props>()

watch(() => options, (value) => {
  _options.value = value
})

const _options = computed(() => options)

onBeforeMount(async () => {
  if (getOptions && isLikeFunction(getOptions)) {
    _options.value = await getOptions()
  }
})

function _onChange(event: any) {
  if (onChange && isLikeFunction(onChange)) {
    onChange({
      ...event,
      props: {
        options: _options.value,
        optionLabel,
        optionValue,
        ...props
      }
    })
  }
}
</script>

<template>
  <Select class="w-full" v-bind="{ optionLabel, optionValue, ...props }" :options="_options"
    :pt="{ root: size, option: classes.option }" @change="_onChange">
    <template #dropdownicon>
      <RxSvgIcon name="base/rx_ic_chevron_down" />
    </template>
    <template v-if="!optionValue" #value="{ value, placeholder }">
      <div v-if="value" class="selectitem">
        <RxSvgIcon v-if="value.icon || icon" :name="value.icon || icon" :color="iconColor"
          fallback="base/rx_ic_earth" />
        <img v-if="value.image" class="selectitem__image" :src="value.image">
        <div>{{ value.label }}</div>
      </div>
      <div v-else>{{ placeholder }}</div>
    </template>
    <template #option="{ option }">
      <div class="selectitem">
        <RxSvgIcon v-if="option.icon || icon" :name="option.icon || icon" :color="iconColor"
          fallback="base/rx_ic_earth" />
        <img v-if="option.image" class="selectitem__image" :src="option.image">
        <div>{{ option.label }}</div>
        <slot name="option-extra" :option="option"></slot>
      </div>
    </template>
  </Select>
</template>

<style lang="scss" module="classes">
.option {
  font-size: 13px;

  &[data-p-selected='true']:not([data-p-focused='true']) {
    color: var(--colors-text-text-brand, #12a3fc) !important;
    background: #e8f5fc !important;
  }
}
</style>

<style lang="scss" scoped>
.selectitem {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);

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

  .selectitem {
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
