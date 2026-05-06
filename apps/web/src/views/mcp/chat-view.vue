<script setup lang="ts">
import ChatInput from './chat-input.vue'
import AgentExample from './agent-example.vue'
import { useThemeStore } from '/@/stores/theme'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { fetchSSE, MessageViewer, parseHistorySSE2 } from '/@/views/mcp/util'
import { useAgentStore } from '/@/stores/agent'
import { useAgentApi } from './agent-api'
import type { ConversationDetail } from './agent-api'
import type { AttachmentInfo, AvatarInfo, FormattedMessage, SSEEventData, Todo, WorkerStatus } from '/@/views/mcp/types'
import { format } from 'date-fns'
import MessageItem from '/@/views/mcp/components/message-item.vue'
import PendingAttachments from '/@/views/mcp/components/pending-attachments.vue'

const props = defineProps<{
  conversationId?: string
  uninitialized?: boolean
}>()

const emit = defineEmits<{
  (e: 'updateTitle', conversationId: string, title: string): void
  (e: 'createConversation', data: ConversationDetail): void
}>()

const themeStore = useThemeStore()
const background = computed(() => themeStore.realTheme === 'dark'
  ? '/images/mcp/agent-chat-dark.svg'
  : '/images/mcp/agent-chat-light.svg')
const { userInfo } = storeToRefs(useUserStore())

const aiAvatar: AvatarInfo = {
  role: 'assistant',
  name: 'Ro',
  userName: 'Roxy AI Agent',
  avatar: '/images/mcp/agent_avatar.png',
  color: '',
}

const userAvatar = computed<AvatarInfo>(() => {
  const { avatar, avatarColor, userName } = userInfo.value
  return {
    role: 'user',
    name: userName?.slice(0, 2) || '',
    userName: userName || '',
    avatar: avatar || '',
    color: avatarColor || '',
  }
})

const [, onlyErrorToast] = useResponseToast()
const { mixpanelTrack } = useUserStore()
const agentStore = useAgentStore()
const { conversationDetail, conversationInterrupt, uploadFile, getFileUrl, conversationCreate } = useAgentApi()

const mode = ref<'orchestrator' | 'simple'>('simple')
const userMessage = ref('')
const isChatting = defineModel('isChatting', { default: false })
const todo = ref<Todo[]>([])
const pendingAttachments = ref<AttachmentInfo[]>([])
const currentConversation = ref<ConversationDetail>()

/**
 * 消息列表，每条消息包含 messageBlocks 和其他元信息
 */
const messageList = ref<any[]>([])

const isEmpty = computed(() => messageList.value.length === 0)

function selectAgentExample(item: any) {
  userMessage.value = item.promptTemplateContent
}

// ---- 自动滚动（scroll 事件 + 哨兵元素）----
const sentinelRef = useTemplateRef<HTMLElement>('scrollSentinel')
const scrollContainerRef = useTemplateRef<HTMLElement>('scrollContainer')
const isAtBottom = ref(true)

function onScroll() {
  const el = scrollContainerRef.value
  if (!el)
    return
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50
}

function scrollToBottom() {
  if (!isAtBottom.value)
    return
  sentinelRef.value?.scrollIntoView({ block: 'end' })
}
// ---- end 自动滚动 ----

let messageViewer = new MessageViewer()

function updateStream() {
  const currentMessage = messageList.value[messageList.value.length - 1]
  if (currentMessage) {
    currentMessage.isStreaming = true
    currentMessage.messageBlocks = messageViewer.view()
    todo.value = messageViewer.viewTodo()
  }
  scrollToBottom()
}

