<script setup lang="ts">
import type { AgentScriptLogProcessEvent } from '../types'

const props = withDefaults(defineProps<{
  event: AgentScriptLogProcessEvent
  windowLabel: string
  compact?: boolean
}>(), {
  compact: false,
})

const outputElement = ref<HTMLElement | null>(null)
const followTail = ref(true)
const scrollState = ref({ canScrollUp: false, canScrollDown: false })
let resizeObserver: ResizeObserver | undefined

const outputText = computed(() => props.event.lines.map(line => line.message).join('\n'))

function syncScrollState(): void {
  const element = outputElement.value
  if (!element) {
    return
  }

  const range = element.scrollHeight - element.clientHeight
  scrollState.value = {
    canScrollUp: range > 1 && element.scrollTop > 1,
    canScrollDown: range > 1 && element.scrollTop < range - 1,
  }

  if (document.activeElement === element) {
    followTail.value = range <= 1 || element.scrollTop >= range - 1
  }
}

function focusOutput(): void {
  outputElement.value?.focus({ preventScroll: true })
}

function resumeAutoScroll(): void {
  followTail.value = true
  requestAnimationFrame(() => {
    const element = outputElement.value
    if (!element) {
      return
    }
    element.scrollTop = element.scrollHeight
    syncScrollState()
  })
}

function scrollToTail(): void {
  if (!followTail.value) {
    return
  }
  nextTick(() => {
    const element = outputElement.value
    if (!element) {
      return
    }
    element.scrollTop = element.scrollHeight
    syncScrollState()
  })
}

watch(
  () => `${props.event.status}:${props.event.lines.length}:${props.event.lines.at(-1)?.message.length ?? 0}`,
  scrollToTail,
  { flush: 'post' },
)

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && outputElement.value) {
    resizeObserver = new ResizeObserver(syncScrollState)
    resizeObserver.observe(outputElement.value)
  }
  scrollToTail()
  nextTick(syncScrollState)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <section class="script-log-panel" :class="{ 'script-log-panel--compact': compact }">
    <header class="script-log-panel__title" :title="windowLabel">
      <span>{{ windowLabel }}</span>
    </header>
    <pre
      ref="outputElement"
      class="script-log-panel__output"
      :class="{
        'scroll-mask--top': scrollState.canScrollUp,
        'scroll-mask--bottom': scrollState.canScrollDown,
      }"
      tabindex="-1"
      @blur="resumeAutoScroll"
      @pointerdown="focusOutput"
      @scroll.passive="syncScrollState"
      @wheel.passive="focusOutput"
    >{{ outputText }}</pre>
  </section>
</template>

<style scoped>
.script-log-panel {
  --script-log-body-bg: var(--color-bg-secondary, #fafafa);
  --script-log-title-bg: #ededed;
  display: flex;
  min-width: 0;
  max-width: 100%;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-secondary, #e5e5e5);
  border-radius: 4px;
  background: var(--script-log-body-bg);
}

:global(html[data-theme='dark'] body.agent-console-window) .script-log-panel,
:global(html.app-dark body.agent-console-window) .script-log-panel {
  --script-log-body-bg: #1b1b1b;
  --script-log-title-bg: #111;
}

.script-log-panel__title {
  display: flex;
  min-width: 0;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  padding: 0 10px;
  color: var(--color-text-secondary, #424242);
  background: var(--script-log-title-bg);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.script-log-panel__title span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.script-log-panel__output {
  min-width: 0;
  max-width: 100%;
  max-height: 240px;
  min-height: 36px;
  margin: 0;
  padding: 8px 10px;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  background: var(--script-log-body-bg);
  color: var(--color-text-secondary, #525252);
  font:
    12px/18px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  white-space: pre-wrap;
  word-break: break-word;
  --mask-top: #000;
  --mask-bottom: #000;
  mask-image: linear-gradient(to bottom, var(--mask-top) 0, #000 20px, #000 calc(100% - 24px), var(--mask-bottom) 100%);
}

.script-log-panel__output.scroll-mask--top {
  --mask-top: transparent;
}

.script-log-panel__output.scroll-mask--bottom {
  --mask-bottom: transparent;
}

.script-log-panel--compact .script-log-panel__title {
  height: 26px;
  flex-basis: 26px;
  padding: 0 8px;
}

.script-log-panel--compact .script-log-panel__output {
  padding: 6px 8px;
}
</style>
