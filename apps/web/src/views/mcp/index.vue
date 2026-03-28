<script setup lang="ts">
import Empty from '/@/views/mcp/components/empty.vue'
import MessageItem from '/@/views/mcp/components/message-item.vue'
import PendingAttachments from '/@/views/mcp/components/pending-attachments.vue'
import { motion } from 'motion-v'
import DOMPurify from 'dompurify'
import { format } from 'date-fns'
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useMcp } from '/@/views/mcp/hook'
import { fetchSSE, MessageViewer, parseHistorySSE2 } from '/@/views/mcp/util'
import type { AttachmentInfo, AvatarInfo, CurrentReply, FormattedMessage, SSEEventData, WorkerStatus } from '/@/views/mcp/types'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'application/pdf', 'text/plain']
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_PENDING_ATTACHMENTS = 5

const { userInfo } = storeToRefs(useUserStore())
const { mixpanelTrack } = useUserStore()
const { serverUrl, health, conversationList, currentConversation, currentConversationDetail, fetchConversations, genConversation, stopConversation, deleteConversation, switchConversation } = useMcp()
const { showMenu } = usePopupMenu()
const [, onlyErrorToast] = useResponseToast()

const mode = ref<'orchestrator' | 'simple'>('simple')
const message = ref('')
const newChatList = ref<FormattedMessage[]>([])
const currentReply = ref<CurrentReply | null>(null)
const isChatting = ref(false)
const scrollContainerRef = useTemplateRef('scrollContainer')
const userScrolledUp = ref(false)
const chatLimit = ref(20)
const promptPreset = ref<any[]>([])
// 待发送的附件列表（含本地预览 URL）
const pendingAttachments = ref<(AttachmentInfo & { preview?: string })[]>([])
// 拖拽文件到输入区域的悬停状态
const isDraggingOver = ref(false)
const todoExpanded = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

function onClickUpload() {
  if (pendingAttachments.value.length >= MAX_PENDING_ATTACHMENTS)
    return
  fileInputRef.value?.click()
}

async function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length > 0)
    await processFilesBatch(files)
  input.value = ''
}

const tokenInfo = ref({
  ok: false,
  available: false,
  value: 0,
})

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

const aiAvatar: AvatarInfo = {
  role: 'assistant',
  name: 'Ro',
  userName: 'Roxy AI Agent',
  avatar: '/images/mcp/agent_avatar.png',
  color: '',
}

// 用于实时流的 MessageViewer 实例
let messageViewer = new MessageViewer()

const historyList = computed(() => {
  return (currentConversationDetail.value?.messages || []).map(formatMessage)
})

const messageList = computed(() => {
  const pendingList = newChatList.value

  if (currentReply.value) {
    return [...historyList.value, ...pendingList, formatCurrentReply(currentReply.value)]
  }

  return [...historyList.value, ...pendingList]
})

watch(
  () => currentConversationDetail.value?.messages,
  (newMessages) => {
    if (newMessages?.length) {
      scrollToBottom()
    }
  },
  { immediate: true },
)

globalThis.electronAPI.on('mcp:token-usage', calculateTokenValue)

onBeforeMount(() => {
  fetchTokenCost()
  getPromptPreset()
})

async function fetchTokenCost() {
  const { code, data } = await API.base.userGetLlmInfoList()
  if (code !== 0) {
    return
  }
  chatLimit.value = data.chatLimit
  calculateTokenValue(data)
}

async function getPromptPreset() {
  const { code, data } = await API.base.userGetPromptTemplateListList()
  if (code !== 0)
    return
  promptPreset.value = data
}

function calculateTokenValue(data: any) {
  if (!data) {
    tokenInfo.value.ok = false
    return
  }

  const { balance, totalBalance, available } = data
  tokenInfo.value = {
    ok: true,
    available,
    value: Math.floor(Number(balance) / Number(totalBalance) * 10000) / 100,
  }
}

const NEAR_BOTTOM_THRESHOLD_PX = 20

function scrollToBottom() {
  // 用户在一次对话期间离开“底部附近”后禁止自动触底滚动
  if (userScrolledUp.value)
    return

  nextTick(() => {
    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollTop = scrollContainerRef.value.scrollHeight
    }
  })
}

function isNearBottom() {
  const el = scrollContainerRef.value
  if (!el)
    return true

  // 距离底部的像素差：越小越接近底部
  const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight)
  return distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX
}

