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
})

defineEmits(['change'])
</script>

<template>
  <div class="rx-input" :class="{ 'rx-label-left': labelPosition === 'left' }">
    <slot name="label">
      <input-label class="input-label" v-bind="{ name, label, tooltip }" />
    </slot>
    <slot name="input">
      <input-select v-if="type === 'select'" v-bind="$attrs" :name="name" />
      <input-radio v-if="type === 'radio'" v-bind="$attrs" :name="name" @change="$emit('change')" />
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
}
</style>
