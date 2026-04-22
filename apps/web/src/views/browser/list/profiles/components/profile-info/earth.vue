<script setup lang="tsx">
import { computed } from 'vue'

interface Props {
  duration?: number
  size?: number | string
  autoplay?: boolean
  hoverPause?: boolean
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  duration: 3.5,
  size: 24,
  autoplay: true,
  hoverPause: false,
})

const FRAME_COUNT = 7

const styleVars = computed(() => ({
  '--erh-size': typeof props.size === 'number' ? `${props.size}px` : props.size,
  '--erh-frames': FRAME_COUNT,
  '--erh-duration': `${props.duration}s`,
}))
</script>

<template>
  <div class="erh" :class="{
    'is-paused': !autoplay,
    'is-hover-pause': hoverPause,
  }" :style="styleVars"
  >
    <div class="erh-track">
      <SvgIcon v-for="item in FRAME_COUNT" :key="item" :name="(`other/earth${item}` as any)" :size="size" :color="color" />
    </div>
  </div>
</template>

<style scoped>
.erh {
  width: var(--erh-size);
  height: var(--erh-size);
  overflow: hidden;
}

/* 横向轨道 */
.erh-track {
  display: flex;
  width: calc(var(--erh-size) * var(--erh-frames));
  animation: erh-move var(--erh-duration) steps(var(--erh-frames)) infinite;
}

@keyframes erh-move {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(calc(-1 * var(--erh-size) * var(--erh-frames)));
  }
}

/* 暂停 */
.is-paused .erh-track {
  animation-play-state: paused;
}

/* hover 暂停 */
.is-hover-pause:hover .erh-track {
  animation-play-state: paused;
}
</style>