function handleScroll(event: Event) {
  if (!isChatting.value)
    return

  // 只在用户主动滚动时更新“暂停自动滚动”状态，避免程序化滚动触发误判
  if (!event.isTrusted)
    return

  // 离底部就暂停；回到底部附近就恢复自动滚动
  userScrolledUp.value = !isNearBottom()
}

function formatDate(date: Date | string | number): string {
  return format(new Date(date), 'yyyy/MM/dd HH:mm')
}

function formatMessage(data: any): FormattedMessage {
  const isUser = data.role === 'user'

  // 解析 assistant 的 SSE 格式消息
  if (!isUser && data.content?.includes('event:')) {
    const events = parseHistorySSE2(data.content)
    return {
      ...aiAvatar,
      mode: data.agent_mode,
      date: formatDate(data.created_at),
      messageBlocks: events,
      isStreaming: false,
    }
  }

  // 用户消息：从 metadata 中提取附件信息，拼接服务端 URL 用于回显
  let attachments: AttachmentInfo[] | undefined
  if (isUser && data.metadata?.attachments?.length) {
    attachments = (data.metadata.attachments as AttachmentInfo[]).map(att => ({
      ...att,
      url: `${serverUrl.value}/api/files/${att.fileId}`,
    }))
  }

  return {
    ...(isUser ? userAvatar.value : aiAvatar),
    mode: 'simple',
    date: formatDate(data.created_at),
    synthesisText: DOMPurify.sanitize(data.content),
    attachments: attachments?.length ? attachments : undefined,
  }
}

function formatCurrentReply(reply: CurrentReply): FormattedMessage {
  return {
    ...aiAvatar,
    mode: reply.mode,
    date: formatDate(reply.startTime),
    messageBlocks: [...reply.messageBlocks],
  }
}

function addUserMessage(msg: string, attachments?: AttachmentInfo[]) {
  newChatList.value.push({
    ...userAvatar.value,
    date: formatDate(new Date()),
    synthesisText: DOMPurify.sanitize(msg),
    attachments: attachments?.length ? attachments : undefined,
  })
  scrollToBottom()
}

function initCurrentReply() {
  messageViewer = new MessageViewer()

  currentReply.value = {
    sessionId: undefined,
    mode: mode.value,
    messageBlocks: [],
    startTime: Date.now(),
    todo: [],
  }
}

function updateReplyState() {
  if (!currentReply.value)
    return

  currentReply.value = {
    ...currentReply.value,
    messageBlocks: messageViewer.view(),
    todo: messageViewer.viewTodo(),
  }
  scrollToBottom()
}

function finalizeCurrentReply() {
  if (!currentReply.value)
    return

  const finalMessage = formatCurrentReply(currentReply.value)
  newChatList.value.push(finalMessage)
  currentReply.value = null
}

function handleSSEEvent(event: any) {
  const eventData = event.json as SSEEventData | null
  if (!eventData)
    return

  const { type, data, timestamp } = eventData

  switch (type) {
    case 'session':
      if (currentReply.value) {
        currentReply.value.sessionId = data?.sessionId
        updateReplyState()
      }
      break

    case 'thinking':
      messageViewer.add(data?.thinkingId || '', 'thinking', data?.text || '', timestamp)
      updateReplyState()
      break

    case 'content':
      messageViewer.add(data?.contentId || '', 'content', data?.text || '', timestamp)
      updateReplyState()
      break

    case 'tool_call':
      if (data?.taskId) {
        messageViewer.addWorkerEntry(data.taskId, data.toolId || '', 'tool_call', data)
      }
      else {
        messageViewer.add(data?.toolId || '', 'tool_call', data)
      }
      updateReplyState()
      break

    case 'tool_result':
      if (data?.taskId) {
        messageViewer.addWorkerEntry(data.taskId, data.toolId || '', 'tool_result', data)
      }
      else {
        messageViewer.add(data?.toolId || '', 'tool_result', data)
      }
      updateReplyState()
      break

    case 'worker_thinking':
      messageViewer.addWorkerEntry(data?.taskId || '', data?.thinkingId || '', 'worker_thinking', data?.text || '', timestamp)
      updateReplyState()
      break

    case 'worker_content':
      messageViewer.addWorkerEntry(data?.taskId || '', data?.contentId || '', 'worker_content', data?.text || '', timestamp)
      updateReplyState()
      break

    case 'worker_result':
      messageViewer.setWorkerStatus(data?.taskId || '', (data?.status || 'success') as WorkerStatus)
      updateReplyState()
      break
    case 'todo':
      messageViewer.add(type, type, data, timestamp)
      break

    case 'error':
    case 'interrupt':
      if (currentReply.value) {
        messageViewer.add(type, type, data?.message || '', timestamp)
        messageViewer.finalize()
        currentReply.value.messageBlocks = messageViewer.view()
        finalizeCurrentReply()
      }
      isChatting.value = false
      break
    case 'done':
      if (currentReply.value) {
        // 流式结束：把当前 assistant 回复从 currentReply 落盘到 newChatList
        // 这样下一轮对话不会在 initCurrentReply() 时把上一轮日志清空。
        messageViewer.finalize()
        updateReplyState()
        finalizeCurrentReply()
      }
      isChatting.value = false
      break
  }
}

