<!--
  Synthesis 阶段消息组件

  用于显示 Orchestrator 模式下的综合阶段消息，包括：
  - 综合阶段标题和状态
  - 思考过程（如果有）
  - 综合后的内容（Markdown 格式）
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '../../../types.js'
import { renderMarkdown } from '../utils/markdown.js'

const props = defineProps<{
  message: Message
}>()

const hasThinking = computed(() => {
  const thinking = props.message.synthesisData?.thinking || ''
  return thinking.trim().length > 0
})

const thinkingText = computed(() => props.message.synthesisData?.thinking || '')
</script>

<template>
  <div class="message-content-wrapper message-synthesis-type">
    <div class="phase-container phase-synthesis">
      <!-- 思考阶段 -->
      <div v-if="hasThinking" class="synthesis-thinking">
        <div class="synthesis-thinking-label">
          Think...
        </div>
        <div
          class="synthesis-thinking-text"
          v-html="renderMarkdown(thinkingText)"
        />
      </div>

      <!-- 内容 -->
      <div v-if="message.synthesisData?.content" class="content-section" v-html="renderMarkdown(message.synthesisData.content || '')" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.message-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.phase-container {
  background: transparent;
  border-radius: 8px;
  padding: 0;
  margin-top: 0;
}

.phase-synthesis {
  background: transparent;
}

.synthesis-thinking {
  margin: 8px 0 12px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(226, 229, 235, 0.8);
  font-size: 14px;
  color: var(--colors-text-text-primary, #212529);
}

.synthesis-thinking-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--colors-text-text-secondary, #6c757d);
  margin-bottom: 6px;
}

.synthesis-thinking-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--colors-text-text-primary, #212529);
}

.content-section {
  margin: 12px 0;
  background: rgba(255, 255, 255, 0.8);
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
