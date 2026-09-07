<script setup lang="ts">
import AgentTooltip from './AgentTooltip.vue'

type TooltipPlacement = 'top' | 'top-start' | 'bottom' | 'bottom-start'

const props = withDefaults(defineProps<{
  contentClass?: string
  content: string
  fallback?: string
  overflowTargetSelector?: string
  placement?: TooltipPlacement
  zIndex?: number
}>(), {
  fallback: '-',
  placement: 'top-start',
  zIndex: 70,
})

const textRef = useTemplateRef<HTMLElement>('textRef')
const overflowed = ref(false)
const tooltipContentClass = computed(() => ['overflow-tooltip-content', props.contentClass].filter(Boolean).join(' '))
let resizeObserver: ResizeObserver | undefined

function measureOverflow() {
  const element = textRef.value
  const overflowTarget = props.overflowTargetSelector
    ? element?.querySelector<HTMLElement>(props.overflowTargetSelector)
    : element
  overflowed.value = Boolean(overflowTarget && overflowTarget.scrollWidth > overflowTarget.clientWidth + 1)
}

watch(() => props.content, () => nextTick(measureOverflow), { flush: 'post' })

onMounted(() => {
  resizeObserver = new ResizeObserver(measureOverflow)
  if (textRef.value) {
    resizeObserver.observe(textRef.value)
  }
  measureOverflow()
})

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <span class="overflow-tooltip">
    <AgentTooltip
      :content="content"
      :content-class="tooltipContentClass"
      :disabled="!overflowed || !content"
      :z-index="zIndex"
    >
      <span ref="textRef" class="overflow-tooltip__text">
        <slot>{{ content || fallback }}</slot>
      </span>
    </AgentTooltip>
  </span>
</template>

<style scoped lang="scss">
.overflow-tooltip {
  display: block;
  width: 100%;
  min-width: 0;

  :deep(.agent-tooltip__trigger) {
    display: flex;
    width: 100%;
    min-width: 0;
  }
}

.overflow-tooltip__text {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<style lang="scss">
.overflow-tooltip-content {
  max-width: min(420px, calc(100vw - 24px));
  overflow-wrap: anywhere;
  white-space: normal;
}
</style>
