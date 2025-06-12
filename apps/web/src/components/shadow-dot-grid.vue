<script setup lang="ts">
const styles = computed(() => {
  let shadows = [];
  const num = 100;
  const spacing = 24;
  for (let y = 0; y < num; y++) {
    for (let x = 0; x < num; x++) {
      // if (x === 0 && y === 0) continue; // 原始点不加
      shadows.push(`${x * spacing}px ${y * spacing}px var(--colors-background-bg-mode-reverse)`);
    }
  }

  return {
    boxShadow: shadows.join(', '),
    opacity: 0.1,
  }
})
</script>

<template>
  <div class="absolute inset-0 bg-[var(--colors-background-bg-example)] w-full h-full" v-bind="$attrs">
    <div class="size-2px rounded-full translate-x-[-10px] translate-y-[-10px]" :style="styles"></div>
  </div>
</template>