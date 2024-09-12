<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { PropType } from 'vue'
import { svgIcons } from './svgIcons'
import type { SvgNames } from './svg-icon-types'

const props = defineProps({
  name: {
    type: String as PropType<SvgNames>,
    required: true,
  },
})

const SvgComponent = computed(() => {
  return svgIcons[`../../../assets/images/${props.name}.svg`]
})
</script>

<template>
  <SvgComponent />
</template>

<style lang="scss" scoped></style>
