<script setup lang="ts">
import type { CheckboxProps } from 'primevue/checkbox'
import Checkbox from 'primevue/checkbox'

interface Props extends /* @vue-ignore */ Omit<CheckboxProps, 'size' | 'binary'> {
  label?: string
}

defineOptions({
  inheritAttrs: false,
})

const modelValue = defineModel<boolean>({ default: false })
const props = defineProps<Props>()
const attrs = useAttrs()
const fallbackId = useId()
const inputId = computed(() => props.inputId || `agent-checkbox-${fallbackId}`)
const checkboxProps = computed(() => {
  const { label, ...restProps } = props
  return restProps
})
</script>

<template>
  <label v-bind="attrs" class="agent-checkbox" :class="{ 'agent-checkbox--disabled': props.disabled }" :for="inputId">
    <Checkbox
      v-model="modelValue"
      class="agent-checkbox__control"
      v-bind="checkboxProps"
      :binary="true"
      :input-id="inputId"
    >
      <template #icon="slotProps">
        <slot name="icon" v-bind="slotProps">
          <SvgIcon v-if="slotProps.checked" :class="slotProps.class" name="roxy-agent/rx-ic-check" color="var(--color-text-primary-inverse)" size="12" />
        </slot>
      </template>
    </Checkbox>

    <span v-if="label || $slots.default" class="agent-checkbox__label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<style lang="scss" scoped>
.agent-checkbox {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  gap: 4px;
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.agent-checkbox--disabled {
  cursor: not-allowed;
}

.agent-checkbox__label {
  min-width: 0;
}

.agent-checkbox__control {
  --p-checkbox-checked-background: var(--color-bg-primary-inverse);
  --p-checkbox-checked-border-color: var(--color-bg-primary-inverse);
  --p-checkbox-checked-hover-background: var(--color-bg-primary-inverse);
  --p-checkbox-checked-hover-border-color: var(--color-bg-primary-inverse);
  --p-checkbox-checked-focus-background: var(--color-bg-primary-inverse);
  --p-checkbox-checked-focus-border-color: var(--color-bg-primary-inverse);
  --p-checkbox-checked-active-background: var(--color-bg-primary-inverse);
  --p-checkbox-checked-active-border-color: var(--color-bg-primary-inverse);
  --p-checkbox-hover-border-color: var(--color-bg-primary-inverse);
  --p-checkbox-focus-border-color: var(--color-bg-primary-inverse);
  --p-checkbox-icon-checked-color: var(--color-text-primary-inverse);
  --checkbox-icon-checked-color: var(--color-text-primary-inverse);
  --p-checkbox-focus-ring-color: transparent;

  flex: 0 0 16px;

  :deep(.p-checkbox-box) {
    width: 16px;
    height: 16px;
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    background: var(--color-bg-primary);
    box-shadow: none;
  }

  :deep(.p-checkbox-box:hover) {
    border-color: var(--color-bg-primary-inverse);
  }

  &.p-checkbox-checked,
  &[data-p-checked='true'],
  &:has(.p-checkbox-input:checked) {
    :deep(.p-checkbox-box) {
      border-color: var(--color-bg-primary-inverse);
      background: var(--color-bg-primary-inverse);
    }

    :deep(.p-checkbox-icon) {
      color: var(--color-text-primary-inverse) !important;
    }
  }

  &.p-checkbox-checked:hover,
  &.p-checkbox-checked:has(.p-checkbox-input:hover),
  &.p-checkbox-checked:has(.p-checkbox-input:focus-visible),
  &[data-p-checked='true']:hover,
  &[data-p-checked='true']:has(.p-checkbox-input:hover),
  &[data-p-checked='true']:has(.p-checkbox-input:focus-visible),
  &:has(.p-checkbox-input:checked:hover),
  &:has(.p-checkbox-input:checked:focus-visible) {
    :deep(.p-checkbox-box) {
      border-color: var(--color-bg-primary-inverse);
      background: var(--color-bg-primary-inverse);
    }
  }

  &:has(.p-checkbox-input:hover),
  &:has(.p-checkbox-input:focus-visible) {
    :deep(.p-checkbox-box) {
      border-color: var(--color-bg-primary-inverse);
    }
  }
}
</style>
