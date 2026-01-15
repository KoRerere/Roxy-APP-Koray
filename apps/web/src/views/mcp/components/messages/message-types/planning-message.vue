<!--
  Planning 阶段消息组件

  用于显示 Orchestrator 模式下的规划阶段消息，包括：
  - 规划阶段标题和状态
  - 思考过程（如果有）
  - 任务列表（包含任务描述、依赖关系、状态等）

-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '../../../types.js'
import { renderMarkdown } from '../utils/markdown.js'
import ThinkingPlaceholder from '../message-units/thinking-placeholder.vue'

const props = defineProps<{
  message: Message
}>()

// 直接输出 planning 阶段的思考内容（优先使用 content，其次是 thinking）
const thinkingText = computed(() => {
  const planning = props.message.planningData
  const text = (planning?.content || planning?.thinking || props.message.content || '').trim()
  return text
})

const hasThinking = computed(() => thinkingText.value.length > 0)

// 判断是否已完成
const isCompleted = computed(() => {
  const status = props.message.planningData?.status
  return status === 'completed' || status === 'generated'
})

// 是否有主题内容（思考内容或任务列表）
const hasMainContent = computed(() => {
  return hasThinking.value || (props.message.planningData?.plan && props.message.planningData.plan.length > 0)
})

// 是否显示 Thinking... 占位符（未完成且没有主题内容时显示）
const shouldShowThinkingPlaceholder = computed(() => {
  return !isCompleted.value && !hasMainContent.value
})
</script>

<template>
  <div class="message-wrapper message-planning-type">
    <div class="message-content">
      <div class="phase-container phase-planning">
        <ThinkingPlaceholder v-if="shouldShowThinkingPlaceholder" />

        <div v-else-if="hasThinking" class="planning-thinking">
          <div
            class="planning-thinking-text"
            v-html="renderMarkdown(thinkingText)"
          />
        </div>

        <div v-if="message.planningData?.plan && message.planningData.plan.length > 0" class="plan-tasks">
          <h5 class="section-title">
            任务列表 ({{ message.planningData.plan.length }})
          </h5>
          <ul class="task-list">
            <li
              v-for="(task, index) in message.planningData.plan"
              :key="task.taskId || index"
              class="task-item"
              :class="{ 'task-pending': task.status === 'pending', 'task-running': task.status === 'running', 'task-completed': task.status === 'completed' }"
            >
              <span class="task-number">{{ index + 1 }}.</span>
              <span class="task-text">{{ task.task }}</span>
              <span v-if="task.dependencies && task.dependencies.length > 0" class="task-dependencies">
                (依赖: {{ task.dependencies.join(', ') }})
              </span>
              <span v-if="task.status" class="task-status-text">
                {{ task.status }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.message-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: flex-start;
}

.message-avatar {
  flex-shrink: 0;

  :deep(.rx-avatar) {
    border: 2px solid #1971c2;
  }
}

.message-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.phase-planning {
  width: 100%;
  background: transparent;
}

.planning-thinking {
  margin: 8px 0 12px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(226, 229, 235, 0.8);
  font-size: 14px;
  color: var(--colors-text-text-primary, #212529);
}

.planning-thinking-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--colors-text-text-secondary, #6c757d);
  margin-bottom: 6px;
}

.planning-thinking-text {
  :deep(p) {
    margin: 0 0 4px 0;
  }

  :deep(p:last-child) {
    margin-bottom: 0;
  }

  :deep(code) {
    padding: 0.15em 0.3em;
    margin: 0;
    font-size: 85%;
    background-color: rgba(27, 31, 35, 0.05);
    border-radius: 3px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  }

  :deep(pre) {
    padding: 8px 10px;
    overflow: auto;
    font-size: 12px;
    line-height: 1.45;
    background-color: #1e1e1e;
    border-radius: 4px;
    margin: 6px 0;
  }

  :deep(pre code) {
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
}

.plan-tasks {
  margin: 12px 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--colors-text-text-primary, #212529);
}

.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.task-item {
  display: flex;
  align-items: flex-start;
  padding: 8px 12px;
  margin: 4px 0;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 6px;
  border-left: 3px solid #74c0fc;
  transition: all 0.2s;
}

.task-item.task-pending {
  border-left-color: #74c0fc;
}

.task-item.task-running {
  border-left-color: #ffc107;
  background: rgba(255, 243, 205, 0.8);
}

.task-item.task-completed {
  border-left-color: #75b798;
  background: rgba(209, 231, 221, 0.8);
}

.task-number {
  font-weight: 600;
  margin-right: 8px;
  color: #1971c2;
  min-width: 24px;
}

.task-text {
  flex: 1;
  color: var(--colors-text-text-primary, #212529);
}

.task-dependencies {
  font-size: 12px;
  color: var(--colors-text-text-secondary, #6c757d);
  margin-left: 8px;
}

.task-status-text {
  margin-left: auto;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #e7f5ff;
  color: #1971c2;
}
</style>
