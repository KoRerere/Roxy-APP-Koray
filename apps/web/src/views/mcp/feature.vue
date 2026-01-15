<script setup lang="ts">
import RxCard from '/@/components/rx-card'
import RxButton from '/@/components/rx-button'
import RxToggleSwitch from '/@/components/rx-toggle-switch'
import Textarea from 'primevue/textarea'
import Header from './components/header.vue'
import HistoryDialog from './components/history-dialog.vue'
import MessageList from './components/message-list.vue'
import MoreMenuDialog from './components/more-menu-dialog.vue'
import WorkerDetailDialog from './components/worker-detail-dialog.vue'
import { EventHandlerManager } from './handlers/EventHandlerManager.js'
import type { Message, StreamEvent } from './types.js'
import { useUserStore } from '/@/stores/user'
import { loadMessagesFromHistory } from './utils/messageHistory'
import { createSSEEventProcessor } from './utils/sseController'

const { fetchUserInfo } = useUserStore()
const { userInfo } = storeToRefs(useUserStore())
const mcpPort = ref()
const serverUrl = computed(() => `http://localhost:${mcpPort.value}`)
const status = ref<'connected' | 'disconnected' | 'loading'>('disconnected')
const statusText = ref('未连接')
const sessionId = ref<string | null>(null)
const sessions = ref<Array<{ sessionId: string, config?: any, createdAt?: string, lastUpdated?: string }>>([])
const messages = ref<Message[]>([])
const messageInput = ref('')
const isStreaming = ref(false)
const currentReader = ref<ReadableStreamDefaultReader<Uint8Array> | null>(null)
const isAIThinking = ref(false)
/**
 * 标记历史记录是否已加载
 */
const historyLoaded = ref(false)
/**
 * Multi-task 模式开关：false = simple, true = orchestrator
 */
const multiTaskEnabled = ref(false)
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
 * 显示历史记录对话框
 */
const showHistoryDialog = ref(false)
/**
 * 显示更多菜单
 */
const showMoreMenu = ref(false)
/**
 * 显示 Worker 详情对话框
 */
const showWorkerDetailDialog = ref(false)
/**
 * 当前查看的 Worker 消息
 */
const currentWorkerMessage = ref<Message | null>(null)

/**
 * 事件处理器管理器
 */
const eventHandlerManager = new EventHandlerManager()

/**
 * 检查服务器连接
 */
async function checkConnection() {
  try {
    const response = await fetch(`${serverUrl.value}/health`)
    if (response.ok) {
      statusText.value = '已连接到服务器'
      status.value = 'connected'
      return true
    }
    else {
      throw new Error('服务器响应异常')
    }
  }
  catch (error: any) {
    statusText.value = `连接失败: ${error.message}`
    status.value = 'disconnected'
    return false
  }
}

/**
 * 加载用户会话列表
 */
async function loadSessions() {
  if (!userInfo.value?.id) {
    console.log('[MCP] No user ID, skipping sessions load')
    return
  }

  try {
    const userId = String(userInfo.value.id)
    const response = await fetch(`${serverUrl.value}/api/sessions`)

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[MCP] No sessions found')
        sessions.value = []
        return
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    // 后端返回格式：{ success: true, threads: threadIds, count: number }
    // 需要过滤出属于当前用户的 threadIds（假设 threadId 以 userId 开头）
    const allThreads = data.threads || []
    console.log('[MCP] allThreads:', allThreads)
    const userThreads = allThreads.filter((threadId: string) =>
      threadId.startsWith(userId) || threadId === userId,
    )

    sessions.value = userThreads.map((threadId: string) => ({
      sessionId: threadId,
      config: {},
    }))
    console.log(`[MCP] Loaded ${sessions.value.length} sessions for user ${userId}`)
  }
  catch (error: any) {
    console.error('[MCP] Failed to load sessions:', error)
    sessions.value = []
  }
}

/**
 * 加载指定会话的历史记录
 */
