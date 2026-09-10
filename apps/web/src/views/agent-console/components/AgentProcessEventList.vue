<script setup lang="ts">
import type {
  AgentContextCompactedProcessEvent,
  AgentHitlProcessEvent,
  AgentProcessEvent,
  AgentRetryProcessEvent,
  AgentScriptLogProcessEvent,
  AgentSkillLoadProcessEvent,
  AgentThinkingProcessEvent,
  AgentToolCallProcessEvent,
} from '../types'
import type { ProcessEventGroupItem, ProcessRenderItem, ProcessScriptLogGroupItem } from '../processEventGrouping'
import type { SvgNames } from '/@/components/rx-icon'
import { getProcessGroupPrimaryEvent, groupProcessEvents } from '../processEventGrouping'
import { retryIconName } from '../processPresentationState'
import { buildProcessScrollRevisions } from '../scrollRevisions'
import { getMemoryToolPresentation } from '../memoryToolPresentation'
import { agentProfileLabelVersion, getCachedAgentProfileLabels } from '../profile-token-display'
import { friendlyMemoryToolGroupName, friendlyToolName, originalToolName, readFileSkillName } from '../toolName'
import { getWebSearchToolPresentation } from '../webSearchToolPresentation'
import AgentCollapse from './AgentCollapse.vue'
import MarkdownContent from './MarkdownContent.vue'
import AgentScriptLogPanel from './AgentScriptLogPanel.vue'
import WebSearchToolLabel from './WebSearchToolLabel.vue'

const props = withDefaults(defineProps<{
  events: AgentProcessEvent[]
  running?: boolean
  scope?: string
  compact?: boolean
}>(), {
  running: false,
  scope: 'events',
  compact: false,
})

const MAX_VISIBLE_GROUP_ITEMS = 10
const GROUP_SCROLL_MAX_HEIGHT = `${MAX_VISIBLE_GROUP_ITEMS * 20 + (MAX_VISIBLE_GROUP_ITEMS - 1) * 12}px`
const expandedById = ref<Record<string, boolean>>({})
const scrollStates = ref<Record<string, { canScrollUp: boolean, canScrollDown: boolean }>>({})
const scrollElements = new Map<string, HTMLElement>()
const scrollElementIds = new WeakMap<HTMLElement, string>()
const items = computed(() => groupProcessEvents(props.events, props.scope))
const scrollRevisions = computed(() => buildProcessScrollRevisions(items.value, expandedById.value))
let resizeObserver: ResizeObserver | undefined

function itemKey(item: ProcessRenderItem): string {
  return item.type === 'group' || item.type === 'script_logs' ? item.id : item.event.id
}

function scriptLogGroupScrollId(item: ProcessScriptLogGroupItem): string {
  return `script-grid:${item.id}`
}

function isExpanded(event: AgentProcessEvent): boolean {
  return expandedById.value[event.id] ?? event.expanded === true
}

function toggleEvent(event: AgentProcessEvent): void {
  expandedById.value = { ...expandedById.value, [event.id]: !isExpanded(event) }
}

function isGroupExpanded(item: ProcessEventGroupItem): boolean {
  return expandedById.value[item.id] ?? false
}

function toggleGroup(item: ProcessEventGroupItem): void {
  expandedById.value = { ...expandedById.value, [item.id]: !isGroupExpanded(item) }
}

function isScriptLogGroupExpanded(item: ProcessScriptLogGroupItem): boolean {
  return expandedById.value[item.id] ?? false
}

function toggleScriptLogGroup(item: ProcessScriptLogGroupItem): void {
  expandedById.value = { ...expandedById.value, [item.id]: !isScriptLogGroupExpanded(item) }
}

function isGroupScrollable(item: ProcessEventGroupItem): boolean {
  return item.events.length > MAX_VISIBLE_GROUP_ITEMS
}

function shouldHighlight(item: ProcessRenderItem): boolean {
  const last = items.value.at(-1)
  return props.running && Boolean(last && itemKey(last) === itemKey(item))
}

