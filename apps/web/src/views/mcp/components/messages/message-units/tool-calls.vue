<!--
  工具调用显示组件

  用于显示 AI 调用 MCP 工具的信息，包括工具名称、参数、执行结果等。
  支持两种显示模式：
  1. 提示模式（showNotice=true）：在内容上方显示简洁的工具调用提示
  2. 详情模式：显示完整的工具调用信息，包括参数和结果

  Props:
    - toolCalls: ToolCall[] - 工具调用列表
    - showNotice?: boolean - 是否显示工具调用提示（默认 false）

  显示内容：
    - 工具名称和状态（进行中/已完成）
    - 工具参数（JSON 格式）
    - 工具执行结果（字符串或 JSON 格式）
    - 执行时间（如果有）
-->
<script setup lang="ts">
import { ref } from 'vue'
import type { ToolCall } from '../../../types.js'

defineProps<{
  /** 工具调用列表 */
  toolCalls: ToolCall[]
  /** 是否显示工具调用提示（在内容上方显示简洁提示） */
  showNotice?: boolean
}>()

/**
 * 记录每个工具调用参数是否展开
 * key 为下标 index，value 为是否展开
 */
const expandedArgsMap = ref<Record<number, boolean>>({})

function isArgsExpanded(index: number): boolean {
  return !!expandedArgsMap.value[index]
}

function toggleArgs(index: number) {
  expandedArgsMap.value[index] = !expandedArgsMap.value[index]
}
</script>

<template>
  <div>
    <!-- 工具调用提示 -->
    <div v-if="showNotice && toolCalls && toolCalls.length > 0" class="tool-call-notice">
      <button
        v-for="(tool, index) in toolCalls"
        :key="index"
        class="tool-call-button"
        :class="{ 'tool-completed': tool.result, 'tool-pending': !tool.result }"
      >
        <span class="tool-button-text">use tool {{ tool.toolName }}</span>
        <span v-if="tool.result" class="tool-status-icon">✓</span>
      </button>
    </div>

    <!-- 工具调用详情 -->
    <div v-if="toolCalls && toolCalls.length > 0" class="tools-section">
      <h5 class="section-title">
        工具调用 ({{ toolCalls.length }})
      </h5>
      <div class="tool-list">
        <div
          v-for="(tool, index) in toolCalls"
          :key="index"
          class="tool-item"
          :class="{ 'tool-completed': tool.result, 'tool-pending': !tool.result }"
        >
          <div class="tool-header">
            <div>
              <span class="tool-icon">{{ tool.result ? '✅ ' : '⏳ ' }}</span>
              <strong class="tool-name">{{ tool.toolName || 'unknown_tool' }}</strong>
              <span v-if="tool.executionTime" class="tool-time">{{ tool.executionTime }}ms</span>
            </div>
            <button
              v-if="tool.args || tool.result"
              type="button"
              class="tool-args-toggle"
              @click="toggleArgs(index)"
            >
              {{ isArgsExpanded(index) ? '⬆️' : '⬇️' }}
            </button>
          </div>
          <div v-if="isArgsExpanded(index)">
            <div v-if="tool.args" class="tool-args">
              <span class="tool-label">参数:</span>
              <pre class="tool-args-content">{{ JSON.stringify(tool.args, null, 2) }}</pre>
            </div>
            <div v-if="tool.result" class="tool-result">
              <span class="tool-label">结果:</span>
              <pre class="tool-result-content">{{ typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tool-call-notice {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
}

.tool-call-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #7c3aed;
  }

  &.tool-completed {
    background: #8b5cf6;
  }

  &.tool-pending {
    background: #a78bfa;
    opacity: 0.8;
  }
}

.tool-button-text {
  color: white;
}

.tool-status-icon {
  font-size: 14px;
  color: white;
}

.tools-section {
  margin: 12px 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--colors-text-text-primary, #212529);
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  border-left: 3px solid #ffc107;
  transition: all 0.2s;
}

.tool-item.tool-pending {
  border-left-color: #ffc107;
}

.tool-item.tool-completed {
  border-left-color: #75b798;
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.tool-icon {
  font-size: 16px;
}

.tool-name {
  flex: 1;
  color: var(--colors-text-text-primary, #212529);
}

.tool-time {
  font-size: 11px;
  color: var(--colors-text-text-secondary, #6c757d);
  font-family: monospace;
}

.tool-args,
.tool-result {
  margin-top: 8px;
  font-size: 12px;
}

.tool-label {
  font-weight: 600;
  color: var(--colors-text-text-secondary, #6c757d);
  margin-right: 8px;
}

.tool-args-content,
.tool-result-content {
  margin: 4px 0 0 0;
  padding: 8px;
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  overflow-x: auto;
  white-space: pre;
}
</style>
