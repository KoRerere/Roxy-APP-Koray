<script setup lang="ts">
import type { SvgNames } from './svg-icon-types'
import { svgIcons } from './svgIcons'

interface Props {
  name: SvgNames
  size?: number | string
  color?: string
  fallback?: string
  onClick?: (e: any) => Promise<any> | any
}

const props = withDefaults(defineProps<Props>(), {
  size: 16,
  color: 'inherit',
})

const fontSize = computed(() => {
  const { size } = props
  return Number.isNaN(Number(size)) ? size : CSS.px(size as number).toString()
})

const SvgComponent = computed(() => {
  return svgIcons[`../../../assets/images/${props.name}.svg`] ?? svgIcons[`../../../assets/images/${props.fallback}.svg`]
})
</script>

<template>
  <SvgComponent class="svg" :data-name="props.name" v-bind="$attrs" @click="props.onClick" />
</template>

<style lang="scss" scoped>
:where(.svg) {
  font-size: v-bind(fontSize);
  color: v-bind(color);
  flex-shrink: 0;
}
</style>