function toolLabel(event: AgentToolCallProcessEvent): string {
  if (event.label) {
    return event.label
  }
  const label = friendlyToolName(
    event.toolName,
    event.status,
    event.input,
    { finished: event.finished, patchType: event.patchType, target: event.target },
  )
  const memoryPresentation = getMemoryToolPresentation(event.toolName, event.input, {
    patchType: event.patchType,
    target: event.target,
  })
  if (memoryPresentation?.kind === 'entries') {
    return label
  }
  const displayName = originalToolName(event.toolName)
  return displayName === 'apply_patch' || displayName === 'read_file' || displayName === 'exec_command'
    ? label
    : `${label}${event.target ? ` ${event.target}` : ''}`
}

function isLocalAbsolutePath(value: string): boolean {
  return value.startsWith('/')
    || /^[a-z]:[\\/]/i.test(value)
    || value.startsWith('\\\\')
}

function pathBasename(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).at(-1) || value
}

function scriptDisplayName(scriptName: string): string {
  return isLocalAbsolutePath(scriptName) ? pathBasename(scriptName) : scriptName
}

function toolInputPath(event: AgentToolCallProcessEvent): string | undefined {
  if (event.target) {
    return event.target
  }
  if (!event.input || typeof event.input !== 'object' || Array.isArray(event.input)) {
    return undefined
  }

  const path = (event.input as Record<string, unknown>).path
  return typeof path === 'string' ? path : undefined
}

function isWebSearchToolEvent(event: AgentProcessEvent | undefined): event is AgentToolCallProcessEvent {
  return event?.type === 'tool_call'
    && originalToolName(event.toolName) === 'web_search'
    && getWebSearchToolPresentation(event.input) !== undefined
}

function groupPrimaryEvent(item: ProcessEventGroupItem): AgentProcessEvent | undefined {
  return getProcessGroupPrimaryEvent(item.events)
}

function isReadFileSkillEvent(event: AgentToolCallProcessEvent): boolean {
  return originalToolName(event.toolName) === 'read_file'
    && Boolean(readFileSkillName(toolInputPath(event)))
}

function scriptLabel(event: AgentScriptLogProcessEvent): string {
  if (event.scriptName) {
    return `${$t('运行脚本')} ${scriptDisplayName(event.scriptName)}`
  }
  return event.title || $t('运行脚本')
}

function scriptWindowLabel(event: AgentScriptLogProcessEvent, index: number): string {
  void agentProfileLabelVersion.value
  const cachedLabel = event.dirId ? getCachedAgentProfileLabels([event.dirId])[0] : ''
  return cachedLabel?.replace(/^@+/, '') || $t('窗口 {index}', { index: index + 1 })
}

function scriptLogGroupLabel(item: ProcessScriptLogGroupItem): string {
  const event = item.events[0]
  return event ? scriptLabel(event) : $t('运行脚本')
}

function skillLabel(event: AgentSkillLoadProcessEvent): string {
  return event.status === 'success' ? `已加载 skill：${event.skillPath}` : `加载 skill：${event.skillPath}`
}

function eventLabel(event: AgentProcessEvent): string {
  if (event.type === 'tool_call') {
    return toolLabel(event)
  }
  if (event.type === 'script_log') {
    return scriptLabel(event)
  }
  if (event.type === 'skill_load') {
    return skillLabel(event)
  }
  if (event.type === 'thinking' || event.type === 'context_compacted' || event.type === 'retrying') {
    return event.title
  }
  if (event.type === 'hitl') {
    return event.title
  }
  return event.title || $t('执行过程')
}

function eventIcon(event: AgentProcessEvent): SvgNames {
  if (event.type === 'thinking') {
    return 'roxy-agent/rx-ic-thinking'
  }
  if (event.type === 'script_log') {
    return 'roxy-agent/rx-ic-scripts'
  }
  if (event.type === 'skill_load') {
    return 'roxy-agent/rx-ic-skills'
  }
  if (event.type === 'tool_call' && isReadFileSkillEvent(event)) {
    return 'roxy-agent/rx-ic-skills'
  }
  if (event.type === 'retrying') {
    return retryIconName(event.status)
  }
  if (event.type === 'hitl') {
    return event.requestKind === 'clarification' ? 'base/rx_ic_ask' : 'roxy-agent/rx-ic-ask'
  }
  if (isWebSearchToolEvent(event)) {
    return 'roxy-agent/rx-ic-search'
  }
  return 'roxy-agent/rx-ic-tool'
}

