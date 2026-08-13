<script setup lang="ts">
interface Props {
  borderWidth?: number
  borderRadius?: number
  deg?: number
  animation?: boolean
  animationDuration?: number
  bgColor?: string
  gradient?: string[]
}

const {
  borderWidth = 2,
  borderRadius = 6,
  deg = 0,
  animation = true,
  animationDuration = 8,
  bgColor = 'transparent',
  gradient = ['#12a3fc', '#ec51f7', '#ec51f7'],
} = defineProps<Props>()

const _borderWidth = CSS.px(borderWidth).toString()
const _borderRadius = CSS.px(borderRadius).toString()

const cssVar = computed(() => ({
  '--angle': `${deg}deg`,
  '--animation-duration': `${animationDuration}s`,
  '--gradient-stops': gradient.join(', '),
}))
</script>

<template>
  <div :style="cssVar" class="gradient" :class="{ animation }">
    <slot />
  </div>
</template>

<style lang="scss" scoped>
@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

:where(.gradient) {
  border: v-bind(_borderWidth) solid transparent;
  border-radius: v-bind(_borderRadius);
  background:
    linear-gradient(v-bind(bgColor), v-bind(bgColor)) padding-box,
    linear-gradient(var(--angle), var(--gradient-stops)) border-box;
}

.animation {
  animation: var(--animation-duration) rotate linear infinite;
}

@keyframes rotate {
  to {
    --angle: 360deg;
  }
}
</style>
