<script setup lang="ts">
import type { FormattedMessage, MessageEntryView, WorkerEntryView } from '/@/views/mcp/types'
import ThinkingBlockVue from './thinking-block.vue'
import ToolCallBlockVue from './tool-call-block.vue'
import { getBlockKey, getStatusIconProps, useMessageItem } from '../composables/useMessageItem'
import { markedParse } from '/@/views/mcp/util'
import StatusMessage from './status-message.vue'

const props = defineProps<{
  item: FormattedMessage
}>()

const taskExpandMap = reactive<{ [key: string]: boolean }>({})
const { toggleThinkingExpand, isThinkingExpanded } = useMessageItem()

function toggleTaskExpand(id: string) {
  taskExpandMap[id] = !taskExpandMap[id]
}

/**
 * 获取 worker 任务的摘要文字
 */
function getTaskSummary(block: MessageEntryView): string {
  const lastChunk = block.workers?.[block.workers.length - 1]

  if (block.status === 'success')
    return $t('成功')
  if (block.status === 'failed')
    return $t('失败')
  if (lastChunk?.type === 'tool_call')
    return $t(`正在执行: {name}`, { name: lastChunk.meta?.toolName })

  return $t('思考中...')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="!item.messageBlocks?.length" class="flex items-center gap-1">
      <span class="text-3 leading-[1.4] text-[var(--colors-text-text-primary)] font-600">{{ $t('规划中...') }}</span>
      <SvgIcon class="loading-circle" name="base/rx_ic_spin" size="14" color="var(--colors-icon-icon-tertiary)" />
    </div>

    <!-- Message Blocks (按顺序渲染 thinking, content, tool_call, worker) -->
    <template v-for="block in item.messageBlocks" v-else :key="getBlockKey(block)">
      <!-- Thinking -->
      <ThinkingBlockVue
        v-if="block.type === 'thinking'"
        :thinking="block"
        :expanded="isThinkingExpanded(block.id)"
        @toggle="toggleThinkingExpand(block.id)"
      />

      <!-- 顶层 Tool Call（非 worker 子任务） -->
      <ToolCallBlockVue v-else-if="block.type === 'tool_call'" :tool="block" />

      <!-- Content 文本 -->
      <div v-else-if="block.type === 'content' && block.text" class="text" :class="mode.content" v-html="markedParse(block.text)" />

      <!-- Worker 子任务 -->
      <div v-else-if="block.type === 'worker'" class="flex flex-col gap-1.5 px-3 py-1.5 rounded-2 worker" @click.stop="toggleTaskExpand(block.id)">
        <div class="flex items-center justify-between">
          <span class="select-none worker-title">{{ $t('任务 {id}', { id: block.id }) }}</span>
          <SvgIcon v-bind="getStatusIconProps(block.status)" />
        </div>
        <div v-if="!taskExpandMap[block.id]" class="ellipsis-1 worker-summary">
          {{ getTaskSummary(block) }}
        </div>
        <template v-else>
          <div v-if="block.workers?.length" class="flex flex-col gap-1">
            <template v-for="event in block.workers" :key="event.type + event.id">
              <ThinkingBlockVue
                v-if="event.type === 'thinking'"
                class="worker-think"
                :thinking="event"
                :expanded="isThinkingExpanded(event.id)"
                @toggle="toggleThinkingExpand(event.id)"
              />
              <ToolCallBlockVue v-else-if="event.type === 'tool_call'" :tool="event" @click.stop />
              <div v-else-if="event.type === 'content' && event.text" class="worker-desc" v-html="markedParse(event.text)" />
            </template>
          </div>
        </template>
      </div>

      <!-- Error/Interrupt 状态 -->
      <StatusMessage
        v-else-if="block.type === 'error' || block.type === 'interrupt'"
        :status="block.type"
        :message="block.text"
      />
    </template>
  </div>
</template>

<style lang="scss" module="mode">
.content {
  h1 {
    margin: 14px 0;
    font-size: 16px;
  }

  h2 {
    margin: 14px 0;
    font-size: 15px;
  }

  h3,
  h4,
  h5,
  h6 {
    margin: 14px 0;
    font-size: 14px;
  }

  code {
    font-size: 12px;
    font-family: JetBrains Mono;
    color: var(--colors-text-text-tertiary);
    text-wrap: auto;
  }
}
</style>

<style lang="scss" scoped>
.worker {
  border: 1px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--colors-border-border-action-hover);
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 700;
    line-height: 20px;
  }

  &-summary {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: 18px;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 12px;
    line-height: 18px;
  }

  &-think {
    padding: 4px 0;
  }

  :deep(.tool-loading) {
    color: var(--colors-icon-icon-tertiary);
  }

  :deep(.tool-success) {
    color: var(--colors-icon-icon-success);
  }

  :deep(.tool-failed) {
    color: var(--colors-icon-icon-error);
  }
}

.text {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 1.4;
}

.planning {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}
</style>
