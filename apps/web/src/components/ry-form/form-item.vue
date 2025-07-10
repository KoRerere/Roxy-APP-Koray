<script lang="ts" setup>
import InputDate from './input-date.vue'
import InputLabel from './input-label.vue'
import RxInputMultiselect from './rx-input-multiselect.vue'
import RxInputNumber from './rx-input-number.vue'
import InputRadio from './rx-input-radio.vue'
import RxInputSelect from './rx-input-select.vue'
import RxInputText from './rx-input-text.vue'
import RxInputTextarea from './rx-input-textarea.vue'
import RxSelectButton from '/@/components/rx-select-button/index.vue'

interface Props {
  name: string
  type?: string
  label?: string
  tooltip?: string
  labelPosition?: 'top' | 'left'
}

defineOptions({
  inheritAttrs: false,
})
const { name, label, tooltip, type = 'text', labelPosition = 'top' } = defineProps<Props>()

const FormItemMap: Record<string, any> = {
  multiSelect: RxInputMultiselect,
  select: RxInputSelect,
  radio: InputRadio,
  date: InputDate,
  number: RxInputNumber,
  text: RxInputText,
  textarea: RxInputTextarea,
}
</script>

<template>
  <div class="rx-input" :class="{ 'rx-label-left': labelPosition === 'left' }">
    <slot name="label">
      <InputLabel v-bind="{ name, label, tooltip }" />
    </slot>
    <slot name="input">
      <div class="flex-1">
        <RxSelectButton v-if="type === 'selectButton'" class="w-full" option-label="label" option-value="value" data-key="value" v-bind="$attrs" :name="name" />
        <component v-else class="w-full" :is="FormItemMap[type as keyof typeof FormItemMap]" v-bind="$attrs" :name="name" />
        <small v-if="$attrs.invalid" class="rx-input-help">{{ $attrs.errorMsg || $attrs.placeholder }}</small>
        <small v-if="$attrs.help" class="rx-input-help">{{ $attrs.help }}</small>
      </div>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
.rx-input {
  display: flex;
  flex-direction: column;

  &.rx-label-left {
    flex-direction: row;
  }

  &-help {
    display: flex;
    margin-top: var(--spacing-sm, 4px);
    color: var(--red-400, #f87171);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
