<script setup>
import inputLabel from './input-label.vue'
import inputSelect from './input-select.vue'
import inputRadio from './input-radio.vue'

defineProps({
  name: String,
  label: String,
  tooltip: String,
  type: {
    type: String,
    default: 'text',
  },
  labelPosition: {
    type: String,
    default: 'top',
  },
  // Invalid:{
  //   type: Boolean,
  //   default: false,
  // }
})

defineEmits(['change'])
</script>

<template>
  <div class="rx-input" :class="{ 'rx-label-left': labelPosition === 'left' }">
    <slot name="label">
      <input-label class="input-label" v-bind="{ name, label, tooltip }" />
    </slot>
    <slot name="input">
      <input-select v-if="type === 'select'" v-bind="$attrs" :name="name" @change="$emit('change')" />
      <input-radio v-if="type === 'radio'" v-bind="$attrs" :name="name" @change="$emit('change')" />
      <small v-if="$attrs.invalid" class="rx-input-help">{{ $attrs.placeholder }}</small>
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
    gap: var(--spacing-sm, 4px);
    color: var(--p-red-400, #f87171);
    font-family: Inter;
    font-size: 10px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
