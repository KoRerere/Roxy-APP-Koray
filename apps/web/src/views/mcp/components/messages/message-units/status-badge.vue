<!--
  状态徽章组件

  用于显示任务或阶段的状态，支持多种状态类型（分析中、运行中、已完成等），
  每种状态都有对应的颜色和样式。自动将英文状态码转换为中文显示。

  Props:
    - status: string - 状态码（如 'analyzing', 'running', 'completed' 等）

  支持的状态类型：
    - analyzing, drafting, thinking, generating, running - 进行中（黄色）
    - completed, generated - 已完成（绿色）
    - pending - 等待中（蓝色）
    - error - 错误（红色）
    - started - 已开始（浅蓝色）
-->
<script setup lang="ts">
defineProps<{
  /** 状态码（如 'analyzing', 'running', 'completed' 等） */
  status: string
}>()

/**
 * 获取状态的中文显示文本
 * @param status - 状态码
 * @returns 中文状态文本
 */
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    analyzing: '分析中',
    drafting: '起草中',
    generated: '已完成',
    pending: '等待中',
    running: '运行中',
    completed: '已完成',
    error: '错误',
    started: '已开始',
    thinking: '思考中',
    generating: '生成中',
  }
  return statusMap[status] || status
}

/**
 * 获取状态对应的 CSS 类名
 * @param status - 状态码
 * @returns CSS 类名
 */
function getStatusClass(status: string): string {
  const classMap: Record<string, string> = {
    analyzing: 'status-analyzing',
    drafting: 'status-drafting',
    thinking: 'status-thinking',
    generating: 'status-generating',
    running: 'status-running',
    completed: 'status-completed',
    generated: 'status-generated',
    pending: 'status-pending',
    error: 'status-error',
    started: 'status-started',
  }
  return classMap[status] || ''
}
</script>

<template>
  <span
    v-if="status"
    class="status-badge"
    :class="getStatusClass(status)"
  >
    {{ getStatusText(status) }}
  </span>
</template>

<style lang="scss" scoped>
.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.status-analyzing,
.status-drafting,
.status-thinking,
.status-generating,
.status-running {
  background: #fff3cd;
  color: #856404;
}

.status-completed,
.status-generated {
  background: #d1e7dd;
  color: #0f5132;
}

.status-pending {
  background: #e7f5ff;
  color: #1971c2;
}

.status-error {
  background: #f8d7da;
  color: #842029;
}

.status-started {
  background: #cfe2ff;
  color: #084298;
}
</style>

