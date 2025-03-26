<script setup lang="ts">
interface Props {
  deg?: number
  animation?: boolean
  animationDuration?: number
  bgColor?: string
  gradient?: string[]
}

const {
  deg = 0,
  animation = true,
  animationDuration = 8,
  bgColor = '#ffffff',
  gradient = ['#12a3fc', '#ec51f7'],
} = defineProps<Props>()

const [startColor, endColor] = gradient

const cssVar = computed(() => ({
  '--angle': `${deg}deg`,
  '--animation-duration': `${animationDuration}s`,
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
  border: 2px solid transparent;
  border-radius: 6px;
  background:
    linear-gradient(v-bind(bgColor), v-bind(bgColor)) padding-box,
    linear-gradient(var(--angle), v-bind(startColor), v-bind(endColor)) border-box;
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
