<script setup lang="ts">
import RxCard from '/@/components/rx-card'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import Textarea from 'primevue/textarea'
import Header from './components/header.vue'
import HistoryDialog from './components/history-dialog.vue'
import SimpleMessageList from './simple-version/SimpleMessageList.vue'
import { SimpleMessageHandler } from './simple-version/SimpleMessageHandler'
import type { SimpleMessage, SimpleStreamEvent } from './simple-version/types'
import { loadSimpleHistory } from './simple-version/historyLoader'
import { useUserStore } from '/@/stores/user'
import { API } from '/@/api'

const { fetchUserInfo } = useUserStore()
const { userInfo } = storeToRefs(useUserStore())
const mcpPort = ref()
const serverUrl = computed(() => `http://localhost:${mcpPort.value}`)
const sessionId = ref<string | null>(null)
const sessions = ref<Array<{ sessionId: string }>>([])
const messages = ref<SimpleMessage[]>([])

const messageInput = ref('')
const isStreaming = ref(false)
const currentReader = ref<ReadableStreamDefaultReader<Uint8Array> | null>(null)
const historyLoaded = ref(false)
/**
 * 新增：历史记录加载状态
 */
const isLoadingHistory = ref(false)
const showHistoryDialog = ref(false)
const multiTaskEnabled = ref(false)
const messageInputRef = ref<any>(null)

/**
 * 模式：根据 Multi-task 开关自动设置
 */
const mode = computed({
  get: () => multiTaskEnabled.value ? 'orchestrator' : 'simple',
  set: (value: string) => {
    multiTaskEnabled.value = value === 'orchestrator'
  },
})

/**
 * 输入框是否禁用
 */
const isInputDisabled = computed(() => {
  return isStreaming.value || isLoadingHistory.value
})

/**
 * 消息处理器
 */
const messageHandler = new SimpleMessageHandler()

/**
 * 检查服务器连接
 */
async function checkConnection() {
  try {
    const response = await fetch(`${serverUrl.value}/health`)
    if (response.ok) {
      return true
    }
    else {
      throw new Error('服务器响应异常')
    }
  }
  catch (error: any) {
    return false
  }
}

/**
 * 加载用户会话列表
 */