function onChangeMode(value: 'orchestrator' | 'simple') {
  if (value === 'orchestrator') {
    mixpanelTrack('click_agent_multitask')
  }
}

async function processFilesBatch(files: File[]) {
  const remaining = MAX_PENDING_ATTACHMENTS - pendingAttachments.value.length
  if (remaining <= 0) {
    if (files.length > 0) {
      onlyErrorToast(-1, $t('最多上传 {max} 个文件，请先删除部分附件', { max: MAX_PENDING_ATTACHMENTS }))
    }
    return
  }
  const queue = files.slice(0, remaining)
  if (files.length > queue.length) {
    onlyErrorToast(-1, $t('最多上传 {max} 个文件，部分文件未添加', { max: MAX_PENDING_ATTACHMENTS }))
  }
  for (const file of queue) {
    await processFile(file)
  }
}

async function processFile(file: File) {
  if (pendingAttachments.value.length >= MAX_PENDING_ATTACHMENTS) {
    onlyErrorToast(-1, $t('最多上传 {max} 个文件，请先删除部分附件', { max: MAX_PENDING_ATTACHMENTS }))
    return
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    onlyErrorToast(-1, $t('不支持的文件类型，请上传图片、PDF 或文本文件'))
    return
  }
  if (file.size > MAX_FILE_SIZE) {
    onlyErrorToast(-1, $t('文件大小不能超过 5MB'))
    return
  }

  // 读取为 base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  // 上传到服务端
  const { code, data, msg } = await fetch(`${serverUrl.value}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64, mimeType: file.type, fileName: file.name }),
  }).then(r => r.json())

  if (code !== 0) {
    onlyErrorToast(code, msg || $t('文件上传失败'))
    return
  }

  // 图片类型生成本地预览（data URL）
  const preview = file.type.startsWith('image/') ? `data:${file.type};base64,${base64}` : undefined
  if (currentReply.value) {
    currentReply.value.todo = []
  }
  pendingAttachments.value.push({ ...data, preview })
}

function onDragOver(event: DragEvent) {
  if (!health.isOk || isChatting.value)
    return
  event.preventDefault()
  isDraggingOver.value = true
}

function onDragLeave(event: DragEvent) {
  // 只在真正离开整个容器时才重置（子元素触发的 dragleave 忽略）
  const related = event.relatedTarget as Node | null
  if (related && (event.currentTarget as HTMLElement).contains(related))
    return
  isDraggingOver.value = false
}

async function onDrop(event: DragEvent) {
  event.preventDefault()
  isDraggingOver.value = false
  if (!health.isOk || isChatting.value)
    return

  const files = Array.from(event.dataTransfer?.files ?? [])
  await processFilesBatch(files)
}

function removePendingAttachment(fileId: string) {
  pendingAttachments.value = pendingAttachments.value.filter(a => a.fileId !== fileId)
}

async function onSendMessage() {
  if (!tokenInfo.value.ok || !tokenInfo.value.available) {
    onlyErrorToast(-1, $t('当前可用额度不足，请联系客服'))
    return
  }

  const hasText = message.value.trim().length > 0
  const hasAttachments = pendingAttachments.value.length > 0
  if (isChatting.value || (!hasText && !hasAttachments))
    return

  mixpanelTrack('click_agent_send_message')
  const msg = message.value
  message.value = ''
  userScrolledUp.value = false

  // 拿走当前附件并清空
  const attachmentsToSend = pendingAttachments.value.slice()
  pendingAttachments.value = []

  if (!currentConversation.value.is_title_set) {
    currentConversation.value.is_title_set = 1
    currentConversation.value.title = msg.slice(0, 15) || attachmentsToSend[0]?.fileName?.slice(0, 15) || 'New Chat'
  }

  // 把附件转换为展示用格式（用本地预览 URL，避免等服务端响应）
  const displayAttachments: AttachmentInfo[] = attachmentsToSend.map(att => ({
    fileId: att.fileId,
    fileName: att.fileName,
    mimeType: att.mimeType,
    size: att.size,
    url: att.preview || `${serverUrl.value}/api/files/${att.fileId}`,
  }))

  addUserMessage(msg, displayAttachments.length ? displayAttachments : undefined)
  isChatting.value = true
  initCurrentReply()

  fetchSSE(`${serverUrl.value}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: msg,
      mode: mode.value,
      conversationId: currentConversation.value.id,
      enableThinking: true,
      attachments: attachmentsToSend.map(({ fileId, fileName, mimeType, size }) => ({ fileId, fileName, mimeType, size })),
    }),
    onEvent: (event) => {
      console.log('🚀 ~ sendMessage ~ event:', event)
      handleSSEEvent(event)
    },
    onError: (error) => {
      console.error('🚀 ~ sendMessage ~ error:', error)
      if (currentReply.value) {
        messageViewer.finalize()
        // 如果没有任何消息块，添加一个错误提示
        if (!messageViewer.view().length) {
          messageViewer.add('error', 'content', '请求发生错误，请重试')
        }
        currentReply.value.messageBlocks = messageViewer.view()
        finalizeCurrentReply()
      }
      isChatting.value = false
    },
  })
}

