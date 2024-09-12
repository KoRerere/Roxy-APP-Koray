<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { svgIcons } from './svgIcons'
import type { SvgNames } from './svg-icon-types'

const props = defineProps({
  name: {
    type: String as PropType<SvgNames>,
    required: true,
  },
  size: {
    type: [Number, String],
    default: 24,
  },
  color: {
    type: String,
    default: '',
  },
})

const fontSize = computed(() => {
  const { size } = props
  return typeof size === 'number' ? `${size}px` : size
})

const SvgComponent = computed(() => {
  return svgIcons[`../../../assets/images/${props.name}.svg`]
})
</script>

<template>
  <SvgComponent v-bind="$attrs" />
</template>

<style lang="scss" scoped>
svg {
  font-size: v-bind(fontSize);
  color: v-bind(color);
}
</style>
