<script setup lang="ts">
import type { AgentQueuedPrompt } from '../types'
import { queuedPromptDisplayContent } from '../prompt-queue'
import AgentTooltip from './AgentTooltip.vue'
import MarkdownContent from './MarkdownContent.vue'
import OverflowTooltip from './OverflowTooltip.vue'

const props = defineProps<{
  prompts: AgentQueuedPrompt[]
}>()

const emit = defineEmits<{
  remove: [promptId: string]
  reorder: [payload: { promptId: string, targetIndex: number }]
  restore: [promptId: string]
}>()

const draggingPromptId = ref<string>()
const dragTargetIndex = ref<number>()
const listRef = ref<HTMLElement | null>(null)

watch(
  () => props.prompts.map(item => item.id),
  async (promptIds, previousPromptIds) => {
    if (!promptIds.some(promptId => !previousPromptIds.includes(promptId))) {
      return
    }

    await nextTick()
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight
    }
  },
  { flush: 'post' },
)

function startDrag(event: DragEvent, promptId: string) {
  draggingPromptId.value = promptId
  event.dataTransfer?.setData('text/plain', promptId)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function isFileDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function markDropTarget(event: DragEvent, targetIndex: number) {
  if (isFileDrag(event)) {
    dragTargetIndex.value = undefined
    return
  }

  event.preventDefault()
  dragTargetIndex.value = targetIndex
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function dropPrompt(event: DragEvent, targetIndex: number) {
  if (isFileDrag(event)) {
    resetDrag()
    return
  }

  event.preventDefault()
  const promptId = draggingPromptId.value || event.dataTransfer?.getData('text/plain')
  if (promptId) {
    emit('reorder', { promptId, targetIndex })
  }
  resetDrag()
}

function resetDrag() {
  draggingPromptId.value = undefined
  dragTargetIndex.value = undefined
}
</script>

<template>
  <section v-if="prompts.length" class="prompt-queue" :aria-label="$t('提示词队列')">
    <div ref="listRef" class="prompt-queue__list">
      <article
        v-for="(item, index) in prompts"
        :key="item.id"
        class="prompt-queue__item"
        :class="{
          'prompt-queue__item--dragging': draggingPromptId === item.id,
          'prompt-queue__item--drop-target': dragTargetIndex === index && draggingPromptId !== item.id,
        }"
        draggable="true"
        @dragend="resetDrag"
        @dragover="markDropTarget($event, index)"
        @dragstart="startDrag($event, item.id)"
        @drop="dropPrompt($event, index)"
      >
        <AgentTooltip :content="$t('拖动排序')" placement="top" :offset="8">
          <span class="prompt-queue__handle" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </span>
        </AgentTooltip>
        <div class="prompt-queue__content">
          <OverflowTooltip
            :content="queuedPromptDisplayContent(item)"
            content-class="prompt-queue__content-tooltip"
            overflow-target-selector=".agent-markdown"
            placement="top-start"
          >
            <MarkdownContent :content="queuedPromptDisplayContent(item)" />
          </OverflowTooltip>
        </div>
        <span class="prompt-queue__actions">
          <AgentTooltip :content="$t('撤回并编辑')" placement="top" :offset="8">
            <button type="button" :aria-label="$t('撤回并编辑')" @click="emit('restore', item.id)">
              <SvgIcon name="base/rx_ic_agent_edit" size="16" color="currentColor" aria-hidden="true" />
            </button>
          </AgentTooltip>
          <AgentTooltip :content="$t('删除')" placement="top" :offset="8">
            <button type="button" :aria-label="$t('删除')" @click="emit('remove', item.id)">
              <SvgIcon name="roxy-agent/rx-ic-mcp-delete" size="16" color="currentColor" aria-hidden="true" />
            </button>
          </AgentTooltip>
        </span>
      </article>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.prompt-queue {
  position: relative;
  z-index: 0;
  width: calc(100% - 28px);
  margin-bottom: -1px;
  border: 1px solid var(--color-border-secondary);
  border-bottom: 0;
  border-radius: 18px 18px 0 0;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-shadow: var(--agent-composer-shadow);
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: auto;
}

.prompt-queue__list {
  display: flex;
  max-height: 224px;
  flex-direction: column;
  gap: 1px;
  overflow: auto;
  padding: 8px 8px 10px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.prompt-queue__item {
  display: flex;
  min-height: 28px;
  align-items: center;
  gap: 7px;
  padding: 3px 7px;
  border-radius: 8px;
  background: transparent;
  box-sizing: border-box;
  transition:
    background 0.15s ease,
    opacity 0.15s ease;

  &:hover {
    background: var(--color-bg-secondary-hover, var(--color-bg-quaternary));
  }
}

.prompt-queue__item--dragging {
  opacity: 0.45;
}

.prompt-queue__item--drop-target {
  box-shadow: inset 0 2px 0 var(--color-text-blue);
}

.prompt-queue__handle {
  display: grid;
  width: 10px;
  flex: 0 0 auto;
  grid-template-columns: repeat(2, 2px);
  gap: 2px;
  cursor: grab;
  opacity: 0.65;

  i {
    width: 2px;
    height: 2px;
    border-radius: 50%;
    background: var(--color-text-disabled);
  }
}

.prompt-queue__content {
  height: 20px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;

  :deep(.agent-markdown) {
    display: block;
    width: 100%;
    height: 20px;
    overflow: hidden;
    font-size: inherit;
    line-height: inherit;
    text-overflow: ellipsis;
    white-space: nowrap;
    word-break: normal;
  }

  :deep(.agent-markdown *) {
    overflow-wrap: normal;
    text-wrap: nowrap;
    white-space: nowrap;
    word-break: normal;
  }

  :deep(.agent-markdown > *) {
    display: inline;
    margin: 0;
  }

  :deep(.agent-markdown > * + *)::before {
    content: ' ';
  }

  :deep(.agent-markdown :where(ul, ol)) {
    padding-left: 0;
    list-style-position: inside;
  }

  :deep(.agent-markdown :where(li)) {
    display: inline;
    margin: 0;
  }

  :deep(.agent-markdown :where(pre, blockquote, .agent-md-table, .agent-md-code)) {
    display: inline;
    overflow: visible;
    padding: 0;
    border: 0;
    background: transparent;
  }

  :deep(.agent-markdown br) {
    display: none;
  }

  :deep(.agent-markdown :where(.agent-md-table__scroll)) {
    display: inline;
    overflow: visible;
  }

  :deep(.agent-markdown :where(table, thead, tbody, tr, th, td)) {
    display: inline;
    width: auto;
    padding: 0;
    border: 0;
  }

  :deep(.agent-markdown :where(th, td) + :where(th, td))::before {
    content: ' | ';
  }

  :deep(.agent-markdown roxy-agent-table-copy) {
    display: none;
  }
}

.prompt-queue__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;

  button {
    display: inline-flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 6px;
    color: var(--color-text-disabled);
    background: transparent;
    cursor: pointer;

    &:hover {
      color: var(--color-text-primary);
      background: var(--color-bg-tertiary-hover);
    }
  }
}
</style>

<style lang="scss">
.prompt-queue__content-tooltip > span:first-child {
  display: -webkit-box;
  max-height: 324px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 18;
}
</style>
