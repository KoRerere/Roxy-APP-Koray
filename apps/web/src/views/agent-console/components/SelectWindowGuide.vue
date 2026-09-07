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
  calloutAboveContainer?: boolean
  calloutBelowTarget?: boolean
  interactiveTarget?: boolean
  label: string
  zIndex?: number
  target: HTMLElement | null
  visible: boolean
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const targetRect = ref<SpotlightRect>()
const containerTop = ref<number>()
const targetBorderRadius = ref(0)
const viewportWidth = ref(0)
const viewportHeight = ref(0)

const SPOTLIGHT_PADDING = 5
const CALLOUT_GAP = 37
const GUIDE_LINE_LENGTH = 32
const CALLOUT_EDGE_GAP = 12
const CALLOUT_HALF_WIDTH = 82
const CONTAINER_CALLOUT_GAP = 12

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

const calloutTop = computed(() => {
  const spotlight = spotlightRect.value
  if (props.calloutBelowTarget) {
    return Math.max(CALLOUT_EDGE_GAP, (spotlight?.bottom ?? 0) + CALLOUT_GAP)
  }

  const targetTop = (spotlight?.top ?? 0) - CALLOUT_GAP

  if (!props.calloutAboveContainer || containerTop.value === undefined)
    return Math.max(CALLOUT_EDGE_GAP, targetTop)

  return Math.max(CALLOUT_EDGE_GAP, containerTop.value - CONTAINER_CALLOUT_GAP)
})

const calloutStyle = computed<CSSProperties>(() => {
  const minLeft = CALLOUT_EDGE_GAP + CALLOUT_HALF_WIDTH
  const maxLeft = Math.max(minLeft, viewportWidth.value - CALLOUT_EDGE_GAP - CALLOUT_HALF_WIDTH)
  const left = Math.min(Math.max(targetCenterX.value, minLeft), maxLeft)

  return {
    left: `${left}px`,
    top: `${calloutTop.value}px`,
  }
})

const guideLineStyle = computed<CSSProperties>(() => {
  const spotlight = spotlightRect.value
  if (props.calloutBelowTarget) {
    const lineTop = (spotlight?.bottom ?? 0) + SPOTLIGHT_PADDING
    return {
      left: `${targetCenterX.value}px`,
      top: `${lineTop}px`,
      height: `${Math.max(GUIDE_LINE_LENGTH, calloutTop.value - lineTop)}px`,
    }
  }

  return {
    left: `${targetCenterX.value}px`,
    top: `${calloutTop.value}px`,
    height: `${Math.max(GUIDE_LINE_LENGTH, (spotlight?.top ?? 0) - calloutTop.value - SPOTLIGHT_PADDING)}px`,
  }
})

const targetHitAreaStyle = computed<CSSProperties>(() => {
  const rect = targetRect.value
  if (!rect)
    return {}

  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
})

function readTargetPosition() {
  positionFrame = 0
  if (!props.visible || !props.target) {
    targetRect.value = undefined
    containerTop.value = undefined
    targetBorderRadius.value = 0
    return
  }

  const rect = props.target.getBoundingClientRect()
  const containerRect = props.target.closest('.composer-shell')?.getBoundingClientRect()
  const computedStyle = window.getComputedStyle(props.target)
  const borderRadius = Number.parseFloat(computedStyle.borderTopLeftRadius)

  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
  containerTop.value = containerRect?.top
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

function handleTargetClick() {
  props.target?.click()
}

function unbindTarget() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', schedulePositionSync)
    window.removeEventListener('scroll', schedulePositionSync, true)
  }

  boundTarget?.removeEventListener('click', handleDismiss)
  resizeObserver?.disconnect()
  resizeObserver = undefined
  boundTarget = null
  boundShell = null
}

function bindTarget() {
  unbindTarget()
  targetRect.value = undefined
  containerTop.value = undefined
  targetBorderRadius.value = 0

  if (!props.visible || !props.target || typeof window === 'undefined')
    return

  boundTarget = props.target
  boundShell = props.target.closest('.composer-shell')
  boundTarget.addEventListener('click', handleDismiss)
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
      :style="zIndex === undefined ? undefined : { zIndex }"
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
        />
      </svg>

      <div class="select-window-guide__callout" :class="{ 'select-window-guide__callout--below-target': calloutBelowTarget }" :style="calloutStyle">
        <span class="select-window-guide__label">{{ label }}</span>
        <button type="button" class="select-window-guide__skip" @click.stop="handleDismiss">
          {{ $t('跳过') }}
        </button>
      </div>

      <div class="select-window-guide__line" :class="{ 'select-window-guide__line--below-target': calloutBelowTarget }" :style="guideLineStyle" aria-hidden="true">
        <span />
      </div>

      <button
        v-if="interactiveTarget"
        class="select-window-guide__target-hit-area"
        type="button"
        :aria-label="label"
        :style="targetHitAreaStyle"
        @click.stop="handleTargetClick"
      />
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
:global(body.agent-console-window) {
  --select-window-guide-mask: rgba(15, 15, 15, 0.48);
  --select-window-guide-callout-shadow: 0 8px 24px rgba(15, 15, 15, 0.2);
  --select-window-guide-accent-ring: rgba(238, 70, 188, 0.4);
  --select-window-guide-skip-bg: var(--color-bg-primary);
  --select-window-guide-skip-border: var(--border-width-border, 1px) solid var(--color-border-secondary);
  --select-window-guide-skip-color: var(--color-text-primary);
}

:global(html[data-theme='dark'] body.agent-console-window),
:global(html.app-dark body.agent-console-window) {
  --select-window-guide-mask: rgba(38, 38, 38, 0.8);
  --select-window-guide-callout-shadow: var(--agent-floating-banner-shadow, 0 12px 32px rgba(0, 0, 0, 0.28));
  --select-window-guide-accent-ring: rgba(250, 167, 223, 0.4);
  --select-window-guide-skip-bg: var(--color-bg-primary-inverse);
  --select-window-guide-skip-border: 0;
  --select-window-guide-skip-color: var(--color-bg-primary);
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
  display: flex;
  max-width: calc(100vw - 24px);
  min-width: 180px;
  align-items: stretch;
  flex-direction: column;
  gap: 8px;
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
  pointer-events: auto;
}

.select-window-guide__callout--below-target {
  transform: translate(-50%, 0);
}

.select-window-guide__label {
  white-space: normal;
}

.select-window-guide__skip {
  box-sizing: border-box;
  display: inline-flex;
  height: 32px;
  align-items: center;
  align-self: flex-end;
  justify-content: center;
  padding: 6px 10px;
  border: var(--select-window-guide-skip-border);
  border-radius: 10px;
  color: var(--select-window-guide-skip-color);
  background: var(--select-window-guide-skip-bg);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}

.select-window-guide__skip:hover {
  filter: saturate(1.08) brightness(0.98);
}

:global(html[data-theme='dark'] body.agent-console-window .select-window-guide__skip:hover),
:global(html.app-dark body.agent-console-window .select-window-guide__skip:hover) {
  background: var(--color-bg-primary-inverse-hover);
  filter: none;
}

.select-window-guide__skip:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
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

.select-window-guide__line--below-target span {
  top: -9px;
  bottom: auto;
}

.select-window-guide__target-hit-area {
  position: fixed;
  z-index: 3;
  padding: 0;
  border: 0;
  border-radius: inherit;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
}
</style>
