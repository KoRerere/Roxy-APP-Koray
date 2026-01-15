<!--
  消息头部组件

  用于显示消息的标签和时间戳，支持用户消息和 AI 消息两种类型。

  Props:
    - label: string - 消息标签（如 "You" 或 "RoxyBrowser Official"）
    - timestamp: number - 时间戳（毫秒）
    - align?: 'left' | 'right' - 对齐方式（默认 'left'）
-->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** 消息标签 */
  label: string
  /** 时间戳（毫秒） */
  timestamp?: number
  /** 对齐方式 */
  align?: 'left' | 'right'
}>(), {
  align: 'left',
})

const formattedTime = computed(() => {
  if (!props.timestamp)
    return ''
  const date = new Date(props.timestamp)
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
})
</script>

<template>
  <div class="message-header" :class="`message-header-${align}`">
    <span class="message-label">{{ label }}</span>
    <span v-if="formattedTime" class="message-timestamp">{{ formattedTime }}</span>
  </div>
</template>

<style lang="scss" scoped>
.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.message-header-left {
  justify-content: flex-start;
}

.message-header-right {
  justify-content: flex-end;
}

.message-label {
  font-size: 14px;
  color: #1971c2;
  font-weight: 500;
}

.message-timestamp {
  font-size: 12px;
  color: #adb5bd;
}
</style>

