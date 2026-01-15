<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.min.css'
import RxAvatar from '/@/components/rx-avatar'
import type { Message } from '../types.js'
import {
  DefaultMessage,
  ErrorMessage,
  PlanningMessage,
  SimpleMessage,
  SynthesisMessage,
  TokenUsage,
  UserMessage,
  WorkerMessage,
} from './messages/index.js'
import MessageHeader from './messages/message-units/message-header.vue'

const props = withDefaults(defineProps<{
  message: Message
  serverUrl?: string
  avatar?: string
  avatarColor?: string
  userName?: string
  showAvatar?: boolean
}>(), {
  showAvatar: true,
})

// emit 暂时未使用，但保留接口以便将来扩展
// const emit = defineEmits<{
//   viewWorkerDetail: [taskId: string]
//   stopWorkerTask: [taskId: string]
// }>()

const messageRef = ref<HTMLElement>()

// 计算 workers 列表
const workers = computed(() => {
  const result = props.message.workers || (props.message.workerData ? [props.message.workerData] : [])
  return result
})
// 监听消息内容变化，实时更新代码高亮
watch(
  () => [
    props.message.content,
    props.message.rawText,
    props.message.planningData?.content,
    props.message.planningData?.thinking,
    props.message.workerData?.content,
    props.message.workerData?.thinking,
    props.message.synthesisData?.content,
    props.message.synthesisData?.thinking,
  ],
  () => {
    nextTick(() => {
      highlightCode()
    })
  },
  { deep: true },
)

onMounted(() => {
  highlightCode()
})

function highlightCode() {
  if (messageRef.value) {
    messageRef.value.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement)
    })
  }
}
</script>

<template>
  <div
    ref="messageRef"
    class="message"
    :class="[
      `message-${message.type}`,
      message.phase && `message-phase-${message.phase}`,
      message.eventType && `message-event-${message.eventType}`,
    ]"
    :data-id="message.id"
    :data-type="message.type"
  >
    <!-- AI 消息 -->
    <template v-if="message.type === 'ai'">
      <div v-if="showAvatar" class="ai-message-header">
        <div class="ai-message-avatar">
          <RxAvatar :size="32" :font-size="0" color="#6c757d" />
        </div>
        <MessageHeader
          label="RoxyBrowser Official"
          :timestamp="message.timestamp"
          align="left"
        />
      </div>
      <div class="ai-message-body" :class="{ 'no-avatar': !showAvatar }">
        <div class="message-content-wrapper">
          <!-- 错误消息 -->
          <ErrorMessage
            v-if="message.eventType === 'error'"
            :message="message"
          />

          <template v-else>
            <!-- Planning 阶段 -->
            <PlanningMessage
              v-if="message.planningData"
              :message="message"
            />

            <!-- Worker 阶段 -->
            <template v-if="workers.length > 0">
              <WorkerMessage
                v-for="(worker, index) in workers"
                :key="worker.taskId || `worker-${index}`"
                :message="{ ...message, workerData: worker }"
                :server-url="serverUrl"
              />
            </template>
            <WorkerMessage
              v-else-if="message.workerData"
              :message="message"
              :server-url="serverUrl"
            />

            <!-- Simple 模式 -->
            <SimpleMessage
              v-if="
                message.phase === 'simple'
                  && (message.content || message.rawText || !!message?.toolCalls?.length)"
              :message="message"
            />

            <!-- Synthesis 阶段 -->
            <SynthesisMessage
              v-if="message.synthesisData"
              :message="message"
            />

            <!-- 默认消息（兜底：如果没有任何阶段数据） -->
            <DefaultMessage
              v-if="!message.planningData && !message.workerData && workers.length === 0 && !message.synthesisData && !message.content"
              :message="message"
            />
          </template>
        </div>
        <!-- Token 消耗信息 -->
        <TokenUsage
          v-if="message.tokenUsage?.total"
          :token-usage="message.tokenUsage"
        />
      </div>
    </template>

    <UserMessage
      v-else
      :message="message"
      :avatar="avatar"
      :avatar-color="avatarColor"
      :user-name="userName"
    />
  </div>
</template>

<style lang="scss" scoped>
.message {
  margin-bottom: 16px;
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

.message-user {
  text-align: right;
}

.ai-message-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.ai-message-avatar {
  flex-shrink: 0;
}

.ai-message-body {
  padding-left: 44px;
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e9ecef;
}

.action-btn {
  padding: 6px 12px;
  font-size: 12px;
  color: #6c757d;
  background: transparent;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f8f9fa;
    border-color: #dee2e6;
    color: #495057;
  }
}
</style>
