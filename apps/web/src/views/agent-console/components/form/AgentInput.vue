<script setup lang="ts">
import type { InputTextProps } from 'primevue/inputtext'
import type { SvgNames } from '/@/components/rx-icon'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'

interface Props extends /* @vue-ignore */ Omit<InputTextProps, 'size'> {
  icon?: SvgNames
  iconSize?: number | string
  preIcon?: SvgNames
  preIconSize?: number | string
}

defineOptions({
  inheritAttrs: false,
})

const modelValue = defineModel<string | number | null>()
const props = withDefaults(defineProps<Props>(), {
  iconSize: 14,
  preIconSize: 16,
})

const attrs = useAttrs()
const slots = useSlots()
const inputRef = useTemplateRef<{ $el: HTMLInputElement }>('input')
const inputProps = computed(() => {
  const { icon, iconSize, preIcon, preIconSize, ...restProps } = props
  return restProps
})

defineExpose({
  focus: () => inputRef.value?.$el.focus(),
  blur: () => inputRef.value?.$el.blur(),
})
</script>

<template>
  <IconField class="agent-input">
    <InputIcon v-if="props.preIcon || slots.preIcon" class="agent-input__icon agent-input__icon--left">
      <slot name="preIcon">
        <SvgIcon :name="props.preIcon!" :size="props.preIconSize" />
      </slot>
    </InputIcon>

    <InputText ref="input" v-model="modelValue" v-bind="{ ...attrs, ...inputProps }" fluid />

    <InputIcon v-if="props.icon || slots.icon" class="agent-input__icon agent-input__icon--right">
      <slot name="icon">
        <SvgIcon :name="props.icon!" :size="props.iconSize" />
      </slot>
    </InputIcon>
  </IconField>
</template>

<style lang="scss" scoped>
.agent-input {
  width: 100%;
  color: var(--color-text-primary);

  :deep(.p-inputtext) {
    width: 100%;
    height: 32px;
    padding: 6px 10px;
    border: 1px solid var(--color-border-primary);
    border-radius: 10px;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    box-shadow: none;
    font-family: inherit;
    font-size: 14px;
    line-height: 20px;
    outline: none;

    &::placeholder {
      color: var(--color-text-disabled);
    }

    &:enabled:hover {
      border-color: var(--color-border-primary);
      background: var(--color-bg-secondary-hover);
    }

    &:enabled:focus {
      border-color: var(--color-border-primary-inverse);
      background: var(--color-bg-primary);
    }

    &.p-invalid,
    &[aria-invalid='true'] {
      border-color: var(--color-border-error);
    }

    &:disabled {
      color: var(--color-text-disabled);
      cursor: not-allowed;
      opacity: 1;
    }
  }

  :deep(.p-inputtext:not(:first-child)) {
    padding-left: 28px;
    padding-inline-start: 28px;
  }

  :deep(.p-inputtext:not(:last-child)) {
    padding-right: 28px;
    padding-inline-end: 28px;
  }

  :deep(.p-inputicon) {
    display: inline-flex;
    width: 16px;
    height: 16px;
    align-items: center;
    justify-content: center;
    color: var(--color-text-quaternary);
    margin-top: -8px;
  }

  :deep(.p-inputicon:first-child) {
    left: 8px;
    inset-inline-start: 8px;
  }

  :deep(.p-inputicon:last-child) {
    right: 10px;
    inset-inline-end: 10px;
  }
}
</style>
