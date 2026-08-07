<script setup lang="ts">
import type { CSSProperties } from 'vue'

interface SpotlightRect {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

const props = defineProps<{
  label: string
  target: HTMLElement | null
  visible: boolean
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const targetRect = ref<SpotlightRect>()
const targetBorderRadius = ref(0)
const viewportWidth = ref(0)
const viewportHeight = ref(0)

const SPOTLIGHT_PADDING = 5
const CALLOUT_GAP = 37
const GUIDE_LINE_LENGTH = 32
const CALLOUT_EDGE_GAP = 12
const CALLOUT_HALF_WIDTH = 82

let positionFrame = 0
let resizeObserver: ResizeObserver | undefined
let boundTarget: HTMLElement | null = null
let boundShell: Element | null = null

const spotlightRect = computed<SpotlightRect | undefined>(() => {
  const rect = targetRect.value
  if (!rect)
    return undefined

  const left = Math.max(0, rect.left - SPOTLIGHT_PADDING)
  const top = Math.max(0, rect.top - SPOTLIGHT_PADDING)
  const right = Math.min(viewportWidth.value, rect.right + SPOTLIGHT_PADDING)
  const bottom = Math.min(viewportHeight.value, rect.bottom + SPOTLIGHT_PADDING)

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
})

const spotlightRadius = computed(() => {
  const rect = spotlightRect.value
  if (!rect)
    return 0

  return Math.min(targetBorderRadius.value, rect.width / 2, rect.height / 2)
})

const spotlightPath = computed(() => {
  const rect = spotlightRect.value
  if (!rect)
    return ''

  const { left, top, right, bottom } = rect
  const radius = spotlightRadius.value

  return [
    `M 0 0 H ${viewportWidth.value} V ${viewportHeight.value} H 0 Z`,
    `M ${left + radius} ${top}`,
    `H ${right - radius}`,
    `A ${radius} ${radius} 0 0 1 ${right} ${top + radius}`,
    `V ${bottom - radius}`,
    `A ${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`,
    `H ${left + radius}`,
    `A ${radius} ${radius} 0 0 1 ${left} ${bottom - radius}`,
    `V ${top + radius}`,
    `A ${radius} ${radius} 0 0 1 ${left + radius} ${top}`,
    'Z',
  ].join(' ')
})

const hasSpotlightTarget = computed(() => {
  const rect = spotlightRect.value
  return props.visible && Boolean(rect?.width && rect.height)
})

const targetCenterX = computed(() => {
  const rect = targetRect.value
  if (!rect)
    return 0

  return rect.left + rect.width / 2
})

const calloutStyle = computed<CSSProperties>(() => {
  const spotlight = spotlightRect.value
  const minLeft = CALLOUT_EDGE_GAP + CALLOUT_HALF_WIDTH
  const maxLeft = Math.max(minLeft, viewportWidth.value - CALLOUT_EDGE_GAP - CALLOUT_HALF_WIDTH)
  const left = Math.min(Math.max(targetCenterX.value, minLeft), maxLeft)

  return {
    left: `${left}px`,
    top: `${Math.max(CALLOUT_EDGE_GAP, (spotlight?.top ?? 0) - CALLOUT_GAP)}px`,
  }
})

const guideLineStyle = computed<CSSProperties>(() => ({
  left: `${targetCenterX.value}px`,
  top: `${Math.max(CALLOUT_EDGE_GAP, (spotlightRect.value?.top ?? 0) - CALLOUT_GAP)}px`,
  height: `${GUIDE_LINE_LENGTH}px`,
}))

function readTargetPosition() {
  positionFrame = 0
  if (!props.visible || !props.target) {
    targetRect.value = undefined
    targetBorderRadius.value = 0
    return
  }

  const rect = props.target.getBoundingClientRect()
  const computedStyle = window.getComputedStyle(props.target)
  const borderRadius = Number.parseFloat(computedStyle.borderTopLeftRadius)

  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
  targetBorderRadius.value = Number.isFinite(borderRadius) ? borderRadius : 0
  targetRect.value = {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

function schedulePositionSync() {
  if (typeof window === 'undefined' || positionFrame)
    return

  positionFrame = window.requestAnimationFrame(readTargetPosition)
}

function handleDismiss() {
  emit('dismiss')
}

function unbindTarget() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('blur', handleDismiss)
    window.removeEventListener('resize', schedulePositionSync)
    window.removeEventListener('scroll', schedulePositionSync, true)
  }

  boundTarget?.removeEventListener('blur', handleDismiss)
  boundTarget?.removeEventListener('click', handleDismiss)
  resizeObserver?.disconnect()
  resizeObserver = undefined
  boundTarget = null
  boundShell = null
}

function bindTarget() {
  unbindTarget()
  targetRect.value = undefined
  targetBorderRadius.value = 0

  if (!props.visible || !props.target || typeof window === 'undefined')
    return

  boundTarget = props.target
  boundShell = props.target.closest('.composer-shell')
  boundTarget.addEventListener('blur', handleDismiss)
  boundTarget.addEventListener('click', handleDismiss)
  window.addEventListener('blur', handleDismiss)
  window.addEventListener('resize', schedulePositionSync)
  window.addEventListener('scroll', schedulePositionSync, true)

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(schedulePositionSync)
    resizeObserver.observe(boundTarget)
    if (boundShell)
      resizeObserver.observe(boundShell)
  }

  schedulePositionSync()
}

watch(
  [() => props.visible, () => props.target],
  () => bindTarget(),
  { flush: 'post', immediate: true },
)

onBeforeUnmount(() => {
  if (positionFrame)
    window.cancelAnimationFrame(positionFrame)
  unbindTarget()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="hasSpotlightTarget"
      class="select-window-guide"
      role="dialog"
      :aria-label="label"
      @touchmove.prevent
      @wheel.prevent
    >
      <svg
        class="select-window-guide__mask"
        :width="viewportWidth"
        :height="viewportHeight"
        :viewBox="`0 0 ${viewportWidth} ${viewportHeight}`"
        aria-hidden="true"
      >
        <path
          :d="spotlightPath"
          fill-rule="evenodd"
          clip-rule="evenodd"
          @pointerdown="handleDismiss"
        />
      </svg>

      <div class="select-window-guide__callout" :style="calloutStyle">
        {{ label }}
      </div>

      <div class="select-window-guide__line" :style="guideLineStyle" aria-hidden="true">
        <span />
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
:global(body.agent-console-window) {
  --select-window-guide-mask: rgba(15, 15, 15, 0.48);
  --select-window-guide-callout-shadow: 0 8px 24px rgba(15, 15, 15, 0.2);
  --select-window-guide-accent-ring: rgba(238, 70, 188, 0.4);
}

:global(html[data-theme='dark'] body.agent-console-window),
:global(html.app-dark body.agent-console-window) {
  --select-window-guide-mask: rgba(38, 38, 38, 0.8);
  --select-window-guide-callout-shadow: var(--agent-floating-banner-shadow, 0 12px 32px rgba(0, 0, 0, 0.28));
  --select-window-guide-accent-ring: rgba(250, 167, 223, 0.4);
}

.select-window-guide {
  position: fixed;
  inset: 0;
  z-index: 12000;
  pointer-events: none;
}

.select-window-guide__mask {
  position: fixed;
  inset: 0;
  z-index: 0;
  display: block;
  pointer-events: none;

  path {
    fill: var(--select-window-guide-mask, rgba(15, 15, 15, 0.48));
    pointer-events: auto;
    touch-action: none;
  }
}

.select-window-guide__callout {
  position: fixed;
  z-index: 2;
  max-width: calc(100vw - 24px);
  padding: 12px;
  transform: translate(-50%, -100%);
  border-radius: 12px;
  color: var(--color-text-primary-inverse, #fcfcfc);
  background: var(--color-bg-primary-inverse, #0f0f0f);
  box-sizing: border-box;
  box-shadow: var(--select-window-guide-callout-shadow, 0 8px 24px rgba(15, 15, 15, 0.2));
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  pointer-events: none;
  text-align: center;
  white-space: nowrap;
}

.select-window-guide__line {
  position: fixed;
  z-index: 1;
  width: 1px;
  transform: translateX(-50%);
  background: var(--color-bg-primary-inverse, #0f0f0f);
  pointer-events: none;
}

.select-window-guide__line span {
  position: absolute;
  bottom: -9px;
  left: 50%;
  width: 9px;
  height: 9px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: var(--color-fg-pink, #ee46bc);
  box-shadow: 0 0 0 3px var(--select-window-guide-accent-ring, rgba(238, 70, 188, 0.4));
}
</style>
