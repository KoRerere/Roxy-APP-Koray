<script lang="ts" setup>
import InputDate from './input-date.vue'
import InputLabel from './input-label.vue'
import RxInputNumber from './rx-input-number.vue'
import InputRadio from './rx-input-radio.vue'
import RxInputSelect from './rx-input-select.vue'
import RxInputText from './rx-input-text.vue'
import RxInputTextarea from './rx-input-textarea.vue'

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

defineEmits(['change'])
</script>

<template>
  <div class="rx-input" :class="{ 'rx-label-left': labelPosition === 'left' }">
    <slot name="label">
      <InputLabel v-bind="{ name, label, tooltip }" />
    </slot>
    <slot name="input">
      <div class="flex-1">
        <MultiSelect v-if="type === 'multiSelect'" class="flex-1" v-bind="$attrs" @change="$emit('change')" />
        <RxInputSelect v-if="type === 'select'" v-bind="$attrs" :name="name" @change="$emit('change')" />
        <InputRadio v-if="type === 'radio'" v-bind="$attrs" :name="name" @change="$emit('change')" />
        <InputDate v-if="type === 'date'" v-bind="$attrs" />
        <RxInputNumber v-if="type === 'number'" v-bind="$attrs" :name="name" @change="$emit('change')" />
        <RxInputText v-if="type === 'text'" v-bind="$attrs" :name="name" @change="$emit('change')" />
        <RxInputTextarea v-if="type === 'textarea'" v-bind="$attrs" :name="name" @change="$emit('change')" />
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
    color: var(--p-red-400, #f87171);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
