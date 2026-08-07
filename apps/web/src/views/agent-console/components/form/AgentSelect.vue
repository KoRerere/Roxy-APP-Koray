<script setup lang="ts">
import type { SelectProps } from 'primevue/select'
import Select from 'primevue/select'

interface Props extends /* @vue-ignore */ Omit<SelectProps, 'size'> {
  optionLabel?: string
  optionValue?: string
  options?: any[]
}

defineOptions({
  inheritAttrs: false,
})

const modelValue = defineModel<any>()
const props = withDefaults(defineProps<Props>(), {
  optionLabel: 'label',
  optionValue: 'value',
  options: () => [],
})

const attrs = useAttrs()

function normalizeClass(value: unknown) {
  if (!value)
    return ''

  if (typeof value === 'string')
    return value

  if (Array.isArray(value))
    return value.map(item => normalizeClass(item)).filter(Boolean).join(' ')

  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
      .join(' ')
  }

  return ''
}

const overlayClass = computed(() => {
  const customClass = normalizeClass(props.overlayClass ?? attrs.overlayClass ?? attrs['overlay-class'])
  return ['agent-select-overlay', customClass].filter(Boolean).join(' ')
})
</script>

<template>
  <Select
    v-model="modelValue"
    v-bind="{ ...attrs, ...props }"
    class="agent-select"
    :overlay-class="overlayClass"
    fluid
  >
    <template #dropdownicon>
      <SvgIcon name="base/rx_ic_chevron_down" size="12" />
    </template>

    <template #option="{ option }">
      <slot name="option" :option="option">
        <span>{{ option?.[props.optionLabel] ?? option }}</span>
      </slot>
    </template>
  </Select>
</template>

<style lang="scss" scoped>
.agent-select {
  width: 100%;
  height: 32px;
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  background: var(--color-bg-primary);
  box-shadow: none;
  font-family: inherit;

  &:not(.p-disabled):hover {
    border-color: var(--color-border-primary);
    background: var(--color-bg-secondary-hover);
  }

  &.p-focus {
    border-color: var(--color-border-primary-inverse);
    background: var(--color-bg-primary);
  }

  &.p-invalid,
  &[aria-invalid='true'] {
    border-color: var(--color-border-error);
  }

  :deep(.p-select-label) {
    padding: 5px 10px;
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 14px;
    line-height: 20px;
  }

  :deep(.p-placeholder) {
    color: var(--color-text-disabled);
  }

  &.p-focus :deep(.p-placeholder) {
    color: var(--color-text-primary);
  }

  :deep(.p-select-dropdown) {
    width: 32px;
    color: var(--color-text-quaternary);
  }
}

:global(.agent-select-overlay.p-select-overlay) {
  --p-focus-ring-width: 0;
  --p-focus-ring-style: none;
  --p-focus-ring-color: transparent;
  --p-focus-ring-offset: 0;
  --p-focus-ring-shadow: none;
  --p-select-list-padding: 12px;
  --p-select-list-gap: 4px;
  --p-select-option-padding: 8px;
  --p-select-option-border-radius: 8px;
  --p-select-option-color: var(--color-text-primary);
  --p-select-option-focus-color: var(--color-text-primary);
  --p-select-option-selected-color: var(--color-text-primary);
  --p-select-option-selected-focus-color: var(--color-text-primary);
  --p-select-option-focus-background: var(--color-bg-quaternary);
  --p-select-option-selected-background: var(--color-bg-quaternary);
  --p-select-option-selected-focus-background: var(--color-bg-quaternary);
  min-width: 129px;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--color-border-secondary) !important;
  border-radius: 16px !important;
  background: var(--color-bg-primary) !important;
  box-shadow:
    0px 1px 1px 0px rgba(0, 0, 0, 0.04),
    0px 2px 8px 0px rgba(0, 0, 0, 0.04),
    0px 3px 17px 0px rgba(0, 0, 0, 0.04),
    0px 4px 30px 0px rgba(0, 0, 0, 0.12) !important;
}

:global(.agent-select-overlay .p-select-list-container) {
  padding: 12px !important;
  border-radius: 15px !important;
  background: var(--color-bg-primary) !important;
}

:global(.agent-select-overlay .p-select-list) {
  display: flex;
  flex-direction: column;
  gap: 0 !important;
  padding: 0 !important;
  background: transparent;
}

:global(.agent-select-overlay .p-select-option) {
  position: relative;
  margin: 0 !important;
  min-height: 36px;
  padding: 8px !important;
  border: 0 !important;
  border-radius: 8px !important;
  outline: 0 !important;
  color: var(--color-text-primary) !important;
  background: transparent !important;
  box-shadow: none !important;
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

:global(.agent-select-overlay .p-select-option::before),
:global(.agent-select-overlay .p-select-option::after) {
  border: 0 !important;
  outline: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  content: none !important;
}

:global(.agent-select-overlay .p-select-option + .p-select-option) {
  margin-top: 4px !important;
}

:global(.agent-select-overlay .p-select-option:not(.p-disabled):hover),
:global(.agent-select-overlay .p-select-option:not(.p-disabled).p-focus),
:global(.agent-select-overlay .p-select-option:not(.p-disabled).p-select-option-selected),
:global(.agent-select-overlay .p-select-option:not(.p-disabled):focus),
:global(.agent-select-overlay .p-select-option:not(.p-disabled):focus-visible),
:global(.agent-select-overlay .p-select-option:not(.p-disabled)[data-p-focused='true']),
:global(.agent-select-overlay .p-select-option:not(.p-disabled)[data-p-selected='true']),
:global(.agent-select-overlay .p-select-option:not(.p-disabled)[aria-selected='true']) {
  border: 0 !important;
  outline: 0 !important;
  color: var(--color-text-primary) !important;
  background: var(--color-bg-quaternary) !important;
  box-shadow: none !important;
}

:global(.agent-select-overlay .p-select-option:not(.p-disabled):hover::before),
:global(.agent-select-overlay .p-select-option:not(.p-disabled):hover::after),
:global(.agent-select-overlay .p-select-option:not(.p-disabled).p-focus::before),
:global(.agent-select-overlay .p-select-option:not(.p-disabled).p-focus::after),
:global(.agent-select-overlay .p-select-option:not(.p-disabled):focus::before),
:global(.agent-select-overlay .p-select-option:not(.p-disabled):focus::after),
:global(.agent-select-overlay .p-select-option:not(.p-disabled):focus-visible::before),
:global(.agent-select-overlay .p-select-option:not(.p-disabled):focus-visible::after),
:global(.agent-select-overlay .p-select-option:not(.p-disabled)[data-p-focused='true']::before),
:global(.agent-select-overlay .p-select-option:not(.p-disabled)[data-p-focused='true']::after) {
  border: 0 !important;
  outline: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  content: none !important;
}

:global(.agent-select-overlay .p-select-option-label) {
  font-weight: inherit;
}
</style>
