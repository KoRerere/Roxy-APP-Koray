<template>
  <div
    class="text-6xl font-bold"
    :class="props.class"
  >
    <span class="relative inline-block">
      <template
        v-for="sparkle in sparkles"
        :key="sparkle.id"
      >
        <!-- Animated star SVG with fade, scale, and rotation effects -->
        <Motion
          :initial="{ opacity: 0, scale: 0, rotate: 75 }"
          :animate="{
            opacity: [0, 1, 0],
            scale: [0, sparkle.scale, 0],
            rotate: [75, 120, 150],
          }"
          :transition="{
            duration: 0.8,
            repeat: 0,
            delay: sparkle.delay,
          }"
          as="svg"
          class="pointer-events-none absolute z-20"
          :style="{
            left: sparkle.x,
            top: sparkle.y,
            opacity: 0,
          }"
          width="21"
          height="21"
          viewBox="0 0 21 21"
        >
          <path
            d="M9.82531 0.843845C10.0553 0.215178 10.9446 0.215178 11.1746 0.843845L11.8618 2.72026C12.4006 4.19229 12.3916 6.39157 13.5 7.5C14.6084 8.60843 16.8077 8.59935 18.2797 9.13822L20.1561 9.82534C20.7858 10.0553 20.7858 10.9447 20.1561 11.1747L18.2797 11.8618C16.8077 12.4007 14.6084 12.3916 13.5 13.5C12.3916 14.6084 12.4006 16.8077 11.8618 18.2798L11.1746 20.1562C10.9446 20.7858 10.0553 20.7858 9.82531 20.1562L9.13819 18.2798C8.59932 16.8077 8.60843 14.6084 7.5 13.5C6.39157 12.3916 4.19225 12.4007 2.72023 11.8618L0.843814 11.1747C0.215148 10.9447 0.215148 10.0553 0.843814 9.82534L2.72023 9.13822C4.19225 8.59935 6.39157 8.60843 7.5 7.5C8.60843 6.39157 8.59932 4.19229 9.13819 2.72026L9.82531 0.843845Z"
            :fill="sparkle.color"
          />
        </Motion>
      </template>
      <slot></slot>
    </span>
  </div>
</template>

<script setup lang="ts">
import { Motion } from "motion-v";
import { ref, onMounted, onUnmounted } from "vue";

interface Sparkle {
  id: string;
  x: string;
  y: string;
  color: string;
  delay: number;
  scale: number;
  lifespan: number;
  order: number;
}

interface Props {
  text?: string;
  sparklesCount?: number;
  colors?: {
    first: string;
    second: string;
    third: string;
  };
  class?: string;
  cycleInterval?: number;
  starDelay?: number;
  randomOrder?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  sparklesCount: 3,
  colors: () => ({ first: "#7EC9FF", second: "#FE8BBB", third: "#9E7AFF" }),
  cycleInterval: 5,
  starDelay: 0.2,
  randomOrder: true,
});

const sparkles = ref<Sparkle[]>([]);

let cycleTimeout: number | null = null;

function initializeStars() {
  // 使用3个固定位置的星星，而不是随机生成
  sparkles.value = [
    { id: '1', x: '-20%', y: '20%', color: props.colors.first, delay: 0, scale: 0.6, lifespan: props.cycleInterval, order: 0 },
    { id: '2', x: '90%', y: '-15%', color: props.colors.second, delay: 0.3, scale: 0.5, lifespan: props.cycleInterval, order: 1 },
    { id: '3', x: '65%', y: '85%', color: props.colors.third, delay: 0.6, scale: 0.6, lifespan: props.cycleInterval, order: 2 },
  ];
  
  scheduleNextCycle();
}

function scheduleNextCycle() {
  if (cycleTimeout) {
    window.clearTimeout(cycleTimeout);
  }
  
  const maxDelay = Math.max(...sparkles.value.map(s => s.delay));
  const totalDuration = maxDelay + 0.8 + 0.5;
  
  cycleTimeout = window.setTimeout(() => {
    regenerateStars();
  }, totalDuration * 1000);
}

function regenerateStars() {
  // 重用相同的3个固定星星，只更新ID、order和delay使动画重新触发并随机化顺序和延迟
  const orders = [0, 1, 2];
  // 随机打乱顺序
  for (let i = orders.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [orders[i], orders[j]] = [orders[j], orders[i]];
  }
  
  sparkles.value = [
    { 
      id: `1-${Date.now()}`, 
      x: '-20%', 
      y: '20%', 
      color: props.colors.first, 
      delay: orders[0] * props.starDelay, 
      scale: 0.6, 
      lifespan: props.cycleInterval, 
      order: orders[0] 
    },
    { 
      id: `2-${Date.now()}`, 
      x: '90%', 
      y: '-15%', 
      color: props.colors.second, 
      delay: orders[1] * props.starDelay, 
      scale: 0.5, 
      lifespan: props.cycleInterval, 
      order: orders[1] 
    },
    { 
      id: `3-${Date.now()}`, 
      x: '65%', 
      y: '85%', 
      color: props.colors.third, 
      delay: orders[2] * props.starDelay, 
      scale: 0.6, 
      lifespan: props.cycleInterval, 
      order: orders[2] 
    },
  ];
  
  scheduleNextCycle();
}

onMounted(() => {
  initializeStars();
});

onUnmounted(() => {
  if (cycleTimeout) {
    window.clearTimeout(cycleTimeout);
  }
});
</script>