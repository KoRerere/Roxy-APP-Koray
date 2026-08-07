<script setup lang="ts">
import domAlign from 'dom-align'
import { AnimatePresence, motion } from 'motion-v'
import SlashCommandPopover from './SlashCommandPopover.vue'
import WindowPickerPopover from './WindowPickerPopover.vue'
import type { SuggestionNavigationDirection } from './selection'
import type { AgentComposerItem, AgentComposerProjectOption, AgentComposerSuggestionState } from './types'

const props = defineProps<{
  allSelected: boolean
  anchor: HTMLElement | null
  hasMore: boolean
  loadError: string
  loadingMore: boolean
  projectOptions: AgentComposerProjectOption[]
  selectedCount: number
  selectedIds: Set<string>
  selectedProjectId: string
  selectAllLoading: boolean
  state: AgentComposerSuggestionState
}>()

const emit = defineEmits<{
  cancel: []
  choose: [item: AgentComposerItem]
  confirm: []
  dismiss: []
  hover: [item: AgentComposerItem]
  loadMore: []
  navigate: [direction: SuggestionNavigationDirection]
  projectChange: [projectId: string]
  read: [item: AgentComposerItem]
  retry: []
  search: [query: string]
  toggleAll: []
}>()

const popoverRef = useTemplateRef<HTMLElement>('popoverRef')
const popoverWidth = ref(800)
const popoverMaxHeight = ref(320)
let resizeObserver: ResizeObserver | null = null

const activeItem = computed(() => props.state.items[props.state.activeIndex])
const hasItems = computed(() => props.state.items.length > 0)
const popoverClass = computed(() => `agent-composer-suggestions--${props.state.kind}`)

function syncPopoverSize() {
  const anchorRect = props.anchor?.getBoundingClientRect()

  if (!anchorRect)
    return

  popoverWidth.value = anchorRect.width

  popoverMaxHeight.value = Math.max(220, Math.min(420, anchorRect.top - 24))
}

function alignPopover() {
  if (!props.state.open || !popoverRef.value || !props.anchor)
    return

  syncPopoverSize()

  requestAnimationFrame(() => {
    if (!popoverRef.value || !props.anchor)
      return

    domAlign(popoverRef.value, props.anchor, {
      points: ['bl', 'tl'],
      offset: [0, -12],
      targetOffset: [0, 0],
      overflow: {
        adjustX: true,
        adjustY: false,
      },
      useCssTransform: true,
      ignoreShake: true,
    })
  })
}

watch(
  () => [
    props.state.open,
    props.state.kind,
    props.state.items.length,
    props.selectedCount,
    props.anchor,
  ],
  () => nextTick(alignPopover),
  { flush: 'post' },
)

watch(
  () => popoverRef.value,
  (element) => {
    resizeObserver?.disconnect()
    resizeObserver = null

    if (!element)
      return

    resizeObserver = new ResizeObserver(() => {
      alignPopover()
    })
    resizeObserver.observe(element)
  },
  { flush: 'post' },
)

function handleViewportChange() {
  nextTick(alignPopover)
}

function isSuggestionInteraction(event: Event) {
  const path = event.composedPath()
  if (popoverRef.value && path.includes(popoverRef.value))
    return true

  const target = event.target
  return target instanceof Element && Boolean(target.closest(
    '[data-composer-suggestion-trigger], .agent-select-overlay',
  ))
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (props.state.open && !isSuggestionInteraction(event))
    emit('dismiss')
}

function handleDocumentFocusIn(event: FocusEvent) {
  if (props.state.open && !isSuggestionInteraction(event))
    emit('dismiss')
}

