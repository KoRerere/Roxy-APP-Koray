<!-- <script lang="ts" setup>
withDefaults(
  defineProps<{
    class?: string
    reverse?: boolean
    pauseOnHover?: boolean
    vertical?: boolean
    repeat?: number
  }>(),
  {
    pauseOnHover: false,
    vertical: false,
    repeat: 4,
  },
)
</script>

<template>
  <div class="group flex overflow-hidden p-16px [--duration:40s] [--gap:1rem] [gap:var(--gap)]" :class="[
    vertical ? 'flex-col' : 'flex-row',
    $props.class,
  ]">
    <div v-for="index in repeat" :key="index" class="flex shrink-0 justify-around [gap:var(--gap)]" :class="[
      vertical ? 'animate-marquee-vertical flex-col' : 'animate-marquee flex-row',
      pauseOnHover ? 'group-hover:[animation-play-state:paused]' : '',
    ]" :style="{
      animationDirection: reverse ? 'reverse' : 'normal',
    }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.animate-marquee {
  animation: marquee var(--duration) linear infinite;
  animation-direction: reverse;
}

.animate-marquee-vertical {
  animation: marquee-vertical var(--duration) linear infinite;
}

@keyframes marquee {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(calc(-100% - var(--gap)));
  }
}

@keyframes marquee-vertical {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(calc(-100% - var(--gap)));
  }
}
</style> -->

<script lang="ts" setup>
import { motion } from 'motion-v'
withDefaults(
  defineProps<{
    class?: string
    reverse?: boolean
    vertical?: boolean
    duration?: number
  }>(),
  {
    vertical: false,
    duration: 40
  },
)
</script>

<template>
  <div class="group flex overflow-hidden p-16px [--gap:1rem] [gap:var(--gap)]" :class="[
    vertical ? 'flex-col' : 'flex-row',
    $props.class,
  ]">
    <motion.div class="flex shrink-0 justify-around [gap:var(--gap)]" :class="[
      vertical ? 'flex-col' : 'flex-row',
    ]" :animate="vertical ? {
      y: reverse ? ['-40%', 0] : [0, '-100%']
    } : {
      x: reverse ? ['-40%', 0] : [0, '-100%']
    }" :transition="{
      duration: duration,
      repeat: Infinity,
      // repeatType: reverse ? 'reverse' : 'loop'
    }">
      <slot />
    </motion.div>
  </div>
</template>