async function onStop() {
  isChatting.value = false
  stopConversation()
}

function onShowMoreMenu(event: MouseEvent) {
  showMenu(event, {
    model: [
      {
        label: $t('删除当前对话'),
        icon: 'base/rx_ic_bin_1',
        command: onDeleteConversation,
      },
    ],
  })
}

async function genNewConversation() {
  console.log('🚀 ~ genNewConversation ~ messageList.value:', messageList.value)
  console.log('🚀 ~ genNewConversation ~ isChatting.value:', isChatting.value)
  if (!messageList.value.length || isChatting.value)
    return

  if (messageList.value.length >= chatLimit.value) {
    onlyErrorToast(-1, $t('当前会话数量已达上限，请删除会话后再试'))
    return
  }

  await genConversation()
  newChatList.value = []
}

async function onDeleteConversation() {
  if (conversationList.value.length === 1 && !conversationList.value[0].message_count) {
    return
  }

  try {
    await deleteConversation(currentConversation.value.id)
    await fetchConversations()
  }
  catch (error: any) {
    onlyErrorToast(-1, error.message)
  }
}

const historyRef = useTemplateRef('history')

function showHistory(event: MouseEvent) {
  historyRef.value?.show(event)
}

async function onSwitchConversation(id: string) {
  await switchConversation(id)
  newChatList.value = []
  userScrolledUp.value = false
  historyRef.value?.hide()
}
</script>

