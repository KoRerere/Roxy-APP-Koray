<script setup lang="ts">
interface ColorLevel {
  normal: string
  weak: string
}

const {
  colorLevel: colorLevelProp,
  ratio,
  blockCount,
  defaultColor = 'var(--pattern-sidenav-metrics-progress)',
  shape = 'rect'
} = defineProps<{
  /** 比值 */
  ratio: number
  /** 块数 */
  blockCount: number
  /** 颜色等级 */
  colorLevel: ColorLevel | ((percent: number) => ColorLevel)
  /** 色块的默认颜色 */
  defaultColor?: string
  /** 形状 */
  shape?: 'circle' | 'rect'
}>()

const decimal = computed(() => {
  return ratio * blockCount
})

const percent = computed(() => {
  return Math.ceil(decimal.value)
})

const colorLevel = computed(() => {
  if (typeof colorLevelProp === 'function') {
    return colorLevelProp(percent.value)
  }
  return colorLevelProp
})
</script>

<template>
  <div v-if="shape === 'rect'" class="usage">
    <template v-for="num in blockCount" :key="num">
      <div class="color-block" :class="{ 'color-level': num <= percent, 'last-item': num === percent && decimal % 1 }" />
    </template>
  </div>
  <div v-else-if="shape === 'circle'">
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <g>
        <path d="M9.10081 11.5344C10.2587 9.94061 11.8234 8.68707 13.6314 7.9047C15.4393 7.12233 17.4242 6.83983 19.3787 7.08674"
          :class="{ 'color-level': 1 <= percent, 'last-item': 1 === percent && decimal % 1 }" stroke-width="4" />
        <path d="M21.3992 7.53838C23.2728 8.14714 24.9485 9.24787 26.2512 10.7256C27.554 12.2033 28.436 14.0037 28.8052 15.9388"
          :class="{ 'color-level': 2 <= percent, 'last-item': 2 === percent && decimal % 1 }" stroke-width="4" />
        <path d="M29 18C29 19.97 28.471 21.9038 27.4682 23.5995C26.4654 25.2951 25.0256 26.6903 23.2993 27.6394" :class="{ 'color-level': 3 <= percent, 'last-item': 3 === percent && decimal % 1 }"
          stroke-width="4" />
        <path d="M21.3992 28.4616C19.5256 29.0704 17.523 29.1648 15.6004 28.7351C13.6779 28.3053 11.906 27.3672 10.47 26.0187"
          :class="{ 'color-level': 4 <= percent, 'last-item': 4 === percent && decimal % 1 }" stroke-width="4" />
        <path d="M9.10081 24.4656C7.94289 22.8719 7.23421 20.9964 7.04882 19.0352C6.86343 17.074 7.20813 15.0989 8.0469 13.3164"
          :class="{ 'color-level': 5 <= percent, 'last-item': 5 === percent && decimal % 1 }" stroke-width="4" />
      </g>
    </svg>
  </div>
</template>

<style lang="scss" scoped>
.usage {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  align-self: stretch;

  .color-block {
    height: 8px;
    flex: 1 0 0;
    background: v-bind('defaultColor');

    &:first-of-type {
      border-radius: 6px 0px 0px 6px;
    }

    &:last-of-type {
      border-radius: 0px 6px 6px 0px;
    }

    &.color-level {
      background-color: v-bind('colorLevel.normal');

      &.last-item {
        background-color: v-bind('colorLevel.weak');
      }
    }
  }
}

svg {
  path {
    stroke: v-bind('defaultColor');
  }

  .color-level {
    stroke: v-bind('colorLevel.normal');
  }

  .last-item {
    stroke: v-bind('colorLevel.weak');
  }
}
</style>
