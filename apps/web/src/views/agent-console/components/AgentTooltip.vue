<script setup lang="ts">
import domAlign from 'dom-align'
import { AnimatePresence, motion } from 'motion-v'

type Trigger = 'hover' | 'click'
type Placement = 'top' | 'top-start' | 'bottom' | 'bottom-start'

const props = withDefaults(defineProps<{
  content?: string
  trigger?: Trigger
  placement?: Placement
  offset?: number
  showArrow?: boolean
  disabled?: boolean
  contentClass?: string
  triggerClass?: string
  zIndex?: number
  showDelay?: number
  hideDelay?: number
}>(), {
  trigger: 'hover',
  placement: 'top',
  offset: 8,
  showArrow: true,
  zIndex: 70,
  showDelay: 200,
  hideDelay: 120,
})

const emit = defineEmits<{
  openChange: [open: boolean]
}>()

const triggerRef = useTemplateRef<HTMLSpanElement>('triggerRef')
const popupRef = useTemplateRef<HTMLDivElement>('popupRef')

const mounted = ref(false)
const visible = ref(false)
const arrowX = ref('50%')
let openTimer: NodeJS.Timeout | null = null
let closeTimer: NodeJS.Timeout | null = null
let outsideListenerTimer: NodeJS.Timeout | null = null

const alignConfig = computed(() => {
  if (props.placement === 'top-start') {
    return {
      points: ['bl', 'tl'],
      offset: [0, -props.offset],
      initial: { opacity: 0, y: 8, scale: 0.98 },
      transformOrigin: 'left bottom',
    }
  }

  if (props.placement === 'bottom') {
    return {
      points: ['tc', 'bc'],
      offset: [0, props.offset],
      initial: { opacity: 0, y: -8, scale: 0.98 },
      transformOrigin: 'center top',
    }
  }

  if (props.placement === 'bottom-start') {
    return {
      points: ['tl', 'bl'],
      offset: [0, props.offset],
      initial: { opacity: 0, y: -8, scale: 0.98 },
      transformOrigin: 'left top',
    }
  }

  return {
    points: ['bc', 'tc'],
    offset: [0, -props.offset],
    initial: { opacity: 0, y: 8, scale: 0.98 },
    transformOrigin: 'center bottom',
  }
})

const isTopPlacement = computed(() => props.placement.startsWith('top'))

function align() {
  if (!popupRef.value || !triggerRef.value) {
    return
  }

  domAlign(popupRef.value, triggerRef.value, {
    points: alignConfig.value.points,
    offset: alignConfig.value.offset,
    targetOffset: [0, 0],
    overflow: {
      adjustX: true,
      adjustY: false,
    },
    useCssTransform: true,
    ignoreShake: true,
  })

  updateArrowPosition()
}

function updateArrowPosition() {
  if (!props.showArrow || !popupRef.value || !triggerRef.value) {
    return
  }

  const contentEl = popupRef.value.querySelector<HTMLElement>('.agent-tooltip__content')
  if (!contentEl) {
    return
  }

  const triggerRect = triggerRef.value.getBoundingClientRect()
  const popupRect = popupRef.value.getBoundingClientRect()
  const triggerCenterX = triggerRect.left + triggerRect.width / 2
  const rawArrowX = triggerCenterX - popupRect.left
  const minArrowX = 10
  const maxArrowX = Math.max(minArrowX, contentEl.offsetWidth - minArrowX)

  arrowX.value = `${Math.min(Math.max(rawArrowX, minArrowX), maxArrowX)}px`
}

function syncAlign() {
  if (!mounted.value || !visible.value) {
    return
  }

  requestAnimationFrame(align)
}

function clearCloseTimer() {
  if (closeTimer) {
    window.clearTimeout(closeTimer)
    closeTimer = null
  }
}

function clearOpenTimer() {
  if (openTimer) {
    window.clearTimeout(openTimer)
    openTimer = null
  }
}

function open() {
  clearOpenTimer()
  clearCloseTimer()

  if (props.disabled || visible.value) {
    return
  }

  mounted.value = true
  visible.value = true
  emit('openChange', true)

  nextTick(() => {
    requestAnimationFrame(align)
  })
}

function close() {
  clearOpenTimer()
  clearCloseTimer()

  if (!mounted.value) {
    return
  }

  visible.value = false
  emit('openChange', false)

  closeTimer = setTimeout(() => {
    mounted.value = false
    closeTimer = null
  }, 160)
}

function scheduleOpen() {
  clearCloseTimer()

  if (props.disabled || visible.value) {
    return
  }

  if (props.showDelay <= 0) {
    open()
    return
  }

  clearOpenTimer()
  openTimer = setTimeout(() => {
    openTimer = null
    open()
  }, props.showDelay)
}

