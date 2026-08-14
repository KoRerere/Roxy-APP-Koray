<script setup lang="ts">
import type { CSSProperties } from 'vue'

interface Rect {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

const props = defineProps<{
  container: HTMLElement | null
  label: string
  target: HTMLElement | null
  visible: boolean
}>()

const containerRect = ref<Rect>()
const targetRect = ref<Rect>()
const targetRadius = ref(0)
const SPOTLIGHT_PADDING = 5
const CALLOUT_GAP = 37
const GUIDE_LINE_LENGTH = 32
const CALLOUT_EDGE_GAP = 12
const CALLOUT_MAX_WIDTH = 280

let positionFrame = 0
let resizeObserver: ResizeObserver | undefined

function toRect(rect: DOMRect): Rect {
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  }
}

const localTargetRect = computed<Rect | undefined>(() => {
  const container = containerRect.value
  const target = targetRect.value
  if (!container || !target)
    return undefined

  const left = Math.max(0, target.left - container.left - SPOTLIGHT_PADDING)
  const top = Math.max(0, target.top - container.top - SPOTLIGHT_PADDING)
  const right = Math.min(container.width, target.right - container.left + SPOTLIGHT_PADDING)
  const bottom = Math.min(container.height, target.bottom - container.top + SPOTLIGHT_PADDING)

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
})

const guideVisible = computed(() => {
  const container = containerRect.value
  const target = localTargetRect.value
  return props.visible && Boolean(container?.width && container.height && target?.width && target.height)
})

const overlayStyle = computed<CSSProperties>(() => {
  const rect = containerRect.value
  if (!rect)
    return {}

  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
})

const spotlightPath = computed(() => {
  const container = containerRect.value
  const target = localTargetRect.value
  if (!container || !target)
    return ''

  const radius = Math.min(targetRadius.value, target.width / 2, target.height / 2)
  return [
    `M 0 0 H ${container.width} V ${container.height} H 0 Z`,
    `M ${target.left + radius} ${target.top}`,
    `H ${target.right - radius}`,
    `A ${radius} ${radius} 0 0 1 ${target.right} ${target.top + radius}`,
    `V ${target.bottom - radius}`,
    `A ${radius} ${radius} 0 0 1 ${target.right - radius} ${target.bottom}`,
    `H ${target.left + radius}`,
    `A ${radius} ${radius} 0 0 1 ${target.left} ${target.bottom - radius}`,
    `V ${target.top + radius}`,
    `A ${radius} ${radius} 0 0 1 ${target.left + radius} ${target.top}`,
    'Z',
  ].join(' ')
})

const targetCenterX = computed(() => {
  const target = localTargetRect.value
  return target ? target.left + target.width / 2 : 0
})

const calloutStyle = computed<CSSProperties>(() => {
  const container = containerRect.value
  const target = localTargetRect.value
  if (!container || !target)
    return {}

  const availableWidth = Math.max(0, container.width - CALLOUT_EDGE_GAP * 2)
  const calloutWidth = Math.min(CALLOUT_MAX_WIDTH, availableWidth)
  const calloutHalfWidth = calloutWidth / 2
  const minLeft = CALLOUT_EDGE_GAP + calloutHalfWidth
  const maxLeft = Math.max(minLeft, container.width - CALLOUT_EDGE_GAP - calloutHalfWidth)
  return {
    left: `${Math.min(Math.max(targetCenterX.value, minLeft), maxLeft)}px`,
    top: `${Math.max(CALLOUT_EDGE_GAP, target.top - CALLOUT_GAP)}px`,
    maxWidth: `${availableWidth}px`,
  }
})

const guideLineStyle = computed<CSSProperties>(() => {
  const target = localTargetRect.value
  if (!target)
    return {}

  return {
    left: `${targetCenterX.value}px`,
    top: `${Math.max(CALLOUT_EDGE_GAP, target.top - CALLOUT_GAP)}px`,
    height: `${GUIDE_LINE_LENGTH}px`,
  }
})