async function loadHistory(targetSessionId?: string | null) {
  console.log('loadHistory..', targetSessionId)
  if (!userInfo.value?.id) {
    console.log('[MCP] No user ID, skipping history load')
    return
  }

  try {
    const sessionIdToLoad = targetSessionId || sessionId.value

    // 如果没有 sessionId，先加载会话列表，然后加载最新的会话
    if (!sessionIdToLoad) {
      await loadSessions()
      if (sessions.value.length > 0) {
        // 加载最新的会话（按 sessionId 排序，取最后一个）
        const latestSession = sessions.value[0]
        console.log('[MCP] latestSession:', latestSession)
        await loadHistoryForSession(latestSession.sessionId)
      }
      else {
        // 没有会话，保持 sessionId 为 null，等待用户发送第一条消息时创建新会话
        historyLoaded.value = true
        console.log('[MCP] No existing sessions, will create new session on first message')
      }
      return
    }

    await loadHistoryForSession(sessionIdToLoad)
  }
  catch (error: any) {
    console.error('[MCP] Failed to load history:', error)
    historyLoaded.value = true
  }
}

/**
 * 加载指定会话的历史记录
 */
async function loadHistoryForSession(targetSessionId: string) {
  if (!userInfo.value?.id)
    return

  try {
    const _userId = String(userInfo.value.id)

    eventHandlerManager.setMode('auto')

    // 使用工具函数加载历史消息
    const { messages: loadedMessages } = await loadMessagesFromHistory(
      targetSessionId,
      _userId,
      serverUrl.value,
      eventHandlerManager,
    )

    // 设置会话状态
    sessionId.value = targetSessionId
    messages.value = loadedMessages
    historyLoaded.value = true
  }
  catch (error: any) {
    console.error('[MCP] Failed to load history:', error)
    sessionId.value = targetSessionId
    messages.value = []
    historyLoaded.value = true
    eventHandlerManager.reset()
  }
}

/**
 * 添加用户消息
 * @returns 用户消息ID
 */
function addUserMessage(content: string): string {
  const message: Message = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type: 'user',
    content,
    timestamp: Date.now(),
  }
  messages.value.push(message)
  return message.id
}

/**
 * 处理 SSE 事件
 */
function handleSSEEvent(event: { type: string, data: any }) {
  const { type, data } = event
  console.log('收到 SSE 事件:', type, data)

  // 处理 session 事件，显示提示
  if (type === 'session' && data?.sessionId) {
    const newThreadId = data.sessionId
    sessionId.value = newThreadId
    statusText.value = `会话已创建: ${newThreadId.substring(0, 8)}...`
    status.value = 'connected'

    // 如果会话列表中没有这个会话，添加到列表
    if (!sessions.value.find(s => s.sessionId === newThreadId)) {
      sessions.value.push({
        sessionId: newThreadId,
        config: {},
      })
    }

    // 3秒后恢复正常状态
    setTimeout(() => {
      if (status.value === 'connected') {
        statusText.value = '已连接到服务器'
      }
    }, 3000)
  }

  // 跟踪 AI 思考/生成状态
  if (type === 'plan_status' || type === 'planning_thinking' || type === 'planning_content'
    || type === 'worker_start' || type === 'worker_thinking' || type === 'worker_content'
    || type === 'synthesis_status' || type === 'synthesis_thinking' || type === 'synthesis_content'
    || type === 'thinking' || type === 'content') {
    isAIThinking.value = true
  }

  // 处理 done 事件，更新状态
  if (type === 'done') {
    isAIThinking.value = false
    // 通知 EventHandlerManager 处理 done 事件，更新 synthesis 状态
    eventHandlerManager.handleEvent({
      type: 'done',
      data: {},
      timestamp: Date.now(),
    } as StreamEvent)
  }

  // 如果正在加载历史记录，不处理实时SSE事件，避免冲突
  if (!historyLoaded.value) {
    console.log('[MCP] Skipping SSE event during history loading:', type)
    return
  }

  // 使用 SSEEventProcessor 处理事件
  const processor = createSSEEventProcessor(eventHandlerManager, messages.value)
  const mergedMessages = processor.processEvent(event)

  // 更新 sessionId（如果事件管理器中有更新）
  const managerSessionId = eventHandlerManager.getSessionId()
  if (managerSessionId && !sessionId.value) {
    sessionId.value = managerSessionId
  }

  // 直接更新消息列表
  messages.value = mergedMessages
}

/**
 * 创建新会话
 */