function scheduleClose() {
  clearOpenTimer()

  if (props.hideDelay <= 0) {
    close()
    return
  }

  clearCloseTimer()
  closeTimer = setTimeout(() => {
    close()
  }, props.hideDelay)
}

function toggle() {
  if (visible.value) {
    close()
  }
  else {
    open()
  }
}

function onTriggerClick(event: MouseEvent) {
  if (props.trigger !== 'click') {
    return
  }

  event.stopPropagation()
  toggle()
}

function onTriggerEnter() {
  if (props.trigger === 'hover') {
    scheduleOpen()
  }
}

function onTriggerLeave() {
  if (props.trigger === 'hover') {
    scheduleClose()
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  const path = event.composedPath()
  if (triggerRef.value && path.includes(triggerRef.value)) {
    return
  }
  if (popupRef.value && path.includes(popupRef.value)) {
    return
  }

  close()
}

function bindOutsideListener() {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
}

function unbindOutsideListener() {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
}

watch(visible, (open) => {
  if (props.trigger !== 'click') {
    return
  }

  if (outsideListenerTimer) {
    clearTimeout(outsideListenerTimer)
    outsideListenerTimer = null
  }

  if (open) {
    outsideListenerTimer = setTimeout(() => {
      bindOutsideListener()
      outsideListenerTimer = null
    })
  }
  else {
    unbindOutsideListener()
  }
})

watch(() => props.content, () => {
  syncAlign()
}, { flush: 'post' })

onMounted(() => {
  window.addEventListener('resize', syncAlign)
  window.addEventListener('scroll', syncAlign, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncAlign)
  window.removeEventListener('scroll', syncAlign, true)
  unbindOutsideListener()
  if (outsideListenerTimer) {
    window.clearTimeout(outsideListenerTimer)
  }
  clearOpenTimer()
  clearCloseTimer()
})

defineExpose({
  open,
  close,
  align,
})
</script>

<template>
  <span
    ref="triggerRef"
    class="agent-tooltip__trigger"
    :class="triggerClass"
    @click="onTriggerClick"
    @mouseenter="onTriggerEnter"
    @mouseleave="onTriggerLeave"
  >
    <slot :open="open" :close="close" />
  </span>

  <Teleport to="body">
    <div
      v-if="mounted"
      ref="popupRef"
      class="agent-tooltip__popup"
      :style="{ zIndex }"
      @click.stop
      @mouseenter="onTriggerEnter"
      @mouseleave="onTriggerLeave"
    >
      <AnimatePresence mode="wait">
        <motion.div
          v-if="visible"
          class="agent-tooltip__content"
          :class="contentClass"
          :style="{ 'transformOrigin': alignConfig.transformOrigin, '--agent-tooltip-arrow-x': arrowX }"
          :initial="alignConfig.initial"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :exit="alignConfig.initial"
          :transition="{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }"
        >
          <slot name="content" :close="close">
            <span>{{ content }}</span>
          </slot>

          <span
            v-if="showArrow"
            class="agent-tooltip__arrow"
            :class="{
              'agent-tooltip__arrow--top': isTopPlacement,
              'agent-tooltip__arrow--bottom': !isTopPlacement,
            }"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.agent-tooltip__trigger {
  display: inline-flex;
}

.agent-tooltip__popup {
  position: absolute;
  top: -9999px;
  left: -9999px;
}

.agent-tooltip__content {
  position: relative;
  box-sizing: border-box;
  display: flex;
  max-width: min(var(--agent-tooltip-max-width, 420px), calc(100vw - 24px));
  align-items: center;
  gap: var(--gap-gap-2, 8px);
  padding: 6px 12px;
  border-radius: var(--border-radius-rounded-md, 8px);
  color: var(--color-text-primary-inverse, var(--color-bg-primary));
  background: var(--color-bg-primary-inverse, var(--color-bg-primary));
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  overflow-wrap: anywhere;
  text-align: left;
  white-space: normal;
  word-break: break-word;
}

.agent-tooltip__content > :not(.agent-tooltip__arrow) {
  min-width: 0;
}

:slotted(*) {
  min-width: 0;
}

.agent-tooltip__arrow {
  position: absolute;
  left: var(--agent-tooltip-arrow-x, 50%);
  width: 0;
  height: 0;
  border-right: 5px solid transparent;
  border-left: 5px solid transparent;
  transform: translateX(-50%);
}

.agent-tooltip__arrow--top {
  bottom: -4px;
  border-top: 5px solid var(--color-bg-primary-inverse, var(--color-bg-primary));
}

.agent-tooltip__arrow--bottom {
  top: -4px;
  border-bottom: 5px solid var(--color-bg-primary-inverse, var(--color-bg-primary));
}
</style>
