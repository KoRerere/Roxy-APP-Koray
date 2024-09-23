<script setup lang="ts">
import type { SvgNames } from './svg-icon-types'
import { defineAsyncComponent } from 'vue'
import { svgIcons } from './svgIcons'

const props = defineProps({
  name: {
    type: String as PropType<SvgNames>,
    required: true,
  },
  size: {
    type: [Number, String],
    default: 16,
  },
  color: {
    type: String,
    default: '',
  },
})

const fontSize = computed(() => {
  const { size } = props
  return Number.isNaN(Number(size)) ? size : `${size}px`
})

const SvgComponent = computed(() => {
  return svgIcons[`../../../assets/images/${props.name}.svg`]
})
</script>

<template>
  <SvgComponent class="svg" :data-name="name" v-bind="$attrs" />
</template>

<style lang="scss" scoped>
:where(.svg) {
  font-size: v-bind(fontSize);
  color: v-bind(color);
}
</style>
