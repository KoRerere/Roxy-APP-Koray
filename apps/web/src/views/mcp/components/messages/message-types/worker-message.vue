<!--
  Worker 阶段消息组件

  用于显示 Orchestrator 模式下的 Worker 阶段消息，包括：
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Message } from '../../../types.js'
import ToolCalls from '../message-units/tool-calls.vue'
import ThinkingPlaceholder from '../message-units/thinking-placeholder.vue'
import { renderMarkdown } from '../utils/markdown.js'

const props = defineProps<{
  message: Message
  serverUrl?: string
}>()
console.log('[WorkerMessage] message:', props.message)
const isExpanded = ref(false)

const workerId = computed(() => {
  const taskId = props.message.workerData?.taskId || ''
  if (taskId) {
    const match = taskId.match(/\d+/)
    return match ? match[0] : taskId
  }
  return 'N/A'
})

const workerTitle = computed(() => {
  const task = props.message.workerData?.task || 'Task'
  return `Worker${workerId.value} - ${task}`
})

const isPending = computed(() => props.message.workerData?.status === 'pending')

// 获取思考内容
const thinkingText = computed(() => {
  const thinking = props.message.workerData?.thinking || ''
  return thinking.trim()
})

const hasThinking = computed(() => thinkingText.value.length > 0)

// 获取纯文本内容（去除工具调用相关的文本）
const textContent = computed(() => {
  const content = props.message.workerData?.content || ''
  return content
})

// 判断内容是否超过三行
const hasMoreContent = computed(() => {
  return textContent.value.length > 150
})

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="message-content-wrapper message-worker-type">
    <div class="worker-card">
      <!-- Worker 标题和状态 -->
      <div class="worker-header">
        <div class="worker-title-row">
          <span class="worker-title">{{ workerTitle }}</span>
        </div>
      </div>

      <!-- 思考阶段 -->
      <!-- <ThinkingPlaceholder v-if="isPending" />

      <div v-else-if="hasThinking" class="worker-thinking">
        <div class="worker-thinking-label">
          Think...
        </div>

      </div> -->

      <!-- Worker 内容（最多显示三行，可展开） -->
      <div v-if="textContent" class="worker-content-section">
        <div
          class="worker-text"
          :class="{ 'worker-text-collapsed': !isExpanded && hasMoreContent }"
          v-html="renderMarkdown(textContent)"
        />
        <button
          v-if="hasMoreContent"
          class="expand-toggle"
          @click="toggleExpand"
        >
          {{ isExpanded ? '收起' : '展开' }}
        </button>
      </div>

      <!-- 工具调用（单独显示，与其他文本分割开） -->
      <div v-if="(message.workerData?.toolCalls && message.workerData.toolCalls.length > 0) || (message.toolCalls && message.toolCalls.length > 0)" class="worker-tools-section">
        <ToolCalls :tool-calls="message.workerData?.toolCalls || message.toolCalls || []" :show-notice="true" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.message-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.worker-card {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 12px;
  margin: 4px 0;
}

.worker-header {
  margin-bottom: 8px;
}

.worker-thinking {
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(226, 229, 235, 0.8);
  font-size: 14px;
  color: var(--colors-text-text-primary, #212529);
}

.worker-thinking-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--colors-text-text-secondary, #6c757d);
  margin-bottom: 6px;
}

.worker-thinking-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--colors-text-text-primary, #212529);
}

.worker-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.worker-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--colors-text-text-primary, #212529);
  flex: 1;
}

.gear-icon {
  font-size: 14px;
  opacity: 0.6;
}

.status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
}

.status-completed {
  background: #d1e7dd;
  color: #0f5132;
}

.status-paused {
  background: #e9ecef;
  color: #6c757d;
}

.worker-content-section {
  margin: 8px 0;
  position: relative;
}

.worker-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--colors-text-text-primary, #212529);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.worker-text-collapsed {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-clamp: 3;
  overflow: hidden;
  text-overflow: ellipsis;
}

.expand-toggle {
  margin-top: 8px;
  padding: 4px 8px;
  font-size: 12px;
  color: #1971c2;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: #0d5aa7;
    text-decoration: underline;
  }
}

.worker-tools-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

/* Markdown 样式 */
.worker-text :deep(h1),
.worker-text :deep(h2),
.worker-text :deep(h3) {
  margin-top: 0.5em;
  margin-bottom: 0.25em;
  font-weight: 600;
  line-height: 1.25;
}

.worker-text :deep(p) {
  margin: 0.25em 0;
}

.worker-text :deep(ul),
.worker-text :deep(ol) {
  margin: 0.25em 0;
  padding-left: 1.5em;
}

.worker-text :deep(li) {
  margin: 0.125em 0;
}

.worker-text :deep(blockquote) {
  margin: 0.25em 0;
  padding: 0 0.75em;
  color: var(--colors-text-text-secondary, #6a737d);
  border-left: 0.25em solid var(--colors-border-border-action, #dfe2e5);
}

.worker-text :deep(code) {
  padding: 0.15em 0.3em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
}

.worker-text :deep(pre) {
  padding: 12px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #1e1e1e;
  border-radius: 6px;
  margin: 0.5em 0;
}

.worker-text :deep(pre code) {
  display: block;
  padding: 0;
  margin: 0;
  overflow: visible;
  line-height: inherit;
  word-wrap: normal;
  background-color: transparent;
  border: 0;
  color: #d4d4d4;
}
</style>
