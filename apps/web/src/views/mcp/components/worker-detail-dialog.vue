<!--
  Worker 详情对话框组件

  显示 Worker 任务的完整详情，包括：
  - 任务标题和状态
  - 任务 ID
  - 思考过程
  - 执行内容（Markdown 格式）
  - 工具调用信息
  - 支持中断任务
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '../types.js'
import StatusBadge from './messages/message-units/status-badge.vue'
import ThinkingSection from './messages/message-units/thinking-section.vue'
import ToolCalls from './messages/message-units/tool-calls.vue'
import { renderMarkdown } from './messages/utils/markdown.js'

const props = defineProps<{
  /** 是否显示对话框 */
  visible: boolean
  /** Worker 消息对象 */
  message: Message | null
}>()

const emit = defineEmits<{
  /** 关闭对话框 */
  close: () => void
  /** 中断任务 */
  stopTask: [taskId: string]
}>()

const workerData = computed(() => props.message?.workerData)
const isRunning = computed(() => workerData.value?.status === 'running')
const canStop = computed(() => isRunning.value || workerData.value?.status === 'pending')

function handleStopTask() {
  if (workerData.value?.taskId) {
    emit('stopTask', workerData.value.taskId)
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && message" class="dialog-overlay" @click="$emit('close')">
      <div class="dialog-content worker-detail-dialog" @click.stop>
        <div class="dialog-header">
          <h3>Worker 详情</h3>
          <button class="close-button" @click="$emit('close')">
            <span style="font-size: 18px;">×</span>
          </button>
        </div>

        <div class="worker-detail-content">
          <!-- 任务标题和状态 -->
          <div class="detail-section">
            <div class="section-header">
              <h4 class="section-title">
                任务信息
              </h4>
              <div class="header-actions">
                <StatusBadge v-if="workerData?.status" :status="workerData.status" />
                <button
                  v-if="canStop"
                  class="stop-button"
                  title="中断任务"
                  @click="handleStopTask"
                >
                  <span style="font-size: 14px;">⏸</span>
                  <span class="stop-button-text">停止任务</span>
                </button>
              </div>
            </div>
            <div class="detail-item">
              <span class="detail-label">任务:</span>
              <span class="detail-value">{{ workerData?.task || 'N/A' }}</span>
            </div>
            <div v-if="workerData?.taskId" class="detail-item">
              <span class="detail-label">任务 ID:</span>
              <span class="detail-value task-id">{{ workerData.taskId }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">状态:</span>
              <span class="detail-value">{{ workerData?.status || 'N/A' }}</span>
            </div>
          </div>

          <!-- 思考过程 -->
          <div v-if="workerData?.thinking" class="detail-section">
            <h4 class="section-title">
              思考过程
            </h4>
            <ThinkingSection
              :thinking="workerData.thinking"
              :is-active="!workerData.content"
            />
          </div>

          <!-- 执行内容 -->
          <div v-if="workerData?.content" class="detail-section">
            <h4 class="section-title">
              执行内容
            </h4>
            <div class="content-section" v-html="renderMarkdown(workerData.content)" />
          </div>

          <!-- 工具调用 -->
          <div v-if="message.toolCalls && message.toolCalls.length > 0" class="detail-section">
            <h4 class="section-title">
              工具调用
            </h4>
            <ToolCalls :tool-calls="message.toolCalls" />
          </div>
        </div>

        <div class="dialog-actions">
          <button class="btn-cancel" @click="$emit('close')">
            关闭
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-content {
  background: white;
  border-radius: 8px;
  padding: 0;
  min-width: 600px;
  max-width: 900px;
  max-height: 90vh;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.worker-detail-dialog {
  min-width: 700px;
  max-width: 1000px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #212529;
  }
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #6c757d;
  transition: all 0.2s;

  &:hover {
    background: #f8f9fa;
    color: #212529;
  }
}

.worker-detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.detail-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #212529;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stop-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #ff6b6b;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #ff6b6b;
  font-size: 14px;
  transition: all 0.2s;

  &:hover {
    background: #ff6b6b;
    color: white;
  }
}

.stop-button-text {
  font-size: 14px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 14px;
}

.detail-label {
  font-weight: 500;
  color: #6c757d;
  min-width: 80px;
}

.detail-value {
  color: #212529;
  flex: 1;
}

.task-id {
  font-family: monospace;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
}

.content-section {
  margin: 12px 0;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  line-height: 1.6;
}

/* Markdown 样式 */
.content-section :deep(h1),
.content-section :deep(h2),
.content-section :deep(h3) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
}

.content-section :deep(p) {
  margin: 0.5em 0;
}

.content-section :deep(ul),
.content-section :deep(ol) {
  margin: 0.5em 0;
  padding-left: 2em;
}

.content-section :deep(li) {
  margin: 0.25em 0;
}

.content-section :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
}

.content-section :deep(code) {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
}

.content-section :deep(pre) {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #1e1e1e;
  border-radius: 6px;
  margin: 0.5em 0;
}

.content-section :deep(pre code) {
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

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e9ecef;
}

.btn-cancel {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  background: #e9ecef;
  color: #495057;

  &:hover {
    background: #dee2e6;
  }
}
</style>
