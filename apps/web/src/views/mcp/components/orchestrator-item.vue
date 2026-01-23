<script setup lang="ts">
import type { FormattedMessage, ToolCall, WorkerContent, WorkerTask, WorkerThinking } from '/@/views/mcp/types'
import PlanningBlockVue from './planning-block.vue'
import ThinkingBlockVue from './thinking-block.vue'
import ToolCallBlockVue from './tool-call-block.vue'
import StatusMessage from './status-message.vue'
import { getBlockKey, getStatusIconProps, useMessageItem } from '../composables/useMessageItem'
import { markedParse } from '/@/views/mcp/util'

const props = defineProps<{
  item: FormattedMessage
}>()

const taskExpandMap = ref(Object.fromEntries((props.item.workerTasks || []).map(task => [task.taskId, false])))
const { toggleThinkingExpand, isThinkingExpanded } = useMessageItem()

function toggleTaskExpand(taskId: string) {
  taskExpandMap.value[taskId] = !taskExpandMap.value[taskId]
}

// Worker 事件项类型（thinking、tool 或 content）
type WorkerEventItem
  = | { type: 'thinking', data: WorkerThinking, order: number }
    | { type: 'tool', data: ToolCall, order: number }
    | { type: 'content', data: WorkerContent, order: number }

/**
 * 合并 thinkings、toolCalls 和 contents 并按 order 排序
 * 保持 SSE 流中的原始顺序
 */
function getOrderedWorkerEvents(task: WorkerTask): WorkerEventItem[] {
  const events: WorkerEventItem[] = []

  for (const thinking of task.thinkings || []) {
    events.push({
      type: 'thinking',
      data: thinking,
      order: thinking.order ?? 0,
    })
  }

  for (const tool of task.toolCalls || []) {
    events.push({
      type: 'tool',
      data: tool,
      order: tool.order ?? 0,
    })
  }

  for (const content of task.contents || []) {
    events.push({
      type: 'content',
      data: content,
      order: content.order ?? 0,
    })
  }

  // 按 order 升序排列
  return events.sort((a, b) => a.order - b.order)
}

/**
 * 获取任务的简单摘要信息
 * 始终显示最后一个正在执行的阶段
 */
function getTaskSummary(task: WorkerTask): string {
  const thinkings = task.thinkings || []
  const toolCalls = task.toolCalls || []

  // 阶段0: 正在 thinking
  if (thinkings.some(t => t.isThinking)) {
    return $t('思考中...')
  }

  // 阶段1: 正在执行工具 - 显示最后一个 pending 工具
  const pendingTool = [...toolCalls].reverse().find(t => t.status === 'pending')
  if (pendingTool) {
    return $t(`正在执行: {name}`, { name: pendingTool.toolName })
  }

  // 阶段2: 工具执行完毕，正在生成内容
  if (task.status === 'pending') {
    return toolCalls.length > 0 ? $t('正在生成内容...') : $t('正在处理...')
  }

  // 阶段3: 任务完成 - 显示内容摘要或统计
  if (task.contents?.length) {
    const allContent = task.contents.map(c => c.text).join('')
    return allContent.replace(/<[^>]*>/g, '').trim()
  }

  if (toolCalls.length > 0) {
    const successCount = toolCalls.filter(t => t.status === 'success').length
    const errorCount = toolCalls.filter(t => t.status === 'failed').length
    if (errorCount > 0) {
      return $t('{successCount} 个工具执行成功, {errorCount} 个工具执行失败', { successCount, errorCount })
    }
    return $t('{count} 个工具执行成功', { count: successCount })
  }

  return task.status === 'success' ? $t('成功') : $t('失败')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- 规划 Blocks -->
    <PlanningBlockVue v-if="item.planningState" :planning-state="item.planningState" :planning-text="item.planningText" />

    <!-- Message Blocks (按顺序渲染 thinking, content, tool_call) -->
    <template v-for="block in item.messageBlocks" :key="getBlockKey(block)">
      <!-- Thinking -->
      <ThinkingBlockVue v-if="block.type === 'thinking'" :thinking="block" :expanded="isThinkingExpanded(block.thinkingId)" @toggle="toggleThinkingExpand(block.thinkingId)" />

      <!-- Tool Call (非 Worker 关联的) -->
      <ToolCallBlockVue v-else-if="block.type === 'tool_call' && !block.taskId" :tool="block" />

      <!-- Content 文本 -->
      <div v-else-if="block.type === 'content' && block.text" class="text" :class="mode.content" v-html="markedParse(block.text)" />
    </template>

    <!-- Worker Tasks -->
    <template v-if="item.workerTasks?.length">
      <div v-for="task in item.workerTasks" :key="task.taskId" class="flex flex-col gap-1.5 px-3 py-1.5 rounded-2 worker" @click.stop="toggleTaskExpand(task.taskId)">
        <div class="flex items-center justify-between">
          <span class="select-none worker-title">{{ $t('任务 {id}', { id: task.taskId }) }}</span>
          <SvgIcon v-bind="getStatusIconProps(task.status)" />
        </div>
        <div v-if="!taskExpandMap[task.taskId]" class="ellipsis-1 worker-summary">
          {{ getTaskSummary(task) }}
        </div>
        <template v-else>
          <!-- Worker Events (按 SSE 流顺序渲染 thinkings、toolCalls 和 contents) -->
          <div v-if="task.thinkings?.length || task.toolCalls?.length || task.contents?.length" class="flex flex-col gap-1">
            <template v-for="event in getOrderedWorkerEvents(task)"
                      :key="event.type === 'thinking' ? `thinking:${event.data.thinkingId}` : event.type === 'tool' ? `tool:${event.data.toolId}` : `content:${event.data.contentId}`"
            >
              <!-- Worker Thinking -->
              <ThinkingBlockVue v-if="event.type === 'thinking'" class="worker-think" :thinking="event.data" :expanded="isThinkingExpanded(event.data.thinkingId)"
                                @toggle="toggleThinkingExpand(event.data.thinkingId)"
              />
              <!-- Worker Tool Call -->
              <ToolCallBlockVue v-else-if="event.type === 'tool'" :tool="event.data" @click.stop />
              <!-- Worker Content -->
              <div v-else-if="event.type === 'content' && event.data.text" class="worker-desc" v-html="markedParse(event.data.text)" />
            </template>
          </div>
        </template>
      </div>
    </template>

    <!-- Synthesis 文本 (始终在最后) -->
    <div v-if="item.synthesisText" class="text" :class="mode.content" v-html="markedParse(item.synthesisText)" />

    <!-- Error/Interrupt 状态 -->
    <StatusMessage v-if="item.endStatus && item.endStatus !== 'done'" :status="item.endStatus" :message="item.errorMessage" />
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
