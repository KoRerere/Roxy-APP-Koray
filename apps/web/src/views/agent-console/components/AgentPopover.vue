<script setup lang="ts">
import domAlign from 'dom-align'

defineOptions({
  inheritAttrs: false,
})

type Placement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end'
type PopoverClass = string | string[] | Record<string, boolean>

const props = withDefaults(defineProps<{
  placement?: Placement
  offset?: number
  triggerClass?: PopoverClass
  contentClass?: PopoverClass
  zIndex?: number
  disabled?: boolean
}>(), {
  placement: 'bottom-end',
  offset: 8,
  zIndex: 1200,
})

const emit = defineEmits<{
  openChange: [open: boolean]
}>()

const openValue = defineModel<boolean>('open', { default: false })

const triggerRef = useTemplateRef<HTMLElement>('triggerRef')
const popupRef = useTemplateRef<HTMLElement>('popupRef')

let resizeObserver: ResizeObserver | undefined
let globalListenersBound = false

const alignConfig = computed(() => {
  const offset = props.offset

  switch (props.placement) {
    case 'top':
      return { points: ['bc', 'tc'], offset: [0, -offset] }
    case 'top-start':
      return { points: ['bl', 'tl'], offset: [0, -offset] }
    case 'top-end':
      return { points: ['br', 'tr'], offset: [0, -offset] }
    case 'bottom':
      return { points: ['tc', 'bc'], offset: [0, offset] }
    case 'bottom-start':
      return { points: ['tl', 'bl'], offset: [0, offset] }
    case 'left':
      return { points: ['cr', 'cl'], offset: [-offset, 0] }
    case 'left-start':
      return { points: ['tr', 'tl'], offset: [-offset, 0] }
    case 'left-end':
      return { points: ['br', 'bl'], offset: [-offset, 0] }
    case 'right':
      return { points: ['cl', 'cr'], offset: [offset, 0] }
    case 'right-start':
      return { points: ['tl', 'tr'], offset: [offset, 0] }
    case 'right-end':
      return { points: ['bl', 'br'], offset: [offset, 0] }
    case 'bottom-end':
    default:
      return { points: ['tr', 'br'], offset: [0, offset] }
  }
})

function syncAlign() {
  if (!openValue.value || !popupRef.value || !triggerRef.value)
    return

  requestAnimationFrame(() => {
    if (!openValue.value || !popupRef.value || !triggerRef.value)
      return

    domAlign(popupRef.value, triggerRef.value, {
      points: alignConfig.value.points,
      offset: alignConfig.value.offset,
      targetOffset: [0, 0],
      overflow: {
        adjustX: true,
        adjustY: true,
      },
      useCssTransform: true,
      ignoreShake: true,
    })
  })
}

function open() {
  if (props.disabled || openValue.value)
    return

  openValue.value = true
}

function close() {
  if (!openValue.value)
    return

  openValue.value = false
}

function toggle() {
  if (openValue.value)
    close()
  else
    open()
}

function onTriggerClick(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  toggle()
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ')
    return

  event.preventDefault()
  event.stopPropagation()
  toggle()
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!openValue.value)
    return

  const path = event.composedPath()
  if (triggerRef.value && path.includes(triggerRef.value))
    return
  if (popupRef.value && path.includes(popupRef.value))
    return

  close()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape')
    close()
}

function bindResizeObserver() {
  if (!popupRef.value || typeof ResizeObserver === 'undefined')
    return

  resizeObserver = new ResizeObserver(syncAlign)
  resizeObserver.observe(popupRef.value)
}

function unbindResizeObserver() {
  resizeObserver?.disconnect()
  resizeObserver = undefined
}

function bindGlobalListeners() {
  if (globalListenersBound)
    return

  globalListenersBound = true
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('resize', syncAlign)
  window.addEventListener('scroll', syncAlign, true)
}

function unbindGlobalListeners() {
  if (!globalListenersBound)
    return

  globalListenersBound = false
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', syncAlign)
  window.removeEventListener('scroll', syncAlign, true)
}

watch(openValue, (open) => {
  emit('openChange', open)

  if (open) {
    bindGlobalListeners()
    nextTick(() => {
      syncAlign()
      bindResizeObserver()
    })
  }
  else {
    unbindResizeObserver()
    unbindGlobalListeners()
  }
}, { flush: 'post' })

watch(() => [props.placement, props.offset], () => {
  syncAlign()
})

onBeforeUnmount(() => {
  unbindGlobalListeners()
  unbindResizeObserver()
})

defineExpose({
  open,
  close,
  toggle,
  align: syncAlign,
})
</script>

<template>
  <span
    ref="triggerRef"
    v-bind="$attrs"
    class="agent-popover__trigger"
    :class="triggerClass"
    @click="onTriggerClick"
    @keydown="onTriggerKeydown"
  >
    <slot :open="open" :close="close" :toggle="toggle" :is-open="openValue" />
  </span>

  <Teleport to="body">
    <div
      v-if="openValue"
      ref="popupRef"
      class="agent-popover__content"
      :class="contentClass"
      :style="{ zIndex }"
      @click.stop
    >
      <slot name="content" :close="close" />
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.agent-popover__trigger {
  display: inline-flex;
}

.agent-popover__content {
  position: absolute;
  top: -9999px;
  left: -9999px;
}
</style>