function groupLabel(item: ProcessEventGroupItem): string {
  const toolEvents = item.events.filter((event): event is AgentToolCallProcessEvent => event.type === 'tool_call')
  if (toolEvents.length > 0 && item.events.every(event => event.type === 'thinking' || event.type === 'tool_call')) {
    const memoryLabel = friendlyMemoryToolGroupName(toolEvents)
    if (memoryLabel) {
      return memoryLabel
    }
  }

  const event = getProcessGroupPrimaryEvent(item.events)
  return event ? eventLabel(event) : $t('执行过程')
}

function groupIcon(item: ProcessEventGroupItem): SvgNames {
  const event = getProcessGroupPrimaryEvent(item.events)
  return event ? eventIcon(event) : 'roxy-agent/rx-ic-tool'
}

function hitlDetailLabel(event: AgentHitlProcessEvent): string {
  return event.detail || event.description || ''
}

function hitlClarificationAnswers(event: AgentHitlProcessEvent) {
  return event.clarificationAnswers ?? []
}

function scrollState(id: string): { canScrollUp: boolean, canScrollDown: boolean } {
  return scrollStates.value[id] ?? { canScrollUp: false, canScrollDown: false }
}

function syncScrollState(id: string): void {
  const element = scrollElements.get(id)
  if (!element) {
    return
  }
  const range = element.scrollHeight - element.clientHeight
  const next = {
    canScrollUp: range > 1 && element.scrollTop > 1,
    canScrollDown: range > 1 && element.scrollTop < range - 1,
  }
  const current = scrollStates.value[id]
  if (current?.canScrollUp === next.canScrollUp && current.canScrollDown === next.canScrollDown) {
    return
  }
  scrollStates.value = {
    ...scrollStates.value,
    [id]: next,
  }
}

function setScrollElement(id: string, element: HTMLElement | null): void {
  const previous = scrollElements.get(id)
  if (previous === element) {
    return
  }
  if (previous) {
    resizeObserver?.unobserve(previous)
    scrollElementIds.delete(previous)
  }
  if (!element) {
    scrollElements.delete(id)
    return
  }
  scrollElements.set(id, element)
  scrollElementIds.set(element, id)
  resizeObserver?.observe(element)
  requestAnimationFrame(() => {
    if (id.startsWith('thinking:') || id.startsWith('script:')) {
      element.scrollTop = element.scrollHeight
    }
    syncScrollState(id)
  })
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') {
    return
  }

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const id = scrollElementIds.get(entry.target as HTMLElement)
      if (id) {
        syncScrollState(id)
      }
    }
  })
  for (const element of scrollElements.values()) {
    resizeObserver.observe(element)
  }
  nextTick(() => {
    for (const id of scrollElements.keys()) {
      syncScrollState(id)
    }
  })
})

watch(expandedById, () => {
  nextTick(() => {
    for (const id of scrollElements.keys()) {
      syncScrollState(id)
    }
  })
}, { flush: 'post' })

watch(scrollRevisions, (revisions, previousRevisions) => {
  const changedIds = Object.entries(revisions).flatMap(([id, revision]) => {
    const expandedId = id.replace(/^(?:thinking|script-grid):/, '')
    return previousRevisions[id] !== undefined
      && previousRevisions[id] !== revision
      && expandedById.value[expandedId] === true
      ? [id]
      : []
  })
  if (changedIds.length === 0) {
    return
  }

  nextTick(() => {
    for (const id of changedIds) {
      const element = scrollElements.get(id)
      if (!element) {
        continue
      }

      element.scrollTop = element.scrollHeight
      syncScrollState(id)
    }
  })
}, { flush: 'post' })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  scrollElements.clear()
})
</script>

