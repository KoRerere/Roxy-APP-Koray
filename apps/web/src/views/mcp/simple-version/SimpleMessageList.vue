<script setup lang="ts">
import type { SimpleMessage } from './types'

interface Props {
  messages: SimpleMessage[]
  avatar?: string
  avatarColor?: string
  userName?: string
}

defineProps<Props>()

const TEXT_MAP = {
  thinking: '思考中',
  generating: '执行任务中',
  success: '成功',
  error: '失败',
}

/**
 * 格式化时间戳
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${minutes}`
}
</script>

<template>
  <div class="simple-message-list">
    <div v-for="message in messages" :key="message.id" class="message-item">
      <!-- 用户消息 -->
      <div v-if="message.type === 'user'" class="message user-message">
        <div class="message-avatar">
          <RxAvatar
            :size="32"
            :font-size="14"
            :avatar="avatar"
            :name="userName?.slice(0, 2)"
            :color="avatarColor"
          />
        </div>
        <div class="message-body">
          <div class="message-header">
            <span class="message-author">{{ userName || '用户' }}</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="message-content user-content">
            {{ message.content }}
          </div>
        </div>
      </div>

      <!-- AI 消息 -->
      <div v-else-if="message.type === 'ai'" class="message ai-message">
        <div class="message-avatar">
          <div class="avatar-placeholder ai-avatar">
            <img src="/images/mcp-simple/logo.svg" alt="AI" class="ai-logo">
          </div>
        </div>
        <div class="message-body">
          <div class="message-header">
            <span class="message-author">RoxyBrowser Official</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>

          <!-- 状态标签 -->
          <div class="status-badge">
            <template v-if="message.status === 'thinking'">
              <span style="font-size: 14px;">🤔</span>
              <span class="status-text">{{ TEXT_MAP.thinking }}</span>
              <img
                src="/images/mcp-simple/load.svg"
                alt="思考中"
                class="status-icon spinning"
              >
            </template>
            <template v-else>
              <span class="status-text">{{ TEXT_MAP[message.status!] }}</span>
            </template>
          </div>

          <!-- AI 消息内容 -->
          <!-- <div v-if="message.content" class="message-content ai-content">
            {{ message.content }}
          </div> -->
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.simple-message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: #ffffff;
  font-size: 12px;
  :deep(.message-author) {
    font-size: 12px;
    font-weight: 700;
    color: var(--colors-text-text-placeholder, #7c8387);
  }
}

.message-item {
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.message {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.message-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  color: white;
}

.ai-avatar {
  .ai-logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.message-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-author {
  font-weight: 500;
  color: #111827;
}

.message-time {
  color: #9ca3af;
}

.status-badge {
  display: flex;
  align-items: center;
  width: fit-content;
  padding: 4px 6px;
  gap: 4px;
  border-radius: 4px;
  background: var(--component-button-tertiary-bg-hover, #f4f5f5);
  min-width: 86px;
}

.status-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;

  &.spinning {
    animation: spin 1s linear infinite;
  }
}

.status-text {
  font-weight: 600;
}

.message-content {
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #374151;
}

.user-content {
  padding: 0;
}

.ai-content {
  padding: 0;
}
</style>
