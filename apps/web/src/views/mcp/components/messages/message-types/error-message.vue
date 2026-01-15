<!--
  错误消息组件
  
  用于显示错误信息，使用红色警告样式，包含错误图标和错误内容。
-->
<script setup lang="ts">
import type { Message } from '../../../types.js'

defineProps<{
  message: Message
}>()
</script>

<template>
  <div class="error-container message-error-type">
    <div class="error-icon">
      ❌
    </div>
    <div class="error-content">
      <div class="error-title">
        错误
      </div>
      <div class="error-message">
        {{ typeof message.content === 'string' ? message.content : JSON.stringify(message.content) }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.error-container {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #f8d7da;
  border: 1px solid #f5c2c7;
  border-radius: 8px;
  color: #842029;
}

.error-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.error-content {
  flex: 1;
}

.error-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.error-message {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>