async function handleCreateSession() {
  if (!userInfo.value?.id) {
    console.warn('[MCP] Cannot create session: missing userId')
    return
  }

  if (messages.value.length === 0 || isAIThinking.value) {
    return
  }

  try {
    const userId = String(userInfo.value.id)

    // 调用后端 API 创建新会话
    const response = await fetch(`${serverUrl.value}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const newSessionId = data.sessionId || data.threadId

    if (!newSessionId) {
      throw new Error('Failed to create session: no sessionId returned')
    }

    // 清空当前消息和会话状态
    messages.value = []
    sessionId.value = newSessionId
    historyLoaded.value = false
    eventHandlerManager.reset()

    // 重新加载会话列表
    await loadSessions()

    statusText.value = '新会话已创建'
    status.value = 'connected'

    setTimeout(() => {
      if (status.value === 'connected') {
        statusText.value = '已连接到服务器'
      }
    }, 2000)
  }
  catch (error: any) {
    console.error('[MCP] Failed to create session:', error)
    statusText.value = `创建会话失败: ${error.message}`
    status.value = 'connected'
    // eslint-disable-next-line no-alert
    alert('创建会话失败，请重试')
  }
}

/**
 * 切换会话
 */
async function handleSwitchSession(targetSessionId: string) {
  if (targetSessionId === sessionId.value) {
    showHistoryDialog.value = false // 关闭对话框
    return // 已经是当前会话
  }

  try {
    // 清空当前消息
    messages.value = []
    sessionId.value = targetSessionId
    historyLoaded.value = false
    eventHandlerManager.reset()

    // 加载新会话的历史记录
    await loadHistoryForSession(targetSessionId)

    // 关闭历史记录对话框
    showHistoryDialog.value = false

    status.value = 'connected'
  }
  catch (error: any) {
    console.error('[MCP] Failed to switch session:', error)
    // eslint-disable-next-line no-alert
    alert('切换会话失败，请重试')
  }
}

/**
 * 删除当前会话
 */
async function handleDeleteSession() {
  if (!userInfo.value?.id || !sessionId.value) {
    console.warn('[MCP] Cannot delete session: missing userId or sessionId')
    return
  }

  // 确认删除
  // eslint-disable-next-line no-alert
  if (!confirm('确定要删除当前会话吗？此操作不可恢复。')) {
    return
  }

  try {
    const currentSessionId = sessionId.value

    if (!currentSessionId) {
      console.warn('[MCP] Cannot delete session: missing sessionId')
      return
    }

    // orchestrator 重构后，使用 threadId 删除会话
    const response = await fetch(`${serverUrl.value}/api/sessions/${currentSessionId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // 清空前端消息列表
    messages.value = []
    // 重置历史记录加载状态
    historyLoaded.value = false
    // 重置事件处理器
    eventHandlerManager.reset()
    // 清空 sessionId
    sessionId.value = null

    // 重新加载会话列表（确保删除的会话不再显示）
    await loadSessions()

    // 如果还有其他会话，加载最新的会话
    if (sessions.value.length > 0) {
      const latestSession = sessions.value[0]
      await loadHistoryForSession(latestSession.sessionId)
    }
    else {
      // 没有其他会话，确保消息列表为空
      messages.value = []
      historyLoaded.value = true
    }

    statusText.value = '会话已删除'
    status.value = 'connected'

    // 3秒后恢复正常状态
    setTimeout(() => {
      if (status.value === 'connected') {
        statusText.value = '已连接到服务器'
      }
    }, 3000)
  }
  catch (error: any) {
    console.error('[MCP] Failed to delete session:', error)
    // eslint-disable-next-line no-alert
    alert('删除会话失败，请重试')
  }
}

/**
 * 清空当前会话（保留会话，只清空消息）
 */
async function handleClearSession() {
  if (!userInfo.value?.id || !sessionId.value) {
    console.warn('[MCP] Cannot clear session: missing userId or sessionId')
    return
  }

  try {
    // 只清空前端消息列表，不删除会话
    messages.value = []
    // 重置历史记录加载状态
    historyLoaded.value = false
    // 重置事件处理器
    eventHandlerManager.reset()

    statusText.value = '会话已清空'
    status.value = 'connected'

    // 3秒后恢复正常状态
    setTimeout(() => {
      if (status.value === 'connected') {
        statusText.value = '已连接到服务器'
      }
    }, 3000)
  }
  catch (error: any) {
    console.error('[MCP] Failed to clear session:', error)
    // eslint-disable-next-line no-alert
    alert('清空会话失败，请重试')
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

  // 检查连接
  if (!(await checkConnection())) {
    // eslint-disable-next-line no-alert
    alert('无法连接到服务器，请检查服务器是否运行')
    return
  }

  // 禁用输入
  isStreaming.value = true

  // 显示用户消息（在重置之前添加，这样不会被清空）
  // 注意：真实的 userMessageId 会通过 user_message_id 事件从后端获取
  addUserMessage(message)

  // 重置事件处理器（新会话开始，但保留用户消息）
  // 注意：这里不清空 messages.value，因为用户消息已经添加了
  eventHandlerManager.reset()
  // userMessageId 会通过 user_message_id 事件设置

  // 清空输入框
  messageInput.value = ''

  // 如果没有 sessionId，尝试加载历史记录获取 sessionId
  // 这通常发生在用户直接进入页面，但还没有加载历史记录的情况
  if (!sessionId.value && !historyLoaded.value) {
    console.log('[MCP] No sessionId, loading history first...')
    await loadHistory()
    // 如果加载历史记录后仍然没有 sessionId，说明用户是第一次使用，后端会创建新会话
  }

  /**
   * 准备请求数据
   */
  const requestData = {
    message,
    threadId: sessionId.value,
    enableThinking: true,
    mode: mode.value,
    userId: String(userInfo.value.id),
  }

  // 更新状态
  statusText.value = '正在发送消息...'
  status.value = 'loading'
  isAIThinking.value = true

  try {
    // 使用 fetch 发送 POST 请求并处理 SSE 流
    const response = await fetch(`${serverUrl.value}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    })
    console.log('sendMessage.response..', response)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // 处理 SSE 流
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    // 优化4：保存 reader 引用，用于中断
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
            // 不在这里处理，等待空行
          }
          catch (e) {
            console.error('解析 SSE 数据失败:', e, line)
          }
        }
        else if (line.trim() === '') {
          // 空行表示事件结束，此时处理完整的事件
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

    // 处理剩余的 buffer（最后可能没有空行，需要手动处理）
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
            console.error('解析 SSE 数据失败:', e, line)
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
      // 如果还有未处理的事件（没有空行结尾），也处理它
      if (currentEvent.type && currentEvent.data !== null) {
        handleSSEEvent({
          type: currentEvent.type,
          data: currentEvent.data,
        })
      }
    }

    statusText.value = '已连接到服务器'
    status.value = 'connected'
    isAIThinking.value = false

    // 确保最后的更新被应用（移除防抖后，消息已经实时更新，这里不需要额外处理）
  }
  catch (error: any) {
    console.error('发送消息失败:', error)
    const errorMessage: Message = {
      id: `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: 'ai',
      content: `发送失败: ${error.message}`,
      rawText: `发送失败: ${error.message}`,
      eventType: 'error',
      timestamp: Date.now(),
    }
    messages.value.push(errorMessage)
    statusText.value = `错误: ${error.message}`
    status.value = 'disconnected'
    isAIThinking.value = false
  }
  finally {
    // 恢复输入
    isStreaming.value = false
    currentReader.value = null
  }
}

/**
 * 优化4：中断当前请求
 */
function cancelRequest() {
  if (currentReader.value) {
    currentReader.value.cancel()
    currentReader.value = null
    isStreaming.value = false
    isAIThinking.value = false
    statusText.value = '请求已中断'
    status.value = 'connected'
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

/**
 * 查看 Worker 详情
 */
function handleViewWorkerDetail(taskId: string) {
  // 从消息列表中找到对应的 worker 消息
  const workerMessage = messages.value.find(
    msg => msg.phase === 'worker' && msg.workerData?.taskId === taskId,
  )

  if (workerMessage) {
    currentWorkerMessage.value = workerMessage
    showWorkerDetailDialog.value = true
  }
  else {
    console.warn('[MCP] Worker message not found for taskId:', taskId)
  }
}

/**
 * 中断 Worker 任务
 */
async function handleStopWorkerTask(taskId: string) {
  if (!userInfo.value?.id) {
    console.warn('[MCP] Cannot stop worker task: missing userId')
    return
  }

  try {
    const userId = String(userInfo.value.id)
    const response = await fetch(`${serverUrl.value}/api/worker/${taskId}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    statusText.value = '任务已中断'
    status.value = 'connected'

    setTimeout(() => {
      if (status.value === 'connected') {
        statusText.value = '已连接到服务器'
      }
    }, 2000)
  }
  catch (error: any) {
    console.error('[MCP] Failed to stop worker task:', error)
    // eslint-disable-next-line no-alert
    alert('中断任务失败，请重试')
  }
}

// 初始化：获取 MCP 配置并检查连接，然后加载历史记录
electronAPI.send('mcp:config').then(async (softConfig) => {
  const { port } = softConfig
  mcpPort.value = port
  const ok = await checkConnection()
  await fetchUserInfo()
  console.log('mcp:config..', userInfo.value, historyLoaded.value)

  // 连接成功后再加载会话列表和历史记录（只加载一次）
  if (ok && userInfo.value?.id && !historyLoaded.value) {
    await loadSessions()
    await loadHistory()
  }
})
</script>

<template>
  <div class="mcp-chat-container">
    <RxCard class="chat-card">
      <Header
        :disable-create-session="messages.length === 0 || isAIThinking"
        :disable-delete-session="!sessionId || isAIThinking"
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

      <!-- 更多菜单 -->
      <MoreMenuDialog
        :visible="showMoreMenu"
        :has-messages="messages.length > 0"
        @close="showMoreMenu = false"
        @clear-session="handleClearSession"
      />

      <!-- Worker 详情对话框 -->
      <WorkerDetailDialog
        :visible="showWorkerDetailDialog"
        :message="currentWorkerMessage"
        @close="showWorkerDetailDialog = false"
        @stop-task="handleStopWorkerTask"
      />

      <div class="chat-container">
        <MessageList
          :messages="messages"
          :is-ai-thinking="isAIThinking"
          :server-url="serverUrl"
          :avatar="userInfo?.avatar"
          :avatar-color="userInfo?.avatarColor"
          :user-name="userInfo?.userName"
          @view-worker-detail="handleViewWorkerDetail"
          @stop-worker-task="handleStopWorkerTask"
        />

        <div class="input-area">
          <div class="input-container">
            <div class="input-row">
              <Textarea
                v-model="messageInput"
                placeholder="Do something..."
                autocomplete="off"
                class="message-input"
                :disabled="isStreaming"
                rows="2"
                style="resize: none"
                @keypress="handleKeyPress"
              />
            </div>
            <div class="input-footer">
              <div class="multi-task-switch">
                <RxToggleSwitch v-model="multiTaskEnabled" size="small" />
                <span class="multi-task-label">Multi-task</span>
              </div>
              <RxButton
                v-if="!isStreaming"
                label="发送"
                :disabled="!messageInput.trim() || isStreaming"
                @click="sendMessage"
              />
              <RxButton
                v-else
                label="中断"
                severity="danger"
                @click="cancelRequest"
              />
            </div>
          </div>
        </div>
      </div>
    </RxCard>
  </div>
</template>

<style lang="scss" scoped>
.mcp-chat-container {
  padding: 20px;
  min-height: 100vh;
}

.chat-card {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 40px);
  padding: 0;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.input-area {
  padding: 16px 20px;
  background: #f5f5f5;
  border-top: 1px solid #e9ecef;
}

.input-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  max-height: 200px;
  overflow: hidden;
}

.input-row {
  display: flex;
  align-items: flex-start;
  width: 100%;
  flex: 1;
  overflow: hidden;
}

.message-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  min-height: 24px;
  max-height: 150px;
  padding: 0;
  font-size: 14px;
  line-height: 1.5;
  box-shadow: none;
  resize: none;
  font-family: inherit;
  overflow-y: auto;

  :deep(.p-textarea) {
    border: none;
    outline: none;
    box-shadow: none;
    padding: 0;
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    overflow-y: auto;
    &:disabled {
      background: transparent !important;
    }
  }
}

.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.multi-task-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  :deep(.p-toggleswitch) {
    transform: scale(0.8);
    transform-origin: left bottom;
  }
}

.multi-task-label {
  font-size: 14px;
  color: #6c757d;
  font-weight: 400;
  user-select: none;
}
</style>
