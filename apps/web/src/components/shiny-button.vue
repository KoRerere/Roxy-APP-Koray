<script setup lang="ts">
import { Motion } from "motion-v";

</script>

<template>
  <span class="shiny">
    <Motion as="span" class="relative" :style="{
      maskImage: 'linear-gradient(-75deg,hsl(272, 77%, 76%) calc(var(--x) + 20%),transparent calc(var(--x) + 30%),hsl(272, 77%, 76%) calc(var(--x) + 100%))'
    }" :animate="{ '--x': '-100%' }" :initial="{ '--x': '100%' }" :transition="{
      repeat: Infinity,
      repeatType: 'loop',
      repeatDelay: 3,
      type: 'spring',
      stiffness: 20,
      damping: 15,
      mass: 2
    }">
      <slot></slot>
    </Motion>
    <Motion as="span" class="border" :style="{
      mask: 'linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box,linear-gradient(rgb(0,0,0), rgb(0,0,0))',
      maskComposite: 'exclude'
    }" :animate="{ '--x': '-100%' }" :initial="{ '--x': '100%' }" :transition="{
      repeat: Infinity,
      repeatType: 'loop',
      repeatDelay: 3,
      type: 'spring',
      stiffness: 20,
      damping: 15,
      mass: 2
    }"></Motion>
  </span>
</template>

<style scoped lang="scss">
.shiny {
  --x: 100%;
  position: relative;
  backdrop-filter: blur(24px);
}

.border {
  position: absolute;
  inset: 0;
  z-index: 10;
  border-radius: inherit;
  background-image: linear-gradient(-75deg,
      hsla(272, 77%, 76%, 0%) calc(var(--x) + 20%),
      hsla(272, 77%, 76%, 50%) calc(var(--x) + 25%),
      hsla(272, 77%, 76%, 0%) calc(var(--x) + 100%));
  padding: 1px;
}
</style>