<script setup lang="ts">
import MInputLabel from './m-input-label.vue'
import MInputGroup from './m-input-group.vue'
import MInputText from './m-input-text.vue'
import MInputNumber from './m-input-number.vue'
import MInputPassword from './m-input-password.vue'
import MInputTextarea from './m-input-textarea.vue'
import MInputSelect from './m-input-select.vue'
import MInputMultiSelect from './m-input-multi-select.vue'
import MInputCascadeSelect from './m-input-cascade-select.vue'
import MInputDatePicker from './m-input-date-picker.vue'
import MInputRadio from './m-input-radio.vue'
import MCustom from './m-custom.vue'
import { createReusableTemplate } from '@vueuse/core'
import { useFormLayout } from './useContext'
import type { Input, InputType } from './type'

defineOptions({ inheritAttrs: false })

const { input } = defineProps<{
  input: Input
}>()

const { position: formPosition, labelProps: formLabelProps } = useFormLayout()

const [DefineTemplate, ReuseTemplate] = createReusableTemplate({
  inheritAttrs: false,
})

const DEFAULT_INPUT_COMPONENT = MInputText as Component

const INPUT_TYPE_MAP: Partial<Record<InputType, Component>> = {
  text: MInputText as Component,
  number: MInputNumber as Component,
  password: MInputPassword as Component,
  textarea: MInputTextarea as Component,
  select: MInputSelect as Component,
  mselect: MInputMultiSelect as Component,
  cascade: MInputCascadeSelect as Component,
  date: MInputDatePicker as Component,
  radio: MInputRadio as Component,
  // 'checkbox': 'checkbox',
  // 'switch': 'switch',
}

const position = computed(() => input.labelPosition ?? formPosition.value)
const mergedLabelProps = computed(() => ({
  ...formLabelProps.value,
  ...input.labelProps,
}))
const showLabel = computed(() => Boolean(input.labelRender || input.label))
const labelStyle = computed(() => {
  const { class: _, width, style, ...rest } = mergedLabelProps.value

  if (position.value !== 'left') {
    return { ...style, ...rest }
  }

  return {
    ...style,
    ...rest,
    ...(width ? { '--form-label-width': width } : {}),
  }
})

function resolveInputComponent(type: InputType | undefined): Component {
  return (type && INPUT_TYPE_MAP[type]) || DEFAULT_INPUT_COMPONENT
}
</script>

<template>
  <DefineTemplate v-slot="{ input: ipt, class: fieldClass }">
    <FormField v-slot="$field" class="flex flex-col gap-1" :class="fieldClass" :name="ipt.name">
      <MCustom v-if="ipt.render" :field="$field" :input="ipt" />
      <component :is="resolveInputComponent(ipt.type)" v-else v-bind="ipt.props" />
      <component :is="(ipt.afterRender as Component)" v-if="ipt.afterRender" :field="$field" :input="ipt" />
      <Message v-if="$field?.invalid" severity="error" size="small" variant="simple">
        {{ $field.error?.message }}
      </Message>
    </FormField>
  </DefineTemplate>

  <RxDivider v-if="input.separator" line-only v-bind="input.separatorProps" />
  <div v-else class="item" :class="position === 'left' ? 'item--left' : 'item--top'">
    <div v-if="showLabel" class="item__label" :class="mergedLabelProps.class" :style="labelStyle">
      <component :is="(input.labelRender as Component)" v-if="input.labelRender" />
      <MInputLabel v-else-if="input.label" :label="input.label" :tooltip="input.tooltip" :required="input.required" />
    </div>
    <div class="item__content" :class="{ 'item__content--full': !showLabel }">
      <MInputGroup v-if="input.type === 'group'">
        <ReuseTemplate v-for="child in input.items" :key="child.name" :class="child.itemClass" :input="child" />
      </MInputGroup>
      <ReuseTemplate v-else :input="input" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.item--top {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item--left {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg, 12px);

  .item__label {
    flex-shrink: 0;
    width: var(--form-label-width, 100px);
    padding-top: var(--form-label-padding-top, 6px);
    text-align: right;
  }

  .item__content {
    flex: 1;
    min-width: 0;
  }
}

.item__content--full {
  width: 100%;
}
</style>