onMounted(() => {
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  document.addEventListener('focusin', handleDocumentFocusIn, true)
  nextTick(alignPopover)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  document.removeEventListener('focusin', handleDocumentFocusIn, true)
  resizeObserver?.disconnect()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.open"
      ref="popoverRef"
      class="agent-composer-suggestions"
      :class="popoverClass"
      :style="{
        width: `${popoverWidth}px`,
        maxHeight: `${popoverMaxHeight}px`,
      }"
    >
      <AnimatePresence mode="wait">
        <motion.div
          :key="state.kind"
          class="agent-composer-suggestions__motion"
          :initial="{ opacity: 0, y: 8, scale: 0.99 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :exit="{ opacity: 0, y: 8, scale: 0.99 }"
          :transition="{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }"
        >
          <div
            v-if="state.loading && state.kind === 'slash'"
            class="slash-suggestion-skeleton"
            aria-busy="true"
            :aria-label="$t('加载中...')"
          >
            <div class="slash-suggestion-skeleton__header" aria-hidden="true">
              <Skeleton width="100%" height="34px" border-radius="8px" />
              <Skeleton width="92px" height="34px" border-radius="10px" />
            </div>

            <div class="slash-suggestion-skeleton__list" aria-hidden="true">
              <div v-for="index in 5" :key="index" class="slash-suggestion-skeleton__row">
                <Skeleton width="16px" height="16px" border-radius="4px" />
                <Skeleton width="30%" height="16px" border-radius="4px" />
                <Skeleton width="42%" height="14px" border-radius="4px" />
                <Skeleton width="44px" height="16px" border-radius="4px" />
              </div>
            </div>
          </div>

          <div v-else-if="state.loading" class="suggestion-state">
            {{ $t('加载中...') }}
          </div>

          <WindowPickerPopover
            v-else-if="state.kind === 'mention'"
            :active-item="activeItem"
            :all-selected="allSelected"
            :has-more="hasMore"
            :items="state.items"
            :load-error="loadError"
            :loading-more="loadingMore"
            :project-options="projectOptions"
            :query="state.query"
            :selected-count="selectedCount"
            :selected-ids="selectedIds"
            :selected-project-id="selectedProjectId"
            :select-all-loading="selectAllLoading"
            @cancel="emit('cancel')"
            @choose="emit('choose', $event)"
            @confirm="emit('confirm')"
            @hover="emit('hover', $event)"
            @load-more="emit('loadMore')"
            @navigate="emit('navigate', $event)"
            @project-change="emit('projectChange', $event)"
            @retry="emit('retry')"
            @search="emit('search', $event)"
            @toggle-all="emit('toggleAll')"
          />

          <SlashCommandPopover
            v-else-if="state.kind === 'slash'"
            :active-item="activeItem"
            :items="state.items"
            :query="state.query"
            @choose="emit('choose', $event)"
            @hover="emit('hover', $event)"
            @navigate="emit('navigate', $event)"
            @read="emit('read', $event)"
            @search="emit('search', $event)"
          />

          <div v-else-if="!hasItems" class="suggestion-state">
            {{ $t('没有找到结果') }} "{{ state.query }}"
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.agent-composer-suggestions {
  position: absolute;
  top: -9999px;
  left: -9999px;
  z-index: 50;
  box-sizing: border-box;
  transform-origin: left bottom;
}

.agent-composer-suggestions__motion {
  width: 100%;
  max-height: inherit;
  border-radius: 16px;
  box-shadow: var(--agent-dialog-shadow);
}

.suggestion-state {
  padding: 20px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 12px;
  color: var(--color-text-quaternary, #737373);
  background: var(--color-bg-primary, var(--color-bg-primary));
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}

.slash-suggestion-skeleton {
  display: flex;
  width: 100%;
  min-height: 286px;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 16px;
  background: var(--color-bg-primary, var(--color-bg-primary));
}

.slash-suggestion-skeleton__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px;
  gap: 4px;
}

.slash-suggestion-skeleton__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slash-suggestion-skeleton__row {
  display: grid;
  min-height: 44px;
  align-items: center;
  gap: 9px;
  padding: 8px;
  grid-template-columns: 16px minmax(80px, 0.75fr) minmax(120px, 1fr) 44px;
}
</style>
