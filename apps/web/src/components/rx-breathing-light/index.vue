<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'

/**
 * 贴边呼吸光带：用于引导用户注意某个容器（如双抽屉购买区）。
 * 光层不占布局、不拦截事件；用 runKey 强制重建节点，连点可立刻重启动画。
 */
const props = withDefaults(defineProps<{
  /** 光色，默认品牌色 */
  color?: string
  /** 圆角；数字按 px，也可传 CSS 值如 "8px" / "50%" / "var(--radius-lg)" */
  radius?: number | string
  /** 边框光粗细(px) */
  thickness?: number
  /** 外发光扩散半径(px) */
  glow?: number
  /** 一次完整呼吸时长(ms)，结束后自动消失 */
  duration?: number
  /**
   * 光带相对容器边框的偏移(px)。
   * 正数向外扩（与 demo 一致，光晕在容器外）；负数向内收。
   * 外扩时父级不可 overflow:hidden，否则会被裁切。
   */
  offset?: number
  /** 是否以 inline-block 包裹（适合按钮等行内元素） */
  inline?: boolean
  /** 是否撑满父级高度（抽屉等 flex 容器内使用） */
  fill?: boolean
  /**
   * 纯视觉覆盖层：绝对定位铺满父级，不包裹内容。
   * 适合抽屉等已有独立内容树的场景，光带贴父级外框而非内容内侧。
   */
  overlay?: boolean
}>(), {
  color: 'var(--colors-border-border-brand, #11a3fd)',
  radius: 8,
  thickness: 1.5,
  glow: 18,
  duration: 2600,
  offset: 0,
  inline: false,
  fill: false,
  overlay: false,
})

const emit = defineEmits<{
  start: []
  end: []
}>()

const running = ref(false)
/** 每次触发递增，强制重建光层以重启 CSS animation */
const runKey = ref(0)

const cssVars = computed(() => {
  const radius = typeof props.radius === 'number' ? `${props.radius}px` : props.radius
  // 外扩时同步加大圆角，保持与容器同心（demo offset=0 时等于原圆角）
  const layerRadius = props.offset > 0
    ? (typeof props.radius === 'number'
        ? `${props.radius + props.offset}px`
        : `calc(${radius} + ${props.offset}px)`)
    : radius

  return {
    '--bl-color': props.color,
    '--bl-radius': layerRadius,
    '--bl-thickness': `${props.thickness}px`,
    '--bl-glow': `${props.glow}px`,
    '--bl-duration': `${props.duration}ms`,
    '--bl-offset': `${-props.offset}px`,
  }
})

const { start: startEndTimer, stop: stopEndTimer } = useTimeoutFn(() => {
  running.value = false
  emit('end')
}, () => props.duration, { immediate: false })

/** 触发一次呼吸；若已在播放则从头重播 */
function trigger() {
  stopEndTimer()
  runKey.value += 1
  running.value = true
  emit('start')
  startEndTimer()
}

/** 立刻熄灭并取消定时 */
function stop() {
  stopEndTimer()
  if (running.value) {
    running.value = false
    emit('end')
  }
}

/** 亮着打断，灭着点亮 */
function toggle() {
  running.value ? stop() : trigger()
}

defineExpose({ trigger, stop, toggle, running })
</script>

<template>
  <div class="bl-wrap" :class="{
    'bl-inline': inline,
    'bl-fill': fill,
    'bl-overlay': overlay,
    'bl-active': running,
  }" :style="cssVars" :data-active="running || undefined"
  >
    <slot v-if="!overlay" />

    <!-- 光带仅视觉层：inset 跟随容器尺寸，任意大小都能贴边 -->
    <template v-if="running">
      <span :key="`ring-${runKey}`" class="bl-layer bl-ring" aria-hidden="true" />
      <span :key="`glow-${runKey}`" class="bl-layer bl-glow" aria-hidden="true" />
    </template>
  </div>
</template>

<style scoped>
.bl-wrap {
  position: relative;
  display: block;
  min-height: 0;
}

.bl-inline {
  display: inline-block;
}

.bl-fill {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 0;
}

/* 覆盖在已有容器上：尺寸跟父级走，不参与布局、不挡点击 */
.bl-overlay {
  position: absolute;
  inset: 0;
  display: block;
  pointer-events: none;
}

/* 播放时抬高，避免被相邻抽屉盖住外扩光晕 */
.bl-active {
  z-index: 2;
  overflow: visible;
}

.bl-layer {
  position: absolute;
  inset: var(--bl-offset);
  border-radius: var(--bl-radius);
  pointer-events: none;
  opacity: 0;
}

/* 贴边清晰光边（与 demo 一致） */
.bl-ring {
  border: var(--bl-thickness) solid var(--bl-color);
  box-shadow:
    0 0 calc(var(--bl-glow) * 0.45) var(--bl-color),
    inset 0 0 calc(var(--bl-glow) * 0.35) var(--bl-color);
  animation: bl-breathe var(--bl-duration) cubic-bezier(0.4, 0, 0.6, 1) both;
}

/* 外扩柔和光晕，时序略错开以增加层次（与 demo 一致） */
.bl-glow {
  border: 1px solid var(--bl-color);
  box-shadow: 0 0 var(--bl-glow) calc(var(--bl-glow) * 0.25) var(--bl-color);
  filter: blur(calc(var(--bl-glow) * 0.25));
  animation: bl-breathe-soft var(--bl-duration) cubic-bezier(0.4, 0, 0.6, 1) both;
}

/* 亮起 → 回落 → 再亮 → 消失（约两拍呼吸） */
@keyframes bl-breathe {
  0% {
    opacity: 0;
  }

  16% {
    opacity: 1;
  }

  42% {
    opacity: 0.38;
  }

  68% {
    opacity: 0.95;
  }

  100% {
    opacity: 0;
  }
}

@keyframes bl-breathe-soft {
  0% {
    opacity: 0;
  }

  20% {
    opacity: 0.75;
  }

  46% {
    opacity: 0.2;
  }

  72% {
    opacity: 0.65;
  }

  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bl-ring,
  .bl-glow {
    animation-duration: 1ms;
    animation-iteration-count: 1;
    opacity: 0;
  }
}
</style>
