<!--
  Simple 模式消息组件

  用于显示 Simple 模式下的 AI 消息，包括：
  - 思考过程（当 eventType 为 'thinking' 时）
  - 普通内容（Markdown 格式）
  - 工具调用信息（如果有）
-->
<script setup lang="ts">
import type { Message } from '../../../types.js'
import ToolCalls from '../message-units/tool-calls.vue'
import ThinkingPlaceholder from '../message-units/thinking-placeholder.vue'
import { renderMarkdown } from '../utils/markdown.js'
import { computed } from 'vue'

const props = defineProps<{
  message: Message
}>()

const rawText = computed(() => props.message.rawText || props.message.content || '')
const hasContent = computed(() => !!rawText.value)
const hasToolCalls = computed(() => props.message.toolCalls && props.message.toolCalls.length > 0)
const shouldShowThinkingPlaceholder = computed(() => !hasContent.value && !hasToolCalls.value)
</script>

<template>
  <div class="message-content-wrapper message-simple-type">
    <div class="message-body">
      <ThinkingPlaceholder v-if="shouldShowThinkingPlaceholder" />
      <div v-else-if="hasContent" class="content-section" v-html="renderMarkdown(rawText)" />
      <ToolCalls v-if="hasToolCalls" :tool-calls="message.toolCalls" :show-notice="true" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.message-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.content-section {
  line-height: 1.6;
  color: #212529;
  font-size: 14px;
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
  color: var(--colors-text-text-secondary, #6a737d);
  border-left: 0.25em solid var(--colors-border-border-action, #dfe2e5);
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
</style>