const hitAreaStyle = computed<CSSProperties>(() => {
  const target = localTargetRect.value
  if (!target)
    return {}

  return {
    left: `${target.left + SPOTLIGHT_PADDING}px`,
    top: `${target.top + SPOTLIGHT_PADDING}px`,
    width: `${Math.max(0, target.width - SPOTLIGHT_PADDING * 2)}px`,
    height: `${Math.max(0, target.height - SPOTLIGHT_PADDING * 2)}px`,
  }
})

function readPosition() {
  positionFrame = 0
  if (!props.visible || !props.container || !props.target) {
    containerRect.value = undefined
    targetRect.value = undefined
    return
  }

  const container = props.container.getBoundingClientRect()
  const target = props.target.getBoundingClientRect()
  const borderRadius = Number.parseFloat(window.getComputedStyle(props.target).borderTopLeftRadius)

  containerRect.value = toRect(container)
  targetRect.value = toRect(target)
  targetRadius.value = Number.isFinite(borderRadius) ? borderRadius : 0
}

function schedulePositionSync() {
  if (typeof window === 'undefined' || positionFrame)
    return
  positionFrame = window.requestAnimationFrame(readPosition)
}

function unbind() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', schedulePositionSync)
    window.removeEventListener('scroll', schedulePositionSync, true)
  }
  resizeObserver?.disconnect()
  resizeObserver = undefined
}

function bind() {
  unbind()
  if (!props.visible || !props.container || !props.target || typeof window === 'undefined')
    return

  window.addEventListener('resize', schedulePositionSync)
  window.addEventListener('scroll', schedulePositionSync, true)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(schedulePositionSync)
    resizeObserver.observe(props.container)
    resizeObserver.observe(props.target)
  }
  schedulePositionSync()
}

function handleTargetClick() {
  props.target?.click()
}

watch(
  [() => props.visible, () => props.container, () => props.target],
  bind,
  { flush: 'post', immediate: true },
)

onBeforeUnmount(() => {
  if (positionFrame)
    window.cancelAnimationFrame(positionFrame)
  unbind()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="guideVisible" class="onboarding-send-guide" :style="overlayStyle" role="dialog" :aria-label="label">
      <svg class="onboarding-send-guide__mask" width="100%" height="100%" :viewBox="`0 0 ${containerRect?.width ?? 0} ${containerRect?.height ?? 0}`" aria-hidden="true">
        <path :d="spotlightPath" fill-rule="evenodd" clip-rule="evenodd" />
      </svg>
      <div class="onboarding-send-guide__callout" :style="calloutStyle">
        {{ label }}
      </div>
      <div class="onboarding-send-guide__line" :style="guideLineStyle" aria-hidden="true">
        <span />
      </div>
      <button class="onboarding-send-guide__hit-area" type="button" :aria-label="label" :style="hitAreaStyle" @click.stop="handleTargetClick" />
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.onboarding-send-guide {
  position: fixed;
  z-index: 2147483100;
  overflow: hidden;
  pointer-events: none;
}

.onboarding-send-guide__mask {
  position: absolute;
  inset: 0;
  display: block;
  pointer-events: none;
}

.onboarding-send-guide__mask path {
  fill: rgba(15, 15, 15, 0.48);
  pointer-events: auto;
  touch-action: none;
}

.onboarding-send-guide__callout {
  position: absolute;
  z-index: 2;
  width: max-content;
  max-width: min(280px, calc(100% - 24px));
  padding: 12px;
  transform: translate(-50%, -100%);
  border-radius: 12px;
  color: var(--color-text-primary-inverse, #fcfcfc);
  background: var(--color-bg-primary-inverse, #0f0f0f);
  box-shadow: 0 8px 24px rgba(15, 15, 15, 0.2);
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
  text-align: center;
  white-space: normal;
  box-sizing: border-box;
}

.onboarding-send-guide__line {
  position: absolute;
  z-index: 1;
  width: 1px;
  transform: translateX(-50%);
  background: var(--color-bg-primary-inverse, #0f0f0f);
}

.onboarding-send-guide__line span {
  position: absolute;
  bottom: -9px;
  left: 50%;
  width: 9px;
  height: 9px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: var(--color-fg-pink, #ee46bc);
  box-shadow: 0 0 0 3px rgba(238, 70, 188, 0.4);
}

.onboarding-send-guide__hit-area {
  position: absolute;
  z-index: 3;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
}
</style>
