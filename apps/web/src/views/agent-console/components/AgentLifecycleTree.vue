<script setup lang="ts">
import type { AgentLifecycleProcessEvent } from '../types'
import { splitProcessEventBlocks } from '../processEventGrouping'
import AgentCollapse from './AgentCollapse.vue'
import AgentProcessEventList from './AgentProcessEventList.vue'

defineOptions({ name: 'AgentLifecycleTree' })

const props = defineProps<{
  event: AgentLifecycleProcessEvent
}>()

const MAX_VISIBLE_GROUP_ITEMS = 10
const GROUP_SCROLL_MAX_HEIGHT = `${MAX_VISIBLE_GROUP_ITEMS * 20 + (MAX_VISIBLE_GROUP_ITEMS - 1) * 12}px`
const expanded = ref(props.event.expanded === true)
const bodyElement = ref<HTMLElement | null>(null)
const bodyScrollState = reactive({ scrollable: false, canScrollUp: false, canScrollDown: false })
const hasDetails = computed(() => Boolean(props.event.events.length || props.event.children.length || props.event.report || props.event.error))
const eventBlocks = computed(() => splitProcessEventBlocks(props.event.events, props.event.agentPath))
const lastEventBlockId = computed(() => eventBlocks.value.filter(block => block.type === 'events').at(-1)?.id)
let resizeObserver: ResizeObserver | undefined

function syncBodyScrollState(): void {
  const element = bodyElement.value
  if (!element) {
    return
  }

  const range = element.scrollHeight - element.clientHeight
  bodyScrollState.scrollable = range > 1
  bodyScrollState.canScrollUp = range > 1 && element.scrollTop > 1
  bodyScrollState.canScrollDown = range > 1 && element.scrollTop < range - 1
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !bodyElement.value) {
    return
  }
  resizeObserver = new ResizeObserver(syncBodyScrollState)
  resizeObserver.observe(bodyElement.value)
  nextTick(syncBodyScrollState)
})

watch(expanded, () => nextTick(syncBodyScrollState), { flush: 'post' })

watch(() => props.event.renderRevision, (revision, previousRevision) => {
  nextTick(() => {
    const element = bodyElement.value
    if (expanded.value && previousRevision !== undefined && revision !== previousRevision && element) {
      element.scrollTop = element.scrollHeight
    }
    syncBodyScrollState()
  })
}, { flush: 'post' })

onBeforeUnmount(() => resizeObserver?.disconnect())

function title(status: AgentLifecycleProcessEvent['lifecycleStatus'], name: string) {
  if (status === 'completed') {
    return $t('已创建智能体 {name}', { name })
  }
  if (status === 'failed') {
    return $t('创建智能体 {name} 失败', { name })
  }
  if (status === 'cancelled') {
    return $t('创建智能体 {name} 已取消', { name })
  }
  return $t('创建智能体 {name}', { name })
}
</script>

<template>
  <section class="agent-node">
    <button class="agent-node__header" type="button" :disabled="!hasDetails" @click="expanded = !expanded">
      <SvgIcon name="roxy-agent/rx-ic-tool" size="16" />
      <span class="agent-node__identity"><strong>{{ title(event.lifecycleStatus, event.agentName) }}</strong></span>
      <SvgIcon
        v-if="hasDetails"
        name="base/rx_ic_chevron_down"
        size="12"
        :class="{ collapsed: !expanded }"
      />
    </button>

    <AgentCollapse :expanded="expanded && hasDetails">
      <div
        ref="bodyElement"
        class="agent-node__body"
        :class="{
          'agent-node__body--scrollable': bodyScrollState.scrollable,
          'scroll-mask--top': bodyScrollState.canScrollUp,
          'scroll-mask--bottom': bodyScrollState.canScrollDown,
        }"
        :style="{ '--agent-group-max-height': GROUP_SCROLL_MAX_HEIGHT }"
        @scroll.passive="syncBodyScrollState"
      >
        <div class="agent-node__content">
          <template v-for="block in eventBlocks" :key="block.id">
            <AgentProcessEventList
              v-if="block.type === 'events'"
              :events="block.events"
              :running="(event.lifecycleStatus === 'starting' || event.lifecycleStatus === 'running') && block.id === lastEventBlockId"
              :scope="block.id"
              compact
            />
            <AgentLifecycleTree
              v-else
              v-memo="[block.event.renderRevision, block.event.lifecycleStatus]"
              :event="block.event"
            />
          </template>
          <p v-if="event.error" class="agent-node__result agent-node__result--error">
            {{ event.error }}
          </p>
          <p v-else-if="event.report && !event.events.length" class="agent-node__result">
            {{ event.report }}
          </p>
          <div v-if="event.children.length" class="agent-node__children">
            <AgentLifecycleTree
              v-for="child in event.children"
              :key="child.agentPath"
              v-memo="[child.renderRevision, child.lifecycleStatus]"
              :event="child"
            />
          </div>
        </div>
      </div>
    </AgentCollapse>
  </section>
</template>

<style scoped>
.agent-node {
  min-width: 0;
}

.agent-node__header {
  display: flex;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  color: var(--color-text-disabled, #a3a3a3);
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.agent-node__header:disabled {
  cursor: default;
}

.agent-node__identity {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: baseline;
}

.agent-node__identity strong {
  overflow: hidden;
  color: inherit;
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-node__result--error {
  color: var(--color-text-error-primary);
}

.agent-node__header :deep(.collapsed) {
  transform: rotate(-90deg);
}

.agent-node__header :deep(.svg) {
  flex: 0 0 auto;
  transition: transform 0.18s ease;
}

.agent-node__body {
  box-sizing: border-box;
  min-width: 0;
  max-height: min(var(--agent-group-max-height), 38vh);
  margin-left: 14px;
  padding-top: 18px;
}

.agent-node__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  padding-left: 14px;
  border-left: 1px solid var(--color-border-secondary);
}

.agent-node__body--scrollable {
  overflow-y: auto;
  padding-right: 8px;
  scrollbar-gutter: stable;
  --mask-top: #000;
  --mask-bottom: #000;
  mask-image: linear-gradient(to bottom, var(--mask-top) 0, #000 20px, #000 calc(100% - 24px), var(--mask-bottom) 100%);
}

.agent-node__body.scroll-mask--top {
  --mask-top: transparent;
}

.agent-node__body.scroll-mask--bottom {
  --mask-bottom: transparent;
}

.agent-node__result {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
  word-break: break-word;
}

.agent-node__children {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  padding-left: 12px;
  border-left: 1px solid var(--color-border-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .agent-node__header :deep(.svg) {
    transition: none;
  }
}
</style>
