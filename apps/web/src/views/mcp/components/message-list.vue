<script setup lang="ts">
import MessageItem from './message-item.vue'
import EmptyState from './empty-state.vue'
import { computed, nextTick, watch } from 'vue'
import type { Message } from '../types.js'

const props = defineProps<{
  messages: Message[]
  isAIThinking?: boolean
  serverUrl?: string
  avatar?: string
  avatarColor?: string
  userName?: string
}>()

const emit = defineEmits<{
  viewWorkerDetail: [taskId: string]
  stopWorkerTask: [taskId: string]
}>()

const messagesRef = ref<HTMLElement>()
const isAIThinking = computed(() => props.isAIThinking || false)
const hasMessages = computed(() => props.messages.length > 0)

watch(
  () => props.messages.length,
  () => {
    nextTick(() => {
      scrollToBottom()
    })
  },
  { immediate: true },
)

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

/**
 * 判断是否应该显示头像
 * 同一条 AI 消息只显示一个头像（显示在第一条）
 */
function shouldShowAvatar(message: Message, index: number, allMessages: Message[]): boolean {
  // 用户消息始终显示头像
  if (message.type === 'user') {
    return true
  }

  // AI 消息：检查是否是同一条消息
  if (message.type === 'ai') {
    // 如果是第一条消息，显示头像
    if (index === 0) {
      return true
    }

    // 检查前一条消息
    const prevMessage = allMessages[index - 1]

    // 如果前一条消息是用户消息，显示头像
    if (prevMessage.type === 'user') {
      return true
    }

    // 如果前一条消息也是 AI 消息，检查是否是同一条消息（通过 userMessageId 判断）
    if (prevMessage.type === 'ai') {
      // 如果是同一条消息（相同的 userMessageId），不显示头像
      if (message.userMessageId && prevMessage.userMessageId && message.userMessageId === prevMessage.userMessageId) {
        return false
      }
      // 如果是不同的消息，显示头像
      return true
    }
  }

  return true
}
</script>

<template>
  <div ref="messagesRef" class="messages">
    <!-- 空状态：当没有消息时显示 -->
    <EmptyState v-if="!hasMessages && !isAIThinking" />

    <!-- 消息列表 -->
    <MessageItem
      v-for="(message, index) in messages"
      :key="message.id || index"
      :message="message"
      :server-url="serverUrl"
      :avatar="avatar"
      :avatar-color="avatarColor"
      :user-name="userName"
      :show-avatar="shouldShowAvatar(message, index, messages)"
      @view-worker-detail="emit('viewWorkerDetail', $event)"
      @stop-worker-task="emit('stopWorkerTask', $event)"
    />
    <!-- 优化5：显示 AI 思考/生成中的提示 -->
    <div v-if="isAIThinking" class="thinking-placeholder">
      <div class="thinking-dots">
        <span />
        <span />
        <span />
      </div>
      <span class="thinking-text">AI 正在思考/生成中...</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: var(--colors-background-bg-base, #ffffff);
  display: flex;
  flex-direction: column;
}

.thinking-placeholder {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #e7f5ff;
  border-radius: 8px;
  margin-top: 12px;
  border-left: 3px solid #1971c2;
}

.thinking-dots {
  display: flex;
  gap: 4px;
}

.thinking-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1971c2;
  animation: thinking-dot 1.4s ease-in-out infinite;
}

.thinking-dots span:nth-child(1) {
  animation-delay: 0s;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes thinking-dot {
  0%,
  60%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  30% {
    transform: scale(1.2);
    opacity: 1;
  }
}

.thinking-text {
  color: #1971c2;
  font-size: 14px;
  font-weight: 500;
}
</style>