<template>
  <div class="relative w-100dvw h-100dvh inline-flex flex-col overflow-hidden chat">
    <RxLoading v-model="health.loading" :opacity="1" />
    <div class="relative flex justify-between items-center h-14 px-4 z-1 ">
      <div class="header">
        Roxy AI Agent
      </div>
      <div class="flex items-center gap-1">
        <RxButton v-if="messageList.length" severity="secondary" variant="text" icon="base/rx_ic_browser_dialog" @click.stop="genNewConversation" />
        <RxButton severity="secondary" variant="text" icon="base/rx_ic_browser_history" @click.stop="showHistory" />
        <RxButton severity="secondary" variant="text" icon="base/rx_ic_more-h" @click.stop="onShowMoreMenu" />
      </div>
    </div>

    <Empty v-if="!messageList.length" v-model:message="message" :preset="promptPreset" class="-mt-14 flex-1 overflow-hidden" />

    <div
      v-else
      ref="scrollContainer"
      class="flex-1 flex flex-col gap-6 px-6 pt-4 overflow-y-auto"
      :style="{
        paddingBottom: `${(pendingAttachments.length > 0 || (currentReply?.todo?.length ?? 0) > 0 ? 40 : 0) + 16}px`,
      }"
      @scroll="handleScroll"
    >
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
              {{ item.synthesisText }}
            </div>
            <div class="flex flex-col gap-2 max-w-185px">
              <!-- 附件预览区域 -->
              <PendingAttachments v-if="item.attachments?.length" :attachments="item.attachments" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 输入区域 -->
    <div
      class="relative flex flex-col gap-2 mx-4 mb-6 pa-3 rounded-2 send"
      :class="{ 'send-dragover': isDraggingOver }"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <!-- 拖拽文件时的蒙层提示 -->
      <Transition name="drag-fade">
        <div v-if="isDraggingOver" class="drag-overlay">
          <SvgIcon name="base/rx_ic_attachment" size="24" color="var(--colors-icon-icon-brand)" />
          <span>{{ $t('松开以上传文件') }}</span>
        </div>
      </Transition>

      <!-- 附件预览区域 -->
      <div v-if="pendingAttachments.length" class="flex flex-wrap gap-2 absolute -top-2.5 -translate-y-full left-0">
        <PendingAttachments
          :attachments="pendingAttachments"
          :on-remove="removePendingAttachment"
        />
      </div>

      <Textarea v-model="message" :disabled="!health.isOk" class="relative z-10 !pa-0 !shadow-none !border-none resize-none send-textarea" :placeholder="!health.isOk ? $t('MCP 服务异常，请稍后重试') : $t('请输入您的指令')" fluid
                rows="3" cols="30" @keydown.enter.exact.prevent="onSendMessage"
      />
      <div class="flex items-center gap-4 select-none">
        <div class="flex items-center gap-1">
          <RxToggleSwitch v-model="mode" :disabled="!health.isOk" class="-ml-2 -mr-1 scale-70" true-value="orchestrator" false-value="simple" @change="onChangeMode" />
          <span v-tooltip.top="{ value: $t('打开该选项后，可以让数字员工同时并行操作多个窗口执行任务。同时您的 Token 会消耗地更快。'), showDelay: 300 }" class="cursor-pointer send-text">{{ $t('多窗口并行') }}</span>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          multiple
          class="hidden"
          :accept="ALLOWED_MIME_TYPES.join(',')"
          @change="onFileInputChange"
        >
        <div
          class="flex items-center gap-1.5 transition-opacity duration-200"
          :class="pendingAttachments.length >= MAX_PENDING_ATTACHMENTS ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'"
          @click="onClickUpload"
        >
          <SvgIcon name="base/rx_ic_attachment" color="var(--colors-icon-icon-primary)" />
          <span class="send-text">{{ $t('上传') }}</span>
        </div>

        <!-- <div v-if="tokenInfo.ok" class="flex items-center gap-1">
          <CircleProgress :value="tokenInfo.value" size="18" stroke-width="3" />
          <span v-tooltip.top="{ value: $t('Roxy AI Agent 执行任务将消耗对应的额度，额度归零则无法继续执行。如需您的业务需要更多额度，请联系技术支持。'), showDelay: 300 }" class="send-text">{{ $t('剩余额度: {value}%', { value: tokenInfo.value })
          }}</span>
        </div> -->
        <SvgIcon v-if="!isChatting" class="cursor-pointer mx-auto mr-0" :class="{ 'p-disabled send-inactive': !message }" name="base/rx_ic_browser_send" size="24" color="var(--colors-icon-icon-brand)"
                 @click.stop="onSendMessage"
        />
        <SvgIcon v-else class="cursor-pointer mx-auto mr-0" name="base/rx_ic_browser_stop" color="var(--colors-icon-icon-secondary)" size="24" @click.stop="onStop" />
      </div>

      <div v-if="currentReply?.todo?.length" class="absolute z-9 -top-2.5 -translate-y-full left-0 bg-[var(--colors-background-bg-block)] rounded-2 p-3 w-full" :class="{ 'pb-4': todoExpanded }">
        <div class="flex justify-between items-center cursor-pointer select-none" @click="todoExpanded = !todoExpanded">
          <span class="text-3 leading-4 font-500 text-[var(--colors-text-text-primary)]">Agent's todo List</span>
          <motion.div
            :animate="{ rotate: todoExpanded ? 0 : 180 }"
            :transition="{ duration: 0.25, ease: 'easeInOut' }"
            class="flex items-center justify-center"
          >
            <SvgIcon name="base/rx_ic_chevron_down" size="16" />
          </motion.div>
        </div>
        <motion.div
          :animate="{ height: todoExpanded ? 'auto' : 0 }"
          :initial="false"
          :transition="{ duration: 0.25, ease: 'easeInOut' }"
          style="overflow: hidden;"
        >
          <div class="flex flex-col gap-2.5 pt-2.5">
            <div v-for="value in currentReply.todo" :key="value.content" class="flex gap-1.5 items-center">
              <SvgIcon v-if="value.status === 'completed'" name="base/rx_ic_check_fill" color="var(--colors-icon-icon-success)" />
              <div v-else class="size-4 rounded-full border-solid border-1 border-[var(--colors-border-border-base)] bg-white" />
              <span class="text-3 leading-4" :class="{
                'text-[var(--colors-text-text-inactive)] decoration-line-through': value.status === 'completed',
                'text-[var(--colors-text-text-primary)]': value.status === 'pending' || value.status === 'in_progress',
              }"
              >{{ value.content }}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
    <RyPopover ref="history">
      <div class="w-75 max-h-120 flex flex-col overflow-y-auto">
        <div class="flex items-center h-10 px-4 history-header">
          {{ $t('历史记录') }}
        </div>
        <div v-for="item in conversationList" :key="item.id" class="flex items-start px-4 py-3 gap-2 !last:border-none cursor-pointer history-item"
             :class="{ used: item.id === currentConversation.id }" @click.stop="onSwitchConversation(item.id)"
        >
          <div class="pa-1">
            <SvgIcon name="base/rx_ic_browser_talk" />
          </div>
          <div class="flex-1 flex flex-col gap-1.5 overflow-hidden">
            <div class="ellipsis-1 history-title">
              {{ item.title }}
            </div>
            <div class="flex items-center justify-between">
              <div class="history-date">
                {{ item.created_at }}
              </div>
              <div class="flex items-center gap-1 history-detail">
                <span>{{ $t('查看详情') }}</span>
                <SvgIcon name="base/rx_ic_chevron_right" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </RyPopover>
  </div>
