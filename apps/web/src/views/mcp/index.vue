<script setup lang="ts">
import Empty from '/@/views/mcp/components/empty.vue'
import SimpleItem from '/@/views/mcp/components/simple-item.vue'
import OrchestratorItem from '/@/views/mcp/components/orchestrator-item.vue'
import DOMPurify from 'dompurify'
import { format } from 'date-fns'
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useMcp } from '/@/views/mcp/hook'
import { createSSEProcessContext, fetchSSE, finalizeMessageBlocks, finalizeWorkerTasks, parseHistorySSE, processSSEEvent } from '/@/views/mcp/util'
import type { SSEProcessContext } from '/@/views/mcp/util'
import type { AvatarInfo, CurrentReply, FormattedMessage, SSEEventData } from '/@/views/mcp/types'

const { userInfo } = storeToRefs(useUserStore())
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

// 用于实时流的处理上下文
let replyContext: SSEProcessContext = createSSEProcessContext()

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

electronAPI.on('mcp:token-usage', calculateTokenValue)

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

function scrollToBottom() {
  // 用户在一次对话期间主动滚动过鼠标滚轮将禁止自动触底滚动
  if (userScrolledUp.value)
    return

  nextTick(() => {
    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollTop = scrollContainerRef.value.scrollHeight
    }
  })
}

function handleWheel(event: WheelEvent) {
  if (!isChatting.value)
    return

  if (event.deltaY < 0) {
    userScrolledUp.value = true
  }
}

function formatDate(date: Date | string | number): string {
  return format(new Date(date), 'yyyy/MM/dd HH:mm')
}

function formatMessage(data: any): FormattedMessage {
  const isUser = data.role === 'user'

  // 解析 assistant 的 SSE 格式消息
  if (!isUser && data.content?.includes('event:')) {
    const { messageBlocks, workerTasks, planningText, synthesisText, endStatus, errorMessage } = parseHistorySSE(data.content)
    // 对 messageBlocks 中的文本内容进行处理，历史消息中 thinking 都已完成
    const formattedBlocks = messageBlocks.map((block) => {
      if (block.type === 'thinking') {
        return { ...block, isThinking: false }
      }
      return block
    })
    return {
      ...aiAvatar,
      mode: data.agent_mode,
      date: formatDate(data.created_at),
      synthesisText,
      messageBlocks: formattedBlocks,
      workerTasks: workerTasks.map(task => ({
        ...task,
        thinkings: task.thinkings.map(t => ({ ...t, isThinking: false })),
      })),
      planningText,
      isStreaming: false,
      endStatus,
      errorMessage,
    }
  }

  return {
    ...(isUser ? userAvatar.value : aiAvatar),
    mode: 'simple',
    date: formatDate(data.created_at),
    synthesisText: DOMPurify.sanitize(data.content),
  }
}

function formatCurrentReply(reply: CurrentReply): FormattedMessage {
  return {
    ...aiAvatar,
    mode: reply.mode,
    date: formatDate(reply.startTime),
    synthesisText: reply.synthesisText,
    messageBlocks: [...reply.messageBlocks],
    workerTasks: [...reply.workerTasks],
    planningText: reply.planningText,
    planningState: { ...reply.planningState },
    isStreaming: !reply.isComplete,
    endStatus: reply.endStatus,
    errorMessage: reply.errorMessage,
  }
}

function addUserMessage(msg: string) {
  newChatList.value.push({
    ...userAvatar.value,
    date: formatDate(new Date()),
    synthesisText: DOMPurify.sanitize(msg),
  })
  scrollToBottom()
}

function initCurrentReply() {
  replyContext = createSSEProcessContext()

  currentReply.value = {
    sessionId: undefined,
    mode: mode.value,
    messageBlocks: [],
    workerTasks: [],
    planningText: '',
    planningState: { isPlanning: false },
    synthesisText: '',
    isComplete: false,
    startTime: Date.now(),
  }
}

