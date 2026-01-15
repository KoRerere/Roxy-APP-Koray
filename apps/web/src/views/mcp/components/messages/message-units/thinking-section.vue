<!--
  思考过程显示组件

  用于显示 AI 的思考过程内容，通常出现在 Planning、Worker、Synthesis 等阶段。
  显示格式为带标签的文本区域，使用斜体样式以区分于普通内容。

  Props:
    - thinking: string - 思考过程的文本内容
    - isActive: boolean - 是否正在思考中（用于控制计时）
-->
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  /** 思考过程的文本内容 */
  thinking?: string
  /** 是否正在思考中（用于控制计时） */
}>()
</script>

<template>
  <div class="thinking-section">
    {{ thinking ? thinking : 'Thinking ...' }}
  </div>
</template>

<style lang="scss" scoped>
.thinking-section {
  font-size: 12px;
  width: 100%;
  padding: 8px 12px;
  background: #e2e5eb;
}

.thinking-label {
  font-size: 14px;
  font-weight: 500;
  color: #6c757d;
  font-style: italic;
}
</style>