</template>

<style scoped lang="scss">
.chat {
  background: var(--colors-background-bg-page);
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 160%;
  letter-spacing: 0.2px;
}

.history {
  &-header {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 24px;
  }

  &-item {
    border-bottom: 1px solid var(--colors-border-border-subtle);
    background: var(--colors-background-bg-body);

    &.used {
      border-bottom-color: var(--colors-border-border-info);
      background: var(--colors-background-bg-info);
    }
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    line-height: 20px;
  }

  &-date {
    color: var(--colors-text-text-inactive);
    font-size: 12px;
    line-height: 16px;
  }

  &-detail {
    color: var(--colors-text-text-brand);
    font-size: 12px;
    line-height: 18px;
  }
}

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

.send {
  border: 1px solid var(--textarea-border-color);
  box-shadow: var(--textarea-shadow);
  background: var(--colors-background-bg-action);

  transition:
    background var(--textarea-transition-duration),
    color var(--textarea-transition-duration),
    border-color var(--textarea-transition-duration),
    box-shadow var(--textarea-transition-duration);

  &:has(.p-textarea:disabled) {
    background: var(--textarea-disabled-background);
    color: var(--textarea-disabled-color);
  }

  &:has(.p-textarea:enabled:focus) {
    border-color: var(--textarea-focus-border-color);
    box-shadow: var(--textarea-focus-ring-shadow);
  }

  &-textarea {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    line-height: 18px;
  }

  &-text {
    color: var(--colors-text-text-primary);
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
  }

  &-inactive {
    color: var(--colors-icon-icon-inactive);
  }
}

.send {
  &-dragover {
    border-color: var(--colors-border-border-info) !important;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--colors-border-border-info) 20%, transparent) !important;
  }
}

.drag-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: inherit;
  background: color-mix(in srgb, var(--colors-background-bg-action) 90%, transparent);
  color: var(--colors-text-text-brand);
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
}

.drag-fade-enter-active,
.drag-fade-leave-active {
  transition: opacity 0.15s ease;
}

.drag-fade-enter-from,
.drag-fade-leave-to {
  opacity: 0;
}
</style>