function handleSSEEvent(event: any) {
  const eventData = event.json as SSEEventData | null
  if (!eventData)
    return

  const { type, data, timestamp } = eventData

  switch (type) {
    case 'thinking':
      messageViewer.add(data?.thinkingId || '', 'thinking', data?.text || '', timestamp)
      updateStream()
      break

    case 'content':
      messageViewer.add(data?.contentId || '', 'content', data?.text || '', timestamp)
      updateStream()
      break

    case 'tool_call':
      if (data?.taskId) {
        messageViewer.addWorkerEntry(data.taskId, data.toolId || '', 'tool_call', data)
      }
      else {
        messageViewer.add(data?.toolId || '', 'tool_call', data)
      }
      updateStream()
      break

    case 'tool_result':
      if (data?.taskId) {
        messageViewer.addWorkerEntry(data.taskId, data.toolId || '', 'tool_result', data)
      }
      else {
        messageViewer.add(data?.toolId || '', 'tool_result', data)
      }
      updateStream()
      break

    case 'worker_thinking':
      messageViewer.addWorkerEntry(data?.taskId || '', data?.thinkingId || '', 'worker_thinking', data?.text || '', timestamp)
      updateStream()
      break

    case 'worker_content':
      messageViewer.addWorkerEntry(data?.taskId || '', data?.contentId || '', 'worker_content', data?.text || '', timestamp)
      updateStream()
      break

    case 'worker_result':
      messageViewer.setWorkerStatus(data?.taskId || '', (data?.status || 'success') as WorkerStatus)
      updateStream()
      break
    case 'todo':
      messageViewer.add(type, type, data, timestamp)
      break

    case 'error':
      messageViewer.add(type, type, data, timestamp)
      updateStream()
      isChatting.value = false
      break
    case 'interrupt':
      messageViewer.add(type, type, '', timestamp)
      updateStream()
      isChatting.value = false
      break
    case 'done':
      updateStream()
      isChatting.value = false
      break

    case 'title':
      if (data?.title && currentConversation.value) {
        currentConversation.value.title = data.title
        emit('updateTitle', props.conversationId || '', data.title)
      }
      break
  }
}