function updateReplyState() {
  if (!currentReply.value)
    return

  currentReply.value = {
    ...currentReply.value,
    // 深拷贝 messageBlocks，确保 Vue 能检测到内部属性变化
    messageBlocks: replyContext.messageBlocks.map(block => ({ ...block })),
    // 深拷贝 workerTasks，包括其中的 thinkings、toolCalls 和 contents
    workerTasks: Array.from(replyContext.workerTaskMap.values()).map(task => ({
      ...task,
      thinkings: task.thinkings.map(t => ({ ...t })),
      toolCalls: task.toolCalls.map(tc => ({ ...tc })),
      contents: task.contents.map(c => ({ ...c })),
    })),
    planningText: replyContext.planningAccumulator.value,
    planningState: { ...replyContext.planningState },
    synthesisText: replyContext.textAccumulator.value,
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

  switch (eventData.type) {
    case 'session':
      if (currentReply.value) {
        currentReply.value.sessionId = eventData.data?.sessionId
        // 开始规划状态
        replyContext.planningState.isPlanning = true
        replyContext.planningState.startTimestamp = eventData.timestamp
        updateReplyState()
      }
      break

    case 'planning':
    case 'thinking':
    case 'tool_call':
    case 'tool_result':
    case 'worker_thinking':
    case 'worker_content':
    case 'worker_result':
    case 'content':
    case 'synthesis':
      // 使用公共处理逻辑
      processSSEEvent(eventData, replyContext)
      updateReplyState()
      break

    case 'done':
    case 'error':
    case 'interrupt':
      if (currentReply.value) {
        const isAbnormalEnd = eventData.type === 'error' || eventData.type === 'interrupt'

        currentReply.value.isComplete = true
        currentReply.value.endStatus = eventData.type as 'done' | 'error' | 'interrupt'

        // 保存错误/中断消息
        if (eventData.type !== 'done' && eventData.data?.message) {
          currentReply.value.errorMessage = eventData.data.message
        }

        currentReply.value.messageBlocks = finalizeMessageBlocks(replyContext.messageBlocks, isAbnormalEnd)

        currentReply.value.workerTasks = finalizeWorkerTasks(
          Array.from(replyContext.workerTaskMap.values()),
          isAbnormalEnd,
        )
        currentReply.value.synthesisText = replyContext.textAccumulator.value
        finalizeCurrentReply()
      }
      isChatting.value = false
      break
  }
}

async function onSendMessage() {
  if (!tokenInfo.value.ok || !tokenInfo.value.available) {
    onlyErrorToast(-1, $t('当前可用额度不足，请联系客服'))
    return
  }

  if (isChatting.value || !message.value.trim())
    return

  const msg = message.value
  message.value = ''
  userScrolledUp.value = false

  if (!currentConversation.value.is_title_set) {
    currentConversation.value.is_title_set = 1
    currentConversation.value.title = msg.slice(0, 15)
  }

  addUserMessage(msg)
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
    }),
    onEvent: (event) => {
      console.log('🚀 ~ sendMessage ~ event:', event)
      handleSSEEvent(event)
    },
    onError: (error) => {
      console.error('🚀 ~ sendMessage ~ error:', error)
      if (currentReply.value) {
        currentReply.value.isComplete = true
        // 如果没有任何消息块，添加一个错误提示
        if (!currentReply.value.messageBlocks.length) {
          currentReply.value.messageBlocks.push({
            type: 'content',
            contentId: 'error',
            text: '请求发生错误，请重试',
          })
        }
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

    <div v-else ref="scrollContainer" class="flex-1 flex flex-col gap-6 px-6 py-4 overflow-y-auto" @wheel="handleWheel">
      <div v-for="(item, index) in messageList" :key="index" class="flex items-start self-stretch gap-2">
        <RxAvatar class="user-avatar" :avatar="item.avatar" :color="item.color" :name="item.name" :size="32" :font-size="16" />
        <div class="flex-1 flex flex-col gap-2 overflow-hidden">
          <div class="flex items-center justify-between gap-2">
            <span class="user-name">{{ item.userName }}</span>
            <span class="user-date">{{ item.date }}</span>
          </div>
          <OrchestratorItem v-if="item.mode === 'orchestrator'" :item="item" />
          <SimpleItem v-else :item="item" />
        </div>
      </div>
    </div>
    <!-- 输入区域 -->
    <div class="relative flex flex-col gap-4 mx-4 mb-6 pa-3 rounded-2 send">
      <Textarea v-model="message" :disabled="!health.isOk" class="!pa-0 !shadow-none !border-none resize-none send-textarea" :placeholder="!health.isOk ? $t('MCP 服务异常，请稍后重试') : $t('请输入您的指令')" fluid
                rows="3" cols="30" @keydown.enter.exact.prevent="onSendMessage"
      />
      <div class="flex items-center gap-4 select-none">
        <div class="flex items-center gap-1">
          <RxToggleSwitch v-model="mode" :disabled="!health.isOk" class="-ml-2 -mr-1 scale-70" true-value="orchestrator" false-value="simple" />
          <span v-tooltip.top="{ value: $t('打开该选项后，可以让数字员工同时并行操作多个窗口执行任务。同时您的 Token 会消耗地更快。'), showDelay: 300 }" class="cursor-pointer send-text">{{ $t('多窗口并行') }}</span>
        </div>

        <div v-if="tokenInfo.ok" class="flex items-center gap-1">
          <CircleProgress :value="tokenInfo.value" size="18" stroke-width="3" />
          <span v-tooltip.top="{ value: $t('Roxy AI Agent 执行任务将消耗对应的额度，额度归零则无法继续执行。如需您的业务需要更多额度，请联系技术支持。'), showDelay: 300 }" class="send-text">{{ $t('剩余额度: {value}%', { value: tokenInfo.value })
          }}</span>
        </div>
        <SvgIcon v-if="!isChatting" class="cursor-pointer mx-auto mr-0" :class="{ 'p-disabled send-inactive': !message }" name="base/rx_ic_browser_send" size="24" color="var(--colors-icon-icon-brand)"
                 @click.stop="onSendMessage"
        />
        <SvgIcon v-else class="cursor-pointer mx-auto mr-0" name="base/rx_ic_browser_stop" color="var(--colors-icon-icon-secondary)" size="24" @click.stop="onStop" />
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
</style>
