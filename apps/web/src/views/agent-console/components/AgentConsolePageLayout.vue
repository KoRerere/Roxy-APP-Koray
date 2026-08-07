<script setup lang="ts">
import TaskMonitorToggle from './TaskMonitorToggle.vue'

const props = withDefaults(
  defineProps<{
    contentDisplay?: 'block' | 'flex'
    contentDirection?: 'row' | 'column'
    alignItems?: string
    justifyContent?: string
    overflow?: 'hidden' | 'auto'
    padding?: string
    mobilePadding?: string
    title?: string
    showTaskMonitorToggle?: boolean
    taskMonitorToggleLabel?: string
    taskMonitorToggleVariant?: 'pill' | 'icon'
  }>(),
  {
    contentDisplay: 'block',
    contentDirection: 'column',
    alignItems: 'initial',
    justifyContent: 'initial',
    overflow: 'hidden',
    padding: '66px 23px 40px',
    showTaskMonitorToggle: true,
    taskMonitorToggleVariant: 'pill',
  },
)

const emit = defineEmits<{
  scroll: [event: Event]
}>()

const panelStyle = computed(() => ({
  '--agent-console-page-padding': props.padding,
  '--agent-console-page-mobile-padding': props.mobilePadding ?? props.padding,
  '--agent-console-page-display': props.contentDisplay,
  '--agent-console-page-direction': props.contentDirection,
  '--agent-console-page-align': props.alignItems,
  '--agent-console-page-justify': props.justifyContent,
}))

const COMPACT_HEADER_SCROLL_THRESHOLD = 100
const compactHeaderVisible = ref(false)

function handlePageScroll(event: Event) {
  if (!props.title)
    return

  const target = event.target
  if (!(target instanceof HTMLElement) || !target.matches('[data-agent-page-scroll]'))
    return

  emit('scroll', event)

  const canScroll = target.scrollHeight > target.clientHeight + 1
  compactHeaderVisible.value = canScroll && target.scrollTop > COMPACT_HEADER_SCROLL_THRESHOLD
}
</script>

<template>
  <main
    class="agent-console-page-layout"
    :class="[
      `agent-console-page-layout--${overflow}`,
      { 'agent-console-page-layout--with-header': title },
    ]"
    @scroll.capture.passive="handlePageScroll"
  >
    <Transition name="agent-console-page-layout__header">
      <header v-if="title && compactHeaderVisible" class="agent-console-page-layout__header">
        <h1>{{ title }}</h1>
        <TaskMonitorToggle
          v-if="showTaskMonitorToggle"
          class="agent-console-page-layout__monitor"
          :label="taskMonitorToggleLabel"
          :variant="taskMonitorToggleVariant"
        />
      </header>
    </Transition>

    <section class="agent-console-page-layout__panel" data-agent-page-scroll :style="panelStyle">
      <TaskMonitorToggle
        v-if="showTaskMonitorToggle"
        class="agent-console-page-layout__floating-monitor"
        :class="{ 'is-hidden': compactHeaderVisible }"
        :label="taskMonitorToggleLabel"
        :variant="taskMonitorToggleVariant"
      />
      <slot />
    </section>

    <slot name="overlay" />
  </main>
</template>

<style lang="scss" scoped>
.agent-console-page-layout {
  box-sizing: border-box;
  height: calc(100% - 20px);
  min-width: 0;
  min-height: 0;
  margin: 10px 10px 10px 0;
  border-radius: var(--radius-3xl, 16px);
  border: 1px solid var(--color-border-disabled);
  background: var(--color-bg-primary);
}

.agent-console-page-layout--hidden {
  overflow: hidden;
}

.agent-console-page-layout--auto {
  overflow: auto;
}

.agent-console-page-layout--with-header {
  position: relative;
  overflow: hidden;
}

.agent-console-page-layout__header {
  position: absolute;
  inset: 0 0 auto;
  z-index: 9;
  box-sizing: border-box;
  display: flex;
  height: 64px;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-secondary);
  background: color-mix(in srgb, var(--color-bg-primary) 80%, transparent);
  backdrop-filter: blur(20px);

  h1 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    white-space: nowrap;
  }

  :deep(.agent-console-page-layout__monitor) {
    position: static;
    flex: 0 0 auto;
  }
}

.agent-console-page-layout__header-enter-active,
.agent-console-page-layout__header-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms ease;
}

.agent-console-page-layout__header-enter-from,
.agent-console-page-layout__header-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

:deep(.agent-console-page-layout__floating-monitor) {
  transition: opacity 120ms ease;
}

:deep(.agent-console-page-layout__floating-monitor.is-hidden) {
  opacity: 0;
  pointer-events: none;
}

.agent-console-page-layout__panel {
  position: relative;
  display: var(--agent-console-page-display);
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 100%;
  align-items: var(--agent-console-page-align);
  flex-direction: var(--agent-console-page-direction);
  justify-content: var(--agent-console-page-justify);
  padding: var(--agent-console-page-padding);
}

.agent-console-page-layout--with-header.agent-console-page-layout--hidden .agent-console-page-layout__panel {
  overflow: hidden;
}

.agent-console-page-layout--with-header.agent-console-page-layout--auto .agent-console-page-layout__panel {
  overflow: auto;
  scrollbar-gutter: stable;
}

@media (max-width: 760px) {
  .agent-console-page-layout__panel {
    padding: var(--agent-console-page-mobile-padding);
  }
}

@media (max-width: 860px) {
  .agent-console-page-layout {
    height: 100%;
    margin: 0;
    border: 0;
    border-radius: 0;
  }
}
</style>