async function sendMessage() {
  const hasText = userMessage.value.trim().length > 0
  const hasAttachments = pendingAttachments.value.length > 0
  if (isChatting.value || (!hasText && !hasAttachments))
    return

  mixpanelTrack('click_agent_send_message')
  const msg = userMessage.value
  userMessage.value = ''
  isAtBottom.value = true

  let isCreatedChat = false
  if (!currentConversation.value) {
    const result = await conversationCreate()
    if (result.code !== 0) {
      onlyErrorToast(-1, '创建会话失败，请重试')
      return
    }
    isCreatedChat = true;
    currentConversation.value = result.data
  }

  // 拿走当前附件并清空
  const attachmentsToSend = pendingAttachments.value.slice()
  pendingAttachments.value = []

  // 把附件转换为展示用格式（用本地预览 URL，避免等服务端响应）
  const displayAttachments: AttachmentInfo[] = attachmentsToSend.map(att => ({
    fileId: att.fileId,
    fileName: att.fileName,
    mimeType: att.mimeType,
    size: att.size,
    url: 'preview' in att ? att.preview : att.url || getFileUrl(att.fileId),
  }))

  messageList.value.push({
    ...userAvatar.value,
    mode: mode.value,
    date: formatDate(new Date()),
    attachments: displayAttachments.length ? displayAttachments : undefined,
    content: msg,
  })

  messageList.value.push({
    ...aiAvatar,
    mode: mode.value,
    date: formatDate(new Date()),
    messageBlocks: [],
    isStreaming: true,
  })

  nextTick(() => sentinelRef.value?.scrollIntoView({ block: 'end' }))

  isChatting.value = true
  messageViewer = new MessageViewer()

  fetchSSE(`${agentStore.serverUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: msg,
      mode: mode.value,
      conversationId: currentConversation.value!.id,
      enableThinking: true,
      attachments: attachmentsToSend.map(({ fileId, fileName, mimeType, size }) => ({ fileId, fileName, mimeType, size })),
    }),
    onEvent: (event) => {
      console.log('🚀 ~ sendMessage ~ event:', event)
      handleSSEEvent(event)
    },
    onError: (error) => {
      console.error('🚀 ~ sendMessage ~ error:', error)
      messageViewer.finalize()
      if (!messageViewer.view().length) {
        messageViewer.add('error', 'content', '请求发生错误，请重试')
      }
      updateStream()
      isChatting.value = false
    },
  }).finally(() => {
    if (isCreatedChat) {
      emit('createConversation', toRaw(currentConversation.value!))
    }
  })
}

function handleInterrupt() {
  // 停止消息生成的逻辑
  conversationInterrupt(props.conversationId || '')
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'application/pdf', 'text/plain']
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_PENDING_ATTACHMENTS = 5

/**
 * 将文件转换为 base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

async function uploadFiles(files: File[]) {
  if (isChatting.value)
    return

  for (const file of files) {
    // 检查数量限制
    if (pendingAttachments.value.length >= MAX_PENDING_ATTACHMENTS) {
      onlyErrorToast(-1, `最多只能上传 ${MAX_PENDING_ATTACHMENTS} 个文件`)
      break
    }

    // 检查文件类型
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      onlyErrorToast(-1, `不支持的文件类型: ${file.name}`)
      continue
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      onlyErrorToast(-1, `文件过大: ${file.name} (最大 5MB)`)
      continue
    }

    const tempId = generateId()

    // 先添加到 pendingAttachments，显示本地预览
    const preview = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : undefined

    pendingAttachments.value.push({
      fileId: tempId,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    })

    // 上传到服务器
    try {
      const base64 = await fileToBase64(file)
      const res = await uploadFile(base64, file.type, file.name)

      if (res.code === 0) {
        // 上传成功，更新 fileId
        const index = pendingAttachments.value.findIndex(a => a.fileId === tempId)
        if (index !== -1) {
          pendingAttachments.value[index] = {
            ...pendingAttachments.value[index],
            fileId: res.data.fileId,
            url: getFileUrl(res.data.fileId),
          }
        }
        // 释放本地预览 URL
        if (preview)
          URL.revokeObjectURL(preview)
      }
      else {
        // 上传失败，移除
        onlyErrorToast(-1, res.message || '文件上传失败')
        const index = pendingAttachments.value.findIndex(a => a.fileId === tempId)
        if (index !== -1)
          pendingAttachments.value.splice(index, 1)
        if (preview)
          URL.revokeObjectURL(preview)
      }
    }
    catch (error) {
      console.error('上传文件失败:', error)
      onlyErrorToast(-1, '文件上传失败，请重试')
      const index = pendingAttachments.value.findIndex(a => a.fileId === tempId)
      if (index !== -1)
        pendingAttachments.value.splice(index, 1)
      if (preview)
        URL.revokeObjectURL(preview)
    }
  }
}

function removeAttachment(fileId: string) {
  const index = pendingAttachments.value.findIndex(a => a.fileId === fileId)
  if (index !== -1) {
    const attachment = pendingAttachments.value[index]
    // 释放本地预览 URL
    if ('preview' in attachment && attachment.preview)
      URL.revokeObjectURL(attachment.preview)
    pendingAttachments.value.splice(index, 1)
  }
}

function formatDate(date: Date | string | number): string {
  return format(new Date(date), 'yyyy/MM/dd HH:mm')
}

function formatMessage(data: any): FormattedMessage {
  const isUser = data.role === 'user'

  // 解析 assistant 的 SSE 格式消息
  if (!isUser) {
    const events = parseHistorySSE2(data.content)
    return {
      ...aiAvatar,
      mode: data.agent_mode,
      date: formatDate(data.created_at),
      messageBlocks: events,
      isStreaming: false,
    }
  }

  return {
    ...(isUser ? userAvatar.value : aiAvatar),
    ...data,
    date: formatDate(data.created_at),
    attachments: data.metadata.attachments,
  }
}

watch([() => props.conversationId, userInfo], ([newId, _userInfo]) => {
  if (newId && _userInfo) {
    // Load the conversation data based on the new conversation ID
    conversationDetail(newId).then((res) => {
      if (res.code === 0) {
        currentConversation.value = res.data
        const formattedMessages = res.data.messages.map(formatMessage)
        messageList.value = formattedMessages
        console.log('🚀 ~ conversationDetail ~ messageList:', formattedMessages)
        nextTick(() => sentinelRef.value?.scrollIntoView({ block: 'end' }))
      }
    })
  }
  else {
    messageList.value = []
    currentConversation.value = undefined
  }
}, { immediate: true })
</script>

<template>
  <div class="h-full relative bg-[var(--colors-background-bg-page)]" style="will-change: transform;">
    <!-- 背景渐变装饰 -->
    <div v-if="isEmpty" class="absolute size-full z-1" :style="{ backgroundImage: `url(${background})`, backgroundSize: 'cover' }" />

    <div class="flex flex-col items-center h-full relative z-2" :class="isEmpty ? 'justify-center' : 'pt-24 pb-6'">
      <!-- 标题栏，粘性布局 -->
      <div v-if="!isEmpty" class="w-full h-15 flex items-center px-6 z-2 absolute top-0" :class="isEmpty ? '' : 'border-b-solid border border-[var(--colors-border-border-inactive)]'">
        <div class="font-['Inter'] font-semibold text-[var(--colors-text-text-primary)] text-lg">
          {{ currentConversation?.title }}
        </div>
      </div>

      <!-- Label -->
      <div v-if="isEmpty" class="px-3 py-1.5 rounded-full bg-[linear-gradient(100deg,#3FAAF6_0%,#F359DC_50%,#F28FB0_100%)]">
        <p class="m-0 font-[Archivo] text-[var(--component-button-primary-text)] text-13px">
          {{ $t('全球首个指纹浏览器 AI Agent') }}
        </p>
      </div>

      <!-- 主标题 -->
      <div v-if="isEmpty" class="text-center mt-3">
        <div class="font-['Archivo'] font-700 text-[var(--colors-text-text-primary)] text-9 leading-[44px]">
          <p class="m-0">
            {{ $t('Roxy AI Agent, 您的数字员工') }}
          </p>
        </div>
      </div>

      <div
        v-else
        ref="scrollContainer"
        class="overflow-y-auto w-full flex-1 min-h-0"
        style="will-change: transform;"
        @scroll="onScroll"
      >
        <div class="w-full flex flex-col mx-auto gap-6 max-w-[584px]">
          <div v-for="(item, index) in messageList" :key="index" class="flex items-start self-stretch gap-2">
            <RxAvatar class="user-avatar" :avatar="item.avatar" :color="item.color" :name="item.name" :size="32" :font-size="16" />
            <div class="flex-1 flex flex-col gap-2 overflow-hidden">
              <div class="flex items-center justify-between gap-2">
                <span class="user-name">{{ item.userName }}</span>
                <span class="user-date">{{ item.date }}</span>
              </div>
              <MessageItem v-if="item.role === 'assistant'" :item="item" />
              <div v-else class="flex flex-col gap-2">
                <div class="whitespace-pre-line text-[var(--colors-text-text-primary)] text-3.5 leading-[1.4]">
                  {{ item.content }}
                </div>
                <div class="flex flex-col gap-2 max-w-185px">
                  <PendingAttachments v-if="item.attachments?.length" :attachments="item.attachments" />
                </div>
              </div>
            </div>
          </div>
          <!-- 哨兵元素：IntersectionObserver 通过它判断是否在底部 -->
          <div ref="scrollSentinel" class="h-px" />
        </div>
      </div>

      <!-- 输入框 -->
      <div class="max-w-[584px] w-full bg-[var(--colors-background-bg-page)] rounded-2 overflow-hidden" :class="[isEmpty ? 'mt-10' : 'mt-2.5']">
        <ChatInput
          v-model:mode="mode"
          v-model="userMessage"
          :pending-attachments="pendingAttachments"
          :is-chatting="isChatting"
          :health="{ isOk: true, loading: false }"
          :todo="todo"
          @send-message="sendMessage"
          @stop="handleInterrupt"
          @upload-files="uploadFiles"
          @remove-attachment="removeAttachment"
          :uninitialized
        />
      </div>

      <div v-if="isEmpty" class="max-w-[584px] w-full mt-5">
        <AgentExample @select="selectAgentExample" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.user {
  &-avatar {
    border: 1px solid var(--colors-border-border-inactive);
    border-radius: 50%;
  }

  &-name {
    color: var(--colors-text-text-placeholder);
    font-size: 12px;
    font-weight: 700;
    line-height: 16px;
  }

  &-date {
    color: var(--colors-text-text-inactive);
    font-size: 12px;
    line-height: 16px;
  }
}
</style>