<template>
  <div class="agent-event-list" :class="{ 'agent-event-list--compact': compact }">
    <template v-for="item in items" :key="itemKey(item)">
      <div v-if="item.type === 'content'" class="process-content">
        <MarkdownContent
          :content="item.event.content"
          :streaming="running && shouldHighlight(item)"
          variant="answer"
        />
      </div>

      <template v-else-if="item.type === 'event'">
        <div v-if="item.event.type === 'thinking'" class="process-event">
          <button class="event-trigger" type="button" @click="toggleEvent(item.event)">
            <SvgIcon name="roxy-agent/rx-ic-thinking" size="16" />
            <span :class="{ 'process-running-text': shouldHighlight(item) }">{{ (item.event as AgentThinkingProcessEvent).title }}</span>
          </button>
        </div>

        <div v-else-if="item.event.type === 'tool_call'" class="inline-event">
          <SvgIcon :name="eventIcon(item.event)" size="16" />
          <WebSearchToolLabel
            v-if="isWebSearchToolEvent(item.event)"
            :event="item.event"
            :highlight="shouldHighlight(item)"
          />
          <span v-else :class="{ 'process-running-text': shouldHighlight(item) }">{{ toolLabel(item.event as AgentToolCallProcessEvent) }}</span>
        </div>

        <div v-else-if="item.event.type === 'script_log'" class="process-event">
          <button class="event-trigger" type="button" @click="toggleEvent(item.event)">
            <SvgIcon name="roxy-agent/rx-ic-scripts" size="16" />
            <span :class="{ 'process-running-text': shouldHighlight(item) }">{{ scriptLabel(item.event as AgentScriptLogProcessEvent) }}</span>
            <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isExpanded(item.event) }" />
          </button>
          <AgentCollapse :expanded="isExpanded(item.event)">
            <div class="event-detail-content">
              <AgentScriptLogPanel
                class="script-log-panel--single"
                :compact="compact"
                :event="item.event as AgentScriptLogProcessEvent"
                :window-label="scriptWindowLabel(item.event as AgentScriptLogProcessEvent, 0)"
              />
            </div>
          </AgentCollapse>
        </div>

        <div v-else-if="item.event.type === 'skill_load'" class="inline-event">
          <SvgIcon name="roxy-agent/rx-ic-skills" size="16" />
          <span :class="{ 'process-running-text': shouldHighlight(item) }">{{ skillLabel(item.event as AgentSkillLoadProcessEvent) }}</span>
        </div>

        <div v-else-if="item.event.type === 'context_compacted' || item.event.type === 'retrying'" class="inline-event">
          <SvgIcon :name="eventIcon(item.event)" size="16" />
          <span :class="{ 'process-running-text': shouldHighlight(item) }">{{ (item.event as AgentContextCompactedProcessEvent | AgentRetryProcessEvent).title }}</span>
        </div>

        <div v-else-if="item.event.type === 'hitl'" class="process-event">
          <button class="event-trigger" type="button" @click="toggleEvent(item.event)">
            <SvgIcon :name="eventIcon(item.event)" size="16" />
            <span :class="{ 'process-running-text': shouldHighlight(item) }">{{ (item.event as AgentHitlProcessEvent).title }}</span>
            <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isExpanded(item.event) }" />
          </button>
          <AgentCollapse :expanded="isExpanded(item.event)">
            <div class="event-detail-content">
              <div
                v-if="hitlClarificationAnswers(item.event as AgentHitlProcessEvent).length"
                class="hitl-event__answers"
              >
                <div
                  v-for="answer in hitlClarificationAnswers(item.event as AgentHitlProcessEvent)"
                  :key="answer.id"
                  class="hitl-event__answer"
                >
                  <p>{{ answer.question }}</p>
                  <p class="hitl-event__detail">
                    {{ answer.answer }}<span v-if="answer.recommended"> ({{ $t('Recommended') }})</span>
                  </p>
                </div>
              </div>
              <div v-else class="hitl-event__body">
                <p>{{ (item.event as AgentHitlProcessEvent).prompt }}</p>
                <p v-if="hitlDetailLabel(item.event as AgentHitlProcessEvent)" class="hitl-event__detail">
                  {{ hitlDetailLabel(item.event as AgentHitlProcessEvent) }}
                </p>
              </div>
            </div>
          </AgentCollapse>
        </div>

        <div v-else class="inline-event">
          <SvgIcon :name="eventIcon(item.event)" size="16" />
          <span :class="{ 'process-running-text': shouldHighlight(item) }">{{ eventLabel(item.event) }}</span>
        </div>
      </template>

      <div v-else-if="item.type === 'script_logs'" class="process-event">
        <button class="event-trigger" type="button" @click="toggleScriptLogGroup(item)">
          <SvgIcon name="roxy-agent/rx-ic-scripts" size="16" />
          <span :class="{ 'process-running-text': shouldHighlight(item) }">{{ scriptLogGroupLabel(item) }}</span>
          <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isScriptLogGroupExpanded(item) }" />
        </button>
        <AgentCollapse :expanded="isScriptLogGroupExpanded(item)">
          <div class="event-detail-content">
            <div
              :ref="element => setScrollElement(scriptLogGroupScrollId(item), element as HTMLElement | null)"
              class="script-log-grid-scroll"
              :class="{
                'scroll-mask--top': scrollState(scriptLogGroupScrollId(item)).canScrollUp,
                'scroll-mask--bottom': scrollState(scriptLogGroupScrollId(item)).canScrollDown,
              }"
              :style="{ '--event-group-max-height': GROUP_SCROLL_MAX_HEIGHT }"
              @scroll.passive="syncScrollState(scriptLogGroupScrollId(item))"
            >
              <div class="script-log-grid">
                <AgentScriptLogPanel
                  v-for="(event, index) in item.events"
                  :key="event.id"
                  :compact="compact"
                  :event="event"
                  :window-label="scriptWindowLabel(event, index)"
                />
              </div>
            </div>
          </div>
        </AgentCollapse>
      </div>

      <div v-else class="process-event-group">
        <button class="event-trigger" type="button" @click="toggleGroup(item)">
          <SvgIcon :name="groupIcon(item)" size="16" />
          <WebSearchToolLabel
            v-if="isWebSearchToolEvent(groupPrimaryEvent(item))"
            :event="groupPrimaryEvent(item) as AgentToolCallProcessEvent"
            :highlight="shouldHighlight(item)"
          />
          <span v-else :class="{ 'process-running-text': shouldHighlight(item) }">{{ groupLabel(item) }}</span>
          <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isGroupExpanded(item) }" />
        </button>

        <AgentCollapse :expanded="isGroupExpanded(item)">
          <div
            :ref="element => setScrollElement(item.id, element as HTMLElement | null)"
            class="event-group-body"
            :class="{
              'event-group-body--scrollable': isGroupScrollable(item),
              'scroll-mask--top': scrollState(item.id).canScrollUp,
              'scroll-mask--bottom': scrollState(item.id).canScrollDown,
            }"
            :style="{ '--event-group-max-height': GROUP_SCROLL_MAX_HEIGHT }"
            @scroll.passive="syncScrollState(item.id)"
          >
            <div class="event-group-items">
              <template v-for="event in item.events" :key="event.id">
                <div v-if="event.type === 'thinking'" class="process-event">
                  <button class="event-trigger" type="button" @click="toggleEvent(event)">
                    <SvgIcon name="roxy-agent/rx-ic-thinking" size="16" />
                    <span>{{ (event as AgentThinkingProcessEvent).title }}</span>
                  </button>
                </div>

                <div v-else-if="event.type === 'tool_call'" class="inline-event">
                  <SvgIcon :name="eventIcon(event)" size="16" />
                  <WebSearchToolLabel
                    v-if="isWebSearchToolEvent(event)"
                    :event="event"
                  />
                  <span v-else>{{ toolLabel(event as AgentToolCallProcessEvent) }}</span>
                </div>

                <div v-else-if="event.type === 'script_log'" class="process-event">
                  <button class="event-trigger" type="button" @click="toggleEvent(event)">
                    <SvgIcon name="roxy-agent/rx-ic-scripts" size="16" />
                    <span>{{ scriptLabel(event as AgentScriptLogProcessEvent) }}</span>
                    <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isExpanded(event) }" />
                  </button>
                  <AgentCollapse :expanded="isExpanded(event)">
                    <div class="event-detail-content">
                      <AgentScriptLogPanel
                        class="script-log-panel--single"
                        :compact="compact"
                        :event="event as AgentScriptLogProcessEvent"
                        :window-label="scriptWindowLabel(event as AgentScriptLogProcessEvent, 0)"
                      />
                    </div>
                  </AgentCollapse>
                </div>

                <div v-else-if="event.type === 'skill_load'" class="inline-event">
                  <SvgIcon name="roxy-agent/rx-ic-skills" size="16" />
                  <span>{{ skillLabel(event as AgentSkillLoadProcessEvent) }}</span>
                </div>

                <div v-else class="inline-event">
                  <SvgIcon :name="eventIcon(event)" size="16" />
                  <span>{{ eventLabel(event) }}</span>
                </div>
              </template>
            </div>
          </div>
        </AgentCollapse>
      </div>
    </template>
  </div>