async function loadSessions() {
  if (!userInfo.value?.id) {
    return
  }

  try {
    const userId = String(userInfo.value.id)
    const response = await fetch(`${serverUrl.value}/api/sessions`)

    if (!response.ok) {
      if (response.status === 404) {
        sessions.value = []
        return
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const allThreads = data.threads || []
    const userThreads = allThreads.filter((threadId: string) =>
      threadId.startsWith(userId) || threadId === userId,
    )

    sessions.value = userThreads.map((threadId: string) => ({
      sessionId: threadId,
    }))
  }
  catch (error: any) {
    console.error('[Simple] Failed to load sessions:', error)
    sessions.value = []
  }
}

/**
 * 加载历史记录
 */
async function loadHistory(targetSessionId?: string | null) {
  if (!userInfo.value?.id) {
    return
  }

  console.log('start load history')

  try {
    const sessionIdToLoad = targetSessionId || sessionId.value

    if (!sessionIdToLoad) {
      await loadSessions()
      if (sessions.value.length > 0) {
        const latestSession = sessions.value[0]
        if (latestSession) {
          await loadHistoryForSession(latestSession.sessionId)
        }
      }
      else {
        historyLoaded.value = true
      }
      return
    }

    await loadHistoryForSession(sessionIdToLoad)
  }
  catch (error: any) {
    console.error('[Simple] Failed to load history:', error)
    // historyLoaded.value = true
  }
  finally {
    // 清除加载状态
    historyLoaded.value = true
    isLoadingHistory.value = false
  }
}

/**
 * 加载指定会话的历史记录
 */
async function loadHistoryForSession(targetSessionId: string) {
  if (!userInfo.value?.id)
    return

  // 设置加载状态
  isLoadingHistory.value = true

  try {
    const userId = String(userInfo.value.id)

    // 加载历史消息
    const loadedMessages = await loadSimpleHistory(
      targetSessionId,
      userId,
      serverUrl.value,
    )
    console.log('loadedMessages', loadedMessages)

    // 设置会话状态
    sessionId.value = targetSessionId
    messageHandler.setMessages(loadedMessages)
    messages.value = messageHandler.getMessages()
    historyLoaded.value = true
  }
  catch (error: any) {
    console.error('[Simple] Failed to load history:', error)
    sessionId.value = targetSessionId
    messageHandler.clear()
    messages.value = []
    historyLoaded.value = true
  }
  finally {
    // 清除加载状态
    isLoadingHistory.value = false
  }
}

/**
 * 处理 SSE 事件
 */
function handleSSEEvent(event: { type: string, data: any }) {
  const { type, data } = event

  console.log('[Simple.vue] Received SSE event:', type, data)

  // 处理 session 事件
  if (type === 'session' && data?.sessionId) {
    sessionId.value = data.sessionId
    if (!sessions.value.find(s => s.sessionId === data.sessionId)) {
      sessions.value.push({ sessionId: data.sessionId })
    }
    return
  }

  // 如果正在加载历史记录，不处理实时SSE事件
  if (!historyLoaded.value) {
    console.log('[Simple.vue] Skipping event - history not loaded yet')
    return
  }

  // 处理 user_message_id 事件
  if (type === 'user_message_id' && data?.userMessageId) {
    // 更新最后一个用户消息的 ID
    const userMessages = messages.value.filter(msg => msg.type === 'user')
    if (userMessages.length > 0) {
      const lastUserMessage = userMessages[userMessages.length - 1]
      if (lastUserMessage && lastUserMessage.id.startsWith('user_')) {
        lastUserMessage.id = data.userMessageId
      }
    }
  }

  // 使用消息处理器处理事件
  const streamEvent: SimpleStreamEvent = {
    type,
    data,
    timestamp: Date.now(),
  }

  messageHandler.handleEvent(streamEvent)

  // 更新消息列表
  messages.value = [...messageHandler.getMessages()]
  console.log('[Simple.vue] Updated messages, current AI message status:', messages.value.filter(m => m.type === 'ai').map(m => ({ id: m.id, status: m.status })))
}

/**
 * 创建新会话
 */
async function handleCreateSession() {
  if (!userInfo.value?.id) {
    return
  }

  // 如果当前没有消息，不需要创建新会话
  if (messages.value.length === 0) {
    return
  }

  try {
    const userId = String(userInfo.value.id)

    const response = await fetch(`${serverUrl.value}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const newSessionId = data.sessionId || data.threadId

    if (!newSessionId) {
      throw new Error('Failed to create session')
    }

    // 清空当前消息和会话状态
    messageHandler.clear()
    messages.value = []
    sessionId.value = newSessionId
    historyLoaded.value = true

    await loadSessions()
  }
  catch (error: any) {
    console.error('[Simple] Failed to create session:', error)
  }
}

/**
 * 切换会话
 */
async function handleSwitchSession(targetSessionId: string) {
  if (targetSessionId === sessionId.value) {
    showHistoryDialog.value = false
    return
  }

  try {
    // 设置加载状态
    isLoadingHistory.value = true

    messageHandler.clear()
    messages.value = []
    sessionId.value = targetSessionId
    historyLoaded.value = false

    await loadHistoryForSession(targetSessionId)
    showHistoryDialog.value = false
  }
  catch (error: any) {
    console.error('[Simple] Failed to switch session:', error)
    isLoadingHistory.value = false
  }
}

/**
 * 删除当前会话
 */
async function handleDeleteSession() {
  if (!userInfo.value?.id || !sessionId.value) {
    return
  }

  // eslint-disable-next-line no-alert
  if (!confirm('确定要删除当前会话吗？此操作不可恢复。')) {
    return
  }

  try {
    const currentSessionId = sessionId.value

    const response = await fetch(`${serverUrl.value}/api/sessions/${currentSessionId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    messageHandler.clear()
    messages.value = []
    historyLoaded.value = false
    sessionId.value = null
    isStreaming.value = false
    currentReader.value = null

    await loadSessions()

    if (sessions.value.length > 0) {
      const latestSession = sessions.value[0]
      if (latestSession) {
        await loadHistoryForSession(latestSession.sessionId)
      }
    }
    else {
      messages.value = []
      historyLoaded.value = true
    }
  }
  catch (error: any) {
    console.error('[Simple] Failed to delete session:', error)
  }
}

/**
 * 发送消息
 */
async function sendMessage() {
  const message = messageInput.value.trim()

  if (!message || isStreaming.value) {
    return
  }

  if (!(await checkConnection())) {
    isStreaming.value = false
    return
  }

  isStreaming.value = true

  // 添加用户消息
  messageHandler.addUserMessage(message)
  messages.value = [...messageHandler.getMessages()]

  // 重置处理器状态（准备接收新的 AI 消息）
  messageHandler.reset()

  messageInput.value = ''

  if (!sessionId.value && !historyLoaded.value) {
    await loadHistory()
  }

  const requestData = {
    message,
    threadId: sessionId.value,
    enableThinking: true,
    mode: mode.value,
    userId: String(userInfo.value.id),
  }

  try {
    await API.base.userSaveLlmDataCreate({ content: JSON.stringify(requestData) })
  }
  catch (error: any) {
    console.error('保存用户消息失败:', error)
  }

  try {
    const response = await fetch(`${serverUrl.value}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    currentReader.value = reader

    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent: { type: string | null, data: any } = { type: null, data: null }

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent.type = line.substring(7).trim()
        }
        else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6))
            currentEvent.data = data
          }
          catch (e) {
            console.error('解析 SSE 数据失败:', e)
          }
        }
        else if (line.trim() === '') {
          if (currentEvent.type && currentEvent.data !== null) {
            handleSSEEvent({
              type: currentEvent.type,
              data: currentEvent.data,
            })
            currentEvent = { type: null, data: null }
          }
        }
      }
    }

    // 处理剩余的 buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n')
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent.type = line.substring(7).trim()
        }
        else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6))
            currentEvent.data = data
          }
          catch (e) {
            console.error('解析 SSE 数据失败:', e)
          }
        }
        else if (line.trim() === '') {
          if (currentEvent.type && currentEvent.data !== null) {
            handleSSEEvent({
              type: currentEvent.type,
              data: currentEvent.data,
            })
            currentEvent = { type: null, data: null }
          }
        }
      }
      if (currentEvent.type && currentEvent.data !== null) {
        handleSSEEvent({
          type: currentEvent.type,
          data: currentEvent.data,
        })
      }
    }
  }
  catch (error: any) {
    console.error('发送消息失败:', error)

    // 添加错误消息
    messageHandler.handleEvent({
      type: 'error',
      data: { message: `发送失败: ${error.message}` },
      timestamp: Date.now(),
    })
    messages.value = [...messageHandler.getMessages()]
    isStreaming.value = false
  }
  finally {
    isStreaming.value = false
    currentReader.value = null
  }
}

/**
 * 中断当前请求
 */
function _cancelRequest() {
  if (currentReader.value) {
    currentReader.value.cancel()
    currentReader.value = null
    isStreaming.value = false
  }
}

/**
 * 回车发送
 */
function handleKeyPress(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

// 初始化
electronAPI.send('mcp:config').then(async (softConfig) => {
  const { port } = softConfig
  mcpPort.value = port
  const ok = await checkConnection()
  await fetchUserInfo()
  console.log('mcp config', ok)

  if (ok && userInfo.value?.id && !historyLoaded.value) {
    await loadSessions()
    await loadHistory()
  }

  // 页面加载完成后自动聚焦输入框
  nextTick(() => {
    if (messageInputRef.value) {
      // PrimeVue Textarea 组件需要访问 $el 来获取原生 DOM 元素
      const textarea = messageInputRef.value.$el || messageInputRef.value
      if (textarea && typeof textarea.focus === 'function') {
        textarea.focus()
      }
    }
  })
})
</script>

<template>
  <div class="mcp-chat-container">
    <RxCard class="chat-card">
      <Header
        :disable-create-session="messages.length === 0"
        :disable-delete-session="!sessionId"
        @create-session="handleCreateSession"
        @show-history="showHistoryDialog = true"
        @delete-session="handleDeleteSession"
      />

      <!-- 历史记录对话框 -->
      <HistoryDialog
        :visible="showHistoryDialog"
        :sessions="sessions"
        :current-session-id="sessionId"
        @close="showHistoryDialog = false"
        @switch-session="handleSwitchSession"
      />

      <div class="chat-container">
        <!-- 历史记录加载中的提示 -->
        <div v-if="isLoadingHistory" class="loading-container">
          <div class="loading-spinner">
            <div class="spinner" />
          </div>
          <div class="loading-text">
            {{ $t('正在加载历史记录...') }}
          </div>
        </div>

        <!-- 消息列表 -->
        <SimpleMessageList
          v-else
          :messages="messages"
          :avatar="userInfo?.avatar"
          :avatar-color="userInfo?.avatarColor"
          :user-name="userInfo?.userName"
        />

        <div class="input-area">
          <div class="input-container" :class="{ disabled: isInputDisabled }">
            <Textarea
              ref="messageInputRef"
              v-model="messageInput"
              placeholder="Do something..."
              autocomplete="off"
              class="message-input"
              :disabled="isInputDisabled"
              rows="2"
              style="resize: none"
              @keypress="handleKeyPress"
            />
            <div class="input-footer">
              <div class="left-actions">
                <div class="multi-task-switch">
                  <RxToggleSwitch v-model="multiTaskEnabled" size="small" :disabled="isInputDisabled" />
                  <span class="multi-task-label">{{ $t('多窗口') }}</span>
                </div>
                <!-- <span class="model-name">DeepSeek</span> -->
              </div>
              <img
                src="/images/mcp-simple/send.svg"
                alt="发送"
                class="send-icon"
                :class="{ disabled: !messageInput.trim() || isInputDisabled }"
                @click="messageInput.trim() && !isInputDisabled && sendMessage()"
              >
            </div>
          </div>
        </div>
      </div>
    </RxCard>
  </div>
</template>

<style lang="scss" scoped>
.mcp-chat-container {
  padding: 0;
  min-height: 100vh;
  min-width: 375px;
  background: #ffffff;
}

.chat-card {
  max-width: 100%;
  margin: 0;
  background: white;
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.loading-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #ffffff;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f4f6;
  border-top: 3px solid #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
}

.input-area {
  padding: 0 16px 34px;
  width: 100%;
  display: flex;
  overflow: hidden;
}

.input-container {
  display: flex;
  flex: 1;
  padding: 12px;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: var(--colors-background-bg-page, #fff);
  overflow: hidden;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: #2563eb;
  }
}

.input-container.disabled {
  border-color: #e5e7eb;
  background: #f5f5f5;
}

.message-input {
  flex: 1;
  width: 100%;
  border: none;
  background: transparent !important;
  outline: none;
  font-size: 12px;
  line-height: 1.5;
  box-shadow: none;
  resize: none;
  font-family: inherit;
  overflow-y: auto;
  color: #48555b;
  padding: 0;

  &::placeholder {
    color: #48555b;
  }

  :deep(.p-textarea) {
    width: 100%;
    border: none;
    outline: none;
    box-shadow: none;
    padding: 0;
    line-height: 1.5;
    resize: none;
    overflow-y: auto;
    color: #48555b;
    font-size: 12px;

    &::placeholder {
      color: #48555b;
    }

    &:disabled {
      background: transparent !important;
      color: #48555b;
      opacity: 0.6;
    }
  }
}

.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  .left-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 12px;
    .cursor-pointer {
      transform: scale(0.7);
    }
  }

  .multi-task-switch {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .multi-task-label {
    font-weight: 500;
    white-space: nowrap;
  }

  .model-name {
    font-weight: 500;
  }

  .send-icon {
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    width: 24px;
    height: 24px;

    &.disabled {
      opacity: 0.8;
      cursor: not-allowed;
    }
  }

  .cancel-icon {
    filter: brightness(0) saturate(100%) invert(27%) sepia(98%) saturate(4456%) hue-rotate(351deg) brightness(95%)
      contrast(95%);
  }
}
</style>