</template>

<style scoped>
.agent-event-list,
.event-group-items,
.process-event-group,
.process-event {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.agent-event-list {
  container-type: inline-size;
}

.event-group-items,
.agent-event-list {
  gap: 12px;
}

.agent-event-list--compact {
  gap: 8px;
}

.agent-event-list--compact .event-group-items {
  gap: 8px;
}

.process-event,
.process-event-group {
  gap: 0;
}

.event-detail-content,
.event-group-body {
  padding-top: 12px;
}

.agent-event-list--compact .event-detail-content,
.agent-event-list--compact .event-group-body {
  padding-top: 8px;
}

.process-content {
  width: 100%;
}

.event-trigger,
.inline-event {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  color: var(--color-text-disabled, #a3a3a3);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.event-trigger {
  width: fit-content;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.event-trigger span,
.inline-event span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-trigger :deep(.svg:last-child) {
  transition: transform 0.18s ease;
}

.event-trigger :deep(.collapsed) {
  transform: rotate(-90deg);
}

.hitl-event__body,
.hitl-event__answers {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding-left: 0;
}

.hitl-event__answer {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.hitl-event__body p,
.hitl-event__answer p {
  margin: 0;
  color: var(--color-text-tertiary, #8c8c8c);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: normal;
  word-break: break-word;
}

.hitl-event__detail {
  color: var(--color-text-disabled, #a3a3a3);
}

.script-log-panel--single {
  width: calc(100% - 20px);
  max-width: 100%;
  margin: 0 0 0 20px;
}

.script-log-grid-scroll {
  width: calc(100% - 20px);
  max-height: min(var(--event-group-max-height), 38vh);
  margin-left: 20px;
  padding-right: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  --mask-top: #000;
  --mask-bottom: #000;
  mask-image: linear-gradient(to bottom, var(--mask-top) 0, #000 20px, #000 calc(100% - 24px), var(--mask-bottom) 100%);
}

.script-log-grid {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 8px;
}

.script-log-grid-scroll.scroll-mask--top {
  --mask-top: transparent;
}

.script-log-grid-scroll.scroll-mask--bottom {
  --mask-bottom: transparent;
}

.event-group-body {
  min-height: 0;
  padding-right: 8px;
  padding-left: 0;
}

.event-group-body--scrollable {
  max-height: min(var(--event-group-max-height), 38vh);
  overflow-y: auto;
  scrollbar-gutter: stable;
  --mask-top: #000;
  --mask-bottom: #000;
  mask-image: linear-gradient(to bottom, var(--mask-top) 0, #000 20px, #000 calc(100% - 24px), var(--mask-bottom) 100%);
}

@container (max-width: 520px) {
  .script-log-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.event-group-body.scroll-mask--top {
  --mask-top: transparent;
}

.event-group-body.scroll-mask--bottom {
  --mask-bottom: transparent;
}

.process-running-text {
  color: transparent;
  background-image: linear-gradient(
    90deg,
    var(--color-text-disabled, #a3a3a3) 35%,
    var(--color-text-primary, #27272a) 50%,
    var(--color-text-disabled, #a3a3a3) 65%
  );
  background-position: 150% center;
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: agent-process-shimmer-text 1.4s linear infinite;
}

@keyframes agent-process-shimmer-text {
  from {
    background-position: 150% center;
  }
  to {
    background-position: -50% center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .process-running-text {
    color: var(--color-text-primary, #27272a);
    background: none;
    -webkit-text-fill-color: currentcolor;
    animation: none;
  }
}
</style>
