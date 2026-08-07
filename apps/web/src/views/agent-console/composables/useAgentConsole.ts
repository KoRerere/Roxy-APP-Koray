import type { AgentAttachment, AgentConsoleState, AgentConversation, AgentFolderSelection, AgentHitlSubmitPayload, AgentMessage, AgentPathSelection, AgentProcessEvent, AgentRunStatus, AgentTodoItem, AgentTodoItemStatus, AgentTodoProgress } from '../types'
import type { AgentChannelMessage, AgentConversationRunEventDTO } from '@roxy/shared/channel'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { collectTaskConversationIds } from '../agent-channel-state'
import { useAgentConsoleApi } from '../api'
import type { ConversationReadTarget } from '../conversation-unread-state'
import { getConversationReadTarget } from '../conversation-unread-state'
import { appendConversationRunEvent, LocallyStoppedConversationRunRegistry, PendingConversationRunRegistry, reconcileConversationRunSummary, replaceConversationRunEvents, terminalRunStatus } from '../conversation-run-state'
import { createHitlRequestFromAgentEvent, createLegacyResumeDecisions } from '../hitlAdapter'
import { buildProcessFromEvents, formatTime, mapHistoryConversation, mapHistoryMessages } from '../historyAdapter'
import { useAgentAccessMode } from './useAgentAccessMode'
import { useAgentChannelState } from './useAgentChannel'
import { useTaskMonitor } from './useTaskMonitor'
import { createPerfTimer, perfLog } from '/@/utils/perf-log'

let state: AgentConsoleState | undefined
const homePrompt = ref('')
const homePendingAttachments = ref<AgentAttachment[]>([])

const CONVERSATION_PAGE_SIZE = 10

const loadedConversationDetails = new Set<string>()
const loadingConversationDetails = new Set<string>()
const recoveringRunIds = new Set<string>()
const bufferedRunEvents = new Map<string, AgentConversationRunEventDTO[]>()
let conversationListLoadPromise: Promise<void> | undefined
let conversationListMorePromise: Promise<void> | undefined
let conversationServerIds: string[] = []
const conversationListHasMore = ref(true)
const conversationListLoadingMore = ref(false)
let conversationRunSubscriberInstalled = false

interface PendingRunStart {
  requestId: string
  content: string
  draftContent: string
  attachments: AgentAttachment[]
}

const PENDING_RUN_START_TIMEOUT_MS = 15_000
const pendingRunStarts = new PendingConversationRunRegistry<PendingRunStart>()
const pendingRunPayloads = new Map<string, PendingRunStart>()
const locallyStoppedRuns = new LocallyStoppedConversationRunRegistry<PendingRunStart>()
const pendingRunVersion = ref(0)

function getState() {
  state ||= reactive(createEmptyAgentConsoleState()) as AgentConsoleState
  return state
}

function createEmptyAgentConsoleState(): AgentConsoleState {
  return {
    conversationIds: [],
    conversationsById: {},
    draftsByConversationId: {},
    messagesByConversationId: {},
    runsById: {},
    streamsByRunId: {},
    todoProgressByRunId: {},
    taskGroupsByConversationId: {},
    pendingHitlByConversationId: {},
  }
}

function getRouteConversationId(value: unknown) {
  if (Array.isArray(value))
    return value[0]

  return typeof value === 'string' ? value : undefined
}

function createConversationTitle(prompt?: string) {
  const normalized = prompt?.trim()
  if (!normalized)
    return 'New conversation'

  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized
}

function getCurrentDisplayTime() {
  return formatTime(Date.now())
}

function createConversation(consoleState: AgentConsoleState, title = 'New conversation', conversationId?: string) {
  const id = conversationId ?? `conv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const conversation: AgentConversation = {
    id,
    title,
    updatedAt: getCurrentDisplayTime(),
    runningRunIds: [],
    unread: false,
  }

  consoleState.conversationIds.unshift(id)
  consoleState.conversationsById[id] = conversation
  consoleState.draftsByConversationId[id] = { conversationId: id, prompt: '', attachments: [] }
  consoleState.messagesByConversationId[id] = []
  consoleState.taskGroupsByConversationId[id] = []

  return conversation
}

function ensureConversation(consoleState: AgentConsoleState, conversationId?: string) {
  if (!conversationId)
    return undefined

  return consoleState.conversationsById[conversationId] ?? createConversation(consoleState, 'Loading conversation...', conversationId)
}

function setRunStatus(
  consoleState: AgentConsoleState,
  runId: string,
  status: AgentRunStatus,
  error?: string,
  options: { markUnread?: boolean } = {},
) {
  const run = consoleState.runsById[runId]
  const stream = consoleState.streamsByRunId[runId]

  if (run) {
    run.status = status
    run.error = error
    if (status === 'completed' || status === 'failed' || status === 'cancelled')
      run.completedAt = getCurrentDisplayTime()
  }

  if (stream) {
    stream.status = status
    stream.error = error
  }

  if (run && (status === 'completed' || status === 'failed' || status === 'cancelled')) {
    const conversation = consoleState.conversationsById[run.conversationId]
    if (conversation) {
      conversation.latestRunStatus = status
      conversation.runningRunIds = conversation.runningRunIds.filter(id => id !== runId)
      // 会话由运行中转为空闲时纳入 LRU 管理（可能触发淘汰最早的非运行中会话）
      if (conversation.runningRunIds.length === 0)
        touchConversationCache(consoleState, run.conversationId)
      if (options.markUnread)
        conversation.unread = true
    }
    delete consoleState.todoProgressByRunId[runId]
    delete consoleState.pendingHitlByConversationId[run.conversationId]
  }
}

function isRunActive(status?: AgentRunStatus) {
  return status === 'queued' || status === 'streaming'
}

function isConversationRunning(consoleState: AgentConsoleState, conversationId: string) {
  const conversation = consoleState.conversationsById[conversationId]
  if (!conversation)
    return false

  return conversation.runningRunIds.some((runId) => {
    const run = consoleState.runsById[runId]
    return !run || isRunActive(run.status)
  })
}

// 非运行中会话的消息缓存 LRU 上限。运行中会话常驻内存，不参与淘汰。
const MESSAGE_CACHE_LIMIT = 3
// Map 保持插入顺序：delete 后重新 set 即把会话移到"最近使用"位置。
const recentConversationIds = new Map<string, true>()

function evictConversationMessages(consoleState: AgentConsoleState, conversationId: string) {
  delete consoleState.messagesByConversationId[conversationId]
  loadedConversationDetails.delete(conversationId)
}

// 将会话标记为最近使用并纳入 LRU 管理；超出上限时淘汰最久未用的非运行中会话消息。
// 运行中会话常驻，不进入 LRU。普通 delete 不清理消息，故 run 启动时从 LRU 移除是安全的。
function touchConversationCache(consoleState: AgentConsoleState, conversationId: string) {
  if (isConversationRunning(consoleState, conversationId))
    return

  recentConversationIds.delete(conversationId)
  recentConversationIds.set(conversationId, true)

  while (recentConversationIds.size > MESSAGE_CACHE_LIMIT) {
    const oldest = recentConversationIds.keys().next().value
    if (oldest === undefined)
      break

    recentConversationIds.delete(oldest)
    evictConversationMessages(consoleState, oldest)
  }
}

function isLocalConversationId(id: string) {
  return id.startsWith('conv-')
}

function isLocalMessageForActiveRun(consoleState: AgentConsoleState, message: AgentMessage) {
  if (message.status === 'thinking' || message.status === 'streaming')
    return true

  if (!message.runId)
    return false

  return isRunActive(consoleState.runsById[message.runId]?.status)
}

function getMessageSignature(message: AgentMessage) {
  return `${message.role}:${message.content.trim()}`
}

function mergeHistoryMessages(consoleState: AgentConsoleState, conversationId: string, historyMessages: AgentMessage[]) {
  const localMessages = consoleState.messagesByConversationId[conversationId] ?? []
  const hasLocalRunMessages = localMessages.some(message => message.runId && consoleState.runsById[message.runId])

  if (!historyMessages.length && hasLocalRunMessages)
    return false

  const frozenMessagesById = new Map(
    localMessages
      .filter(message => message.runId && locallyStoppedRuns.hasRun(message.runId))
      .map(message => [message.id, message]),
  )
  const mergedHistoryMessages = historyMessages.map(message => frozenMessagesById.get(message.id) ?? message)
  const activeLocalMessages = localMessages.filter((message) => {
    return isLocalMessageForActiveRun(consoleState, message)
      || Boolean(message.runId && locallyStoppedRuns.hasRun(message.runId))
  })

  if (!activeLocalMessages.length) {
    consoleState.messagesByConversationId[conversationId] = mergedHistoryMessages
    return true
  }

  const historyIds = new Set(mergedHistoryMessages.map(message => message.id))
  const historySignatures = new Set(mergedHistoryMessages.map(message => getMessageSignature(message)))
  const optimisticMessages = activeLocalMessages.filter((message) => {
    if (historyIds.has(message.id))
      return false

    return !message.content.trim() || !historySignatures.has(getMessageSignature(message))
  })

  consoleState.messagesByConversationId[conversationId] = [...mergedHistoryMessages, ...optimisticMessages]
  return historyMessages.length > 0
}

function removeConversation(consoleState: AgentConsoleState, conversationId: string) {
  conversationServerIds = conversationServerIds.filter(id => id !== conversationId)
  revokeAttachments(consoleState.draftsByConversationId[conversationId]?.attachments)
  consoleState.conversationIds = consoleState.conversationIds.filter(id => id !== conversationId)
  delete consoleState.conversationsById[conversationId]
  delete consoleState.draftsByConversationId[conversationId]
  delete consoleState.messagesByConversationId[conversationId]
  delete consoleState.taskGroupsByConversationId[conversationId]
  delete consoleState.pendingHitlByConversationId[conversationId]
  loadedConversationDetails.delete(conversationId)
  loadingConversationDetails.delete(conversationId)
  recentConversationIds.delete(conversationId)

  const conversationRunIds = Object.values(consoleState.runsById)
    .filter(run => run.conversationId === conversationId)
    .map(run => run.id)
  locallyStoppedRuns.removeConversation(conversationId, conversationRunIds)

  for (const runId of Object.keys(consoleState.runsById)) {
    if (consoleState.runsById[runId]?.conversationId !== conversationId)
      continue

    delete consoleState.runsById[runId]
    delete consoleState.streamsByRunId[runId]
    delete consoleState.todoProgressByRunId[runId]
  }
}

function createEmptyDraft(conversationId: string) {
  return { conversationId, prompt: '', attachments: [] as AgentAttachment[] }
}

function revokeAttachments(attachments?: AgentAttachment[]) {
  for (const attachment of attachments ?? []) {
    if (attachment.preview)
      URL.revokeObjectURL(attachment.preview)
  }
}

function isImageFile(fileName: string, mimeType: string) {
  return mimeType.startsWith('image/')
    || /\.(?:png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(fileName)
}

function inferMimeType(file: File) {
  return inferMimeTypeFromName(file.name, file.type)
}

function inferMimeTypeFromName(fileName: string, fallback = 'application/octet-stream') {
  if (fallback && fallback !== 'application/octet-stream')
    return fallback

  const ext = fileName.split('.').pop()?.toLowerCase()
  const mimeByExt: Record<string, string> = {
    avif: 'image/avif',
    bmp: 'image/bmp',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    webp: 'image/webp',
  }

  return ext ? mimeByExt[ext] ?? 'application/octet-stream' : 'application/octet-stream'
}

function localPathToMediaUrl(filePath: string) {
  return `roxy-media:${filePath}`
}

function createLocalAttachment(file: File): AgentAttachment {
  const mimeType = inferMimeType(file)
  const shouldPreview = isImageFile(file.name, mimeType)

  return {
    fileId: `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    kind: 'file',
    fileName: file.name,
    mimeType,
    size: file.size,
    preview: shouldPreview ? URL.createObjectURL(file) : undefined,
    localFile: file,
    uploadStatus: 'pending',
  }
}

function createLocalFolderAttachment(folder: AgentFolderSelection): AgentAttachment {
  const files = folder.files ?? []
  return {
    fileId: `local-folder-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    kind: 'folder',
    fileName: folder.name,
    mimeType: 'inode/directory',
    size: files.reduce((total, file) => total + file.size, 0),
    localFiles: files.length > 0 ? files : undefined,
    localPath: folder.path,
    uploadStatus: 'pending',
  }
}

function createLocalPathAttachment(selection: AgentPathSelection): AgentAttachment {
  const mimeType = selection.kind === 'folder' ? 'inode/directory' : inferMimeTypeFromName(selection.name)
  const shouldPreview = selection.kind === 'file' && isImageFile(selection.name, mimeType)

  return {
    fileId: `local-path-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    kind: selection.kind,
    fileName: selection.name,
    mimeType,
    localPath: selection.path,
    preview: shouldPreview ? localPathToMediaUrl(selection.path) : undefined,
    uploadStatus: 'pending',
  }
}

function normalizeTodoStatus(value: unknown): AgentTodoItemStatus {
  if (value === 'in_progress' || value === 'completed')
    return value

  return 'pending'
}

function getTodoSource(data: unknown): unknown[] {
  if (Array.isArray(data))
    return data

  if (data && typeof data === 'object') {
    const todos = (data as { todos?: unknown }).todos
    if (Array.isArray(todos))
      return todos
  }

  return []
}

function buildTodoProgress(conversationId: string, runId: string, data: unknown): AgentTodoProgress | undefined {
  const todos: AgentTodoItem[] = getTodoSource(data)
    .map((item, index) => {
      const value = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const content = typeof value.content === 'string'
        ? value.content
        : typeof value.title === 'string'
          ? value.title
          : typeof value.text === 'string'
            ? value.text
            : ''

      return {
        id: typeof value.id === 'string' ? value.id : `todo-${index}`,
        content,
        status: normalizeTodoStatus(value.status),
      }
    })
    .filter(item => item.content.trim())

  if (!todos.length)
    return undefined

  const activeIndex = todos.findIndex(item => item.status === 'in_progress')
  const pendingIndex = todos.findIndex(item => item.status === 'pending')
  const completedCount = todos.filter(item => item.status === 'completed').length
  const currentIndex = activeIndex >= 0
    ? activeIndex
    : pendingIndex >= 0
      ? pendingIndex
      : Math.max(0, completedCount - 1)

  return {
    id: `todo-progress-${runId}`,
    conversationId,
    runId,
    current: Math.min(currentIndex + 1, todos.length),
    total: todos.length,
    content: todos[currentIndex]?.content,
    todos,
  }
}

export function useAgentConsole() {
  const consoleState = getState()
  const agentApi = useAgentConsoleApi()
  const userStore = useUserStore()
  const { fullAccess } = useAgentAccessMode()
  const [showToast, onlyErrorToast] = useResponseToast()
  const agentChannel = useAgentChannelState()
  const taskMonitor = useTaskMonitor()
  const route = useRoute()
  const router = useRouter()
  perfLog('agent-console:useAgentConsole:start')

  function refreshPayInfoAfterAgentActivity(): void {
    void userStore.getUserPayInfo().catch((error) => {
      console.warn('[agent-console] Failed to refresh pay info after agent activity:', error)
    })
  }

  const routeConversationId = computed(() => getRouteConversationId(route.params.conversationId))

  watch(
    () => [route.name, routeConversationId.value] as const,
    ([routeName, conversationId]) => {
      if (routeName === 'agent-console-conversation') {
        ensureConversation(consoleState, conversationId)
        if (conversationId)
          void loadConversationDetail(conversationId)
      }
    },
    { immediate: true },
  )

  watch(
    () => collectTaskConversationIds({
      taskLogs: agentChannel.taskLogs.value,
      taskExecutionDetails: agentChannel.taskExecutionDetails.value,
    }),
    (conversationIds) => {
      for (const conversationId of conversationIds) {
        if (!consoleState.conversationsById[conversationId]
          || !consoleState.conversationIds.includes(conversationId)) {
          void loadConversationDetail(conversationId, true)
        }
      }
    },
    { flush: 'post', immediate: true },
  )

  onMounted(() => {
    perfLog('agent-console:onMounted')
    void loadConversationList()
  })

  const activeConversationId = computed(() => {
    const conversationId = routeConversationId.value
    if (conversationId && consoleState.conversationsById[conversationId])
      return conversationId

    return undefined
  })

  const activeConversation = computed(() => {
    const conversationId = activeConversationId.value
    return conversationId ? consoleState.conversationsById[conversationId] : undefined
  })

  const markingConversationReadKeys = new Set<string>()

  async function markConversationRead(target: ConversationReadTarget) {
    const key = `${target.conversationId}:${target.runId}`
    if (markingConversationReadKeys.has(key))
      return

    markingConversationReadKeys.add(key)
    try {
      const updated = await agentApi.markConversationRead(target.conversationId, target.runId)
      mergeConversation(mapHistoryConversation(updated))
    }
    catch (error) {
      console.error(`[agent-console] Failed to mark conversation ${target.conversationId} as read:`, error)
    }
    finally {
      markingConversationReadKeys.delete(key)
    }
  }

  watch(
    () => getConversationReadTarget(activeConversation.value, activeConversationId.value),
    (target) => {
      if (target)
        void markConversationRead(target)
    },
    { immediate: true },
  )

  const conversationList = computed(() => consoleState.conversationIds.map(id => consoleState.conversationsById[id]).filter(Boolean))

  const messageList = computed(() => {
    const conversationId = activeConversationId.value
    return conversationId ? consoleState.messagesByConversationId[conversationId] ?? [] : []
  })

  const taskGroupList = taskMonitor.taskGroupList

  const activeHitlRequest = computed(() => {
    const conversationId = activeConversationId.value
    return conversationId ? consoleState.pendingHitlByConversationId[conversationId] : undefined
  })
  const pendingApprovalConversationIds = computed(() => Object.keys(consoleState.pendingHitlByConversationId))

  const activeTodoProgress = computed(() => {
    const conversation = activeConversation.value
    if (!conversation)
      return undefined

    for (let index = conversation.runningRunIds.length - 1; index >= 0; index--) {
      const runId = conversation.runningRunIds[index]
      const run = consoleState.runsById[runId]
      const progress = consoleState.todoProgressByRunId[runId]
      if (progress && (run?.status === 'queued' || run?.status === 'streaming'))
        return progress
    }

    return undefined
  })

  const prompt = computed({
    get() {
      const conversationId = activeConversationId.value
      return conversationId
        ? consoleState.draftsByConversationId[conversationId]?.prompt ?? ''
        : homePrompt.value
    },
    set(value: string) {
      const conversationId = activeConversationId.value
      if (!conversationId) {
        homePrompt.value = value
        return
      }

      consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
      consoleState.draftsByConversationId[conversationId].prompt = value
    },
  })

  const pendingAttachments = computed(() => {
    const conversationId = activeConversationId.value
    if (!conversationId)
      return homePendingAttachments.value

    consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
    return consoleState.draftsByConversationId[conversationId].attachments
  })

  const hasPendingAttachmentUploads = computed(() => {
    return pendingAttachments.value.some(attachment => attachment.uploadStatus === 'uploading')
  })

  const isThinking = computed(() => {
    const conversation = activeConversation.value
    if (!conversation)
      return false

    if (pendingRunVersion.value >= 0 && pendingRunStarts.has(conversation.id))
      return true

    return conversation.runningRunIds.some((runId) => {
      const run = consoleState.runsById[runId]
      return run?.status === 'queued' || run?.status === 'streaming'
    })
  })

  const runningTaskCount = computed(() => {
    return taskMonitor.runningTaskCount.value
  })

  function routeToConversation(conversationId: string) {
    return router.push({
      name: 'agent-console-conversation',
      params: { conversationId },
      query: route.query,
    })
  }

  function selectConversation(id: string) {
    return routeToConversation(id)
  }

  async function startNewChat() {
    homePrompt.value = ''
    clearPendingAttachments()
    await router.push({
      name: 'agent-console-chat',
      query: route.query,
    })
  }

  function toggleTaskGroup(id: string) {
    taskMonitor.toggleTaskGroup(id)
  }

  function mergeConversation(conversation: AgentConversation) {
    const existing = consoleState.conversationsById[conversation.id]
    const runSummary = reconcileConversationRunSummary(
      existing,
      conversation,
      Boolean(conversation.latestRunId && locallyStoppedRuns.hasRun(conversation.latestRunId)),
    )

    consoleState.conversationsById[conversation.id] = {
      ...existing,
      ...conversation,
      ...runSummary,
    }

    consoleState.draftsByConversationId[conversation.id] ||= createEmptyDraft(conversation.id)
    consoleState.messagesByConversationId[conversation.id] ||= []
    consoleState.taskGroupsByConversationId[conversation.id] ||= []
  }

  async function loadConversationList() {
    if (conversationListLoadPromise)
      return conversationListLoadPromise

    const endLoadConversationList = createPerfTimer('agent-console:loadConversationList')
    conversationListLoadPromise = (async () => {
      try {
        const previousServerIds = new Set(conversationServerIds)
        const limit = Math.max(CONVERSATION_PAGE_SIZE, conversationServerIds.length)
        const conversations = await agentApi.conversationList({ limit, offset: 0 })
        const nextIds: string[] = []

        for (const item of conversations) {
          const conversation = mapHistoryConversation(item)
          nextIds.push(conversation.id)
          mergeConversation(conversation)
        }

        const conversationId = activeConversationId.value
        const localIdsToKeep = consoleState.conversationIds.filter((id) => {
          return !previousServerIds.has(id)
            && !nextIds.includes(id)
            && consoleState.conversationsById[id]
            && (id === conversationId || isLocalConversationId(id) || isConversationRunning(consoleState, id))
        })

        conversationServerIds = nextIds
        conversationListHasMore.value = conversations.length === limit
        consoleState.conversationIds = [...localIdsToKeep, ...conversationServerIds]

        if (conversationId)
          await loadConversationDetail(conversationId)
      }
      catch (error) {
        console.error('[agent-console] Failed to load conversation list:', error)
      }
      finally {
        conversationListLoadPromise = undefined
        endLoadConversationList({
          conversationCount: consoleState.conversationIds.length,
        })
      }
    })()

    return conversationListLoadPromise
  }

  async function loadMoreConversations() {
    if (conversationListLoadPromise)
      await conversationListLoadPromise
    if (!conversationListHasMore.value || conversationListMorePromise)
      return conversationListMorePromise

    conversationListLoadingMore.value = true
    conversationListMorePromise = (async () => {
      try {
        const conversations = await agentApi.conversationList({
          limit: CONVERSATION_PAGE_SIZE,
          offset: conversationServerIds.length,
        })
        const nextIds: string[] = []

        for (const item of conversations) {
          const conversation = mapHistoryConversation(item)
          nextIds.push(conversation.id)
          mergeConversation(conversation)
        }

        conversationServerIds = [
          ...conversationServerIds,
          ...nextIds.filter(id => !conversationServerIds.includes(id)),
        ]
        conversationListHasMore.value = conversations.length === CONVERSATION_PAGE_SIZE
        const localIds = consoleState.conversationIds.filter(id => !conversationServerIds.includes(id))
        consoleState.conversationIds = [...localIds, ...conversationServerIds]
      }
      catch (error) {
        console.error('[agent-console] Failed to load more conversations:', error)
      }
      finally {
        conversationListMorePromise = undefined
        conversationListLoadingMore.value = false
      }
    })()

    return conversationListMorePromise
  }

  async function loadConversationDetail(conversationId: string, force = false) {
    touchConversationCache(consoleState, conversationId)
    if (!force && loadedConversationDetails.has(conversationId))
      return
    if (loadingConversationDetails.has(conversationId))
      return

    const endLoadConversationDetail = createPerfTimer('agent-console:loadConversationDetail', {
      conversationId,
      force,
    })
    loadingConversationDetails.add(conversationId)

    try {
      const detail = await agentApi.conversationDetail(conversationId)
      const conversation = mapHistoryConversation(detail.conversation)
      mergeConversation(conversation)

      if (!consoleState.conversationIds.includes(conversation.id))
        consoleState.conversationIds.unshift(conversation.id)

      const terminalRuns: Array<{ runId: string, status: AgentRunStatus, error?: string }> = []
      for (const message of detail.messages) {
        if (message.role !== 'assistant' || !message.events?.length)
          continue
        if (locallyStoppedRuns.hasRun(message.events[0].runId))
          continue

        const stream = ensureConversationRunState(message.events[0])
        if (!replaceConversationRunEvents(stream, message.events))
          continue
        const terminal = message.events.map(terminalRunStatus).findLast(Boolean)
        if (terminal) {
          const failure = message.events.findLast(item => item.event.type === 'run_failed')
          terminalRuns.push({
            runId: stream.runId,
            status: terminal,
            error: failure?.event.type === 'run_failed' ? failure.event.data.message : undefined,
          })
        }
      }

      if (mergeHistoryMessages(consoleState, conversationId, mapHistoryMessages(detail)))
        loadedConversationDetails.add(conversationId)
      else
        loadedConversationDetails.delete(conversationId)

      for (const terminal of terminalRuns)
        setRunStatus(consoleState, terminal.runId, terminal.status, terminal.error)
    }
    catch (error) {
      console.error(`[agent-console] Failed to load conversation detail ${conversationId}:`, error)
    }
    finally {
      loadingConversationDetails.delete(conversationId)
      endLoadConversationDetail({
        loaded: loadedConversationDetails.has(conversationId),
      })
    }
  }

  function ensureConversationRunState(item: AgentConversationRunEventDTO) {
    const { conversationId, runId, assistantMessageId } = item
    const conversation = ensureConversation(consoleState, conversationId)!
    if (!consoleState.conversationIds.includes(conversationId))
      consoleState.conversationIds.unshift(conversationId)

    const startedAt = item.event.type === 'run_started'
      ? item.event.data.startedAt
      : item.timestamp
    const startedAtLabel = formatTime(startedAt)
    consoleState.runsById[runId] ||= {
      id: runId,
      conversationId,
      status: 'streaming',
      startedAt: startedAtLabel,
    }
    consoleState.streamsByRunId[runId] ||= {
      id: `stream-${runId}`,
      conversationId,
      runId,
      status: 'streaming',
      events: [],
      lastSequence: 0,
    }

    conversation.updatedAt = startedAtLabel
    conversation.latestRunId = runId
    conversation.latestRunStatus = 'streaming'
    if (!conversation.runningRunIds.includes(runId)) {
      conversation.runningRunIds.push(runId)
      // 运行中会话常驻内存：从 LRU 移除（普通 delete 不清理消息）
      recentConversationIds.delete(conversationId)
    }

    consoleState.messagesByConversationId[conversationId] ||= []
    if (!getAssistantMessage(conversationId, runId, assistantMessageId)) {
      consoleState.messagesByConversationId[conversationId].push({
        id: assistantMessageId,
        conversationId,
        runId,
        role: 'assistant',
        author: 'Roxy AI Agent',
        content: '',
        createdAt: '',
        status: 'streaming',
        process: {
          id: `pending-process-${assistantMessageId}`,
          completed: false,
          durationState: 'thinking',
          durationStartedAt: startedAt,
          collapsed: false,
          events: [],
        },
      })
    }

    return consoleState.streamsByRunId[runId]
  }

  function getAssistantMessage(conversationId: string, runId: string, assistantMessageId?: string): AgentMessage | undefined {
    return consoleState.messagesByConversationId[conversationId]?.find((item) => {
      if (assistantMessageId)
        return item.id === assistantMessageId

      return item.runId === runId && item.role === 'assistant'
    })
  }

  function refreshAssistantFromEvents(conversationId: string, runId: string, assistantMessageId: string, finalize = false) {
    const stream = consoleState.streamsByRunId[runId]
    if (!stream)
      return undefined

    const parsed = buildProcessFromEvents(assistantMessageId, stream.events, { finalize })
    const message = getAssistantMessage(conversationId, runId, assistantMessageId)

    if (message) {
      message.content = parsed.content
      message.process = parsed.process
      message.errorData = parsed.errorData
      message.status = finalize ? parsed.status : (parsed.status === 'error' ? 'error' : 'streaming')
      if (finalize)
        message.createdAt = parsed.completedAt
    }

    return parsed
  }

  function updateHitlFromEvent(conversationId: string, runId: string, data: Record<string, unknown> | undefined) {
    const request = createHitlRequestFromAgentEvent(conversationId, runId, data)
    if (!request)
      return

    consoleState.pendingHitlByConversationId[conversationId] = request
  }

  function clearHitlFromEvent(conversationId: string, approvalId?: string) {
    const request = consoleState.pendingHitlByConversationId[conversationId]
    if (!request)
      return

    if (!approvalId || approvalId === request.id)
      delete consoleState.pendingHitlByConversationId[conversationId]
  }

  function updateTodoProgress(conversationId: string, runId: string, data: unknown) {
    const progress = buildTodoProgress(conversationId, runId, data)
    if (!progress) {
      delete consoleState.todoProgressByRunId[runId]
      return
    }

    consoleState.todoProgressByRunId[runId] = progress
  }

  function eventAttachments(item: AgentConversationRunEventDTO): AgentAttachment[] {
    if (item.event.type !== 'user_message')
      return []
    return item.event.data.attachments.map(attachment => ({
      fileId: attachment.fileId,
      kind: 'file',
      fileName: attachment.fileName ?? attachment.fileId,
      mimeType: attachment.mimeType ?? 'application/octet-stream',
      size: attachment.size,
      url: attachment.url,
      localUrl: attachment.localUrl,
      remoteUrl: attachment.remoteUrl,
      fileUrl: attachment.fileUrl,
      uploadStatus: 'uploaded',
    }))
  }

  function upsertUserMessage(item: AgentConversationRunEventDTO): void {
    if (item.event.type !== 'user_message')
      return
    const { conversationId, runId, assistantMessageId } = item
    const pending = pendingRunPayloads.get(runId)
    const messages = consoleState.messagesByConversationId[conversationId] ||= []
    const next: AgentMessage = {
      id: item.event.data.messageId,
      conversationId,
      runId,
      role: 'user',
      author: 'You',
      content: item.event.data.content,
      attachments: pending?.attachments ?? eventAttachments(item),
      createdAt: formatTime(item.event.data.createdAt || item.timestamp),
      status: 'done',
    }
    const existingIndex = messages.findIndex(message => message.id === next.id)
    if (existingIndex >= 0) {
      messages[existingIndex] = next
    }
    else {
      const assistantIndex = messages.findIndex(message => message.id === assistantMessageId)
      messages.splice(assistantIndex >= 0 ? assistantIndex : messages.length, 0, next)
    }
    pendingRunPayloads.delete(runId)
  }

  async function recoverConversationRun(conversationId: string, runId: string): Promise<void> {
    if (recoveringRunIds.has(runId))
      return
    recoveringRunIds.add(runId)
    try {
      for (let attempt = 0; loadingConversationDetails.has(conversationId) && attempt < 100; attempt++)
        await new Promise(resolve => setTimeout(resolve, 20))
      await loadConversationDetail(conversationId, true)
    }
    finally {
      recoveringRunIds.delete(runId)
      const buffered = bufferedRunEvents.get(runId) ?? []
      bufferedRunEvents.delete(runId)
      for (const item of buffered.sort((a, b) => a.sequence - b.sequence))
        handleConversationRunEvent(item)
    }
  }

  function handleConversationRunEvent(item: AgentConversationRunEventDTO): void {
    const stoppedPending = locallyStoppedRuns.resolve(item)
    if (stoppedPending) {
      const stream = ensureConversationRunState(item)
      appendConversationRunEvent(stream, item)
      pendingRunPayloads.set(item.runId, stoppedPending)
      upsertUserMessage({
        ...item,
        event: {
          type: 'user_message',
          data: {
            messageId: item.turnId,
            content: stoppedPending.content,
            attachments: [],
            createdAt: item.timestamp,
          },
        },
      })
      finalizeCancelledRunMessage(item.conversationId, item.runId)
      setRunStatus(consoleState, item.runId, 'cancelled')
    }

    if (locallyStoppedRuns.hasRun(item.runId)) {
      if (terminalRunStatus(item)) {
        refreshPayInfoAfterAgentActivity()
        loadedConversationDetails.delete(item.conversationId)
        void loadConversationList()
      }
      return
    }

    if (recoveringRunIds.has(item.runId)) {
      const buffered = bufferedRunEvents.get(item.runId) ?? []
      buffered.push(item)
      bufferedRunEvents.set(item.runId, buffered)
      return
    }

    const stream = ensureConversationRunState(item)
    const appendResult = appendConversationRunEvent(stream, item)
    if (appendResult === 'duplicate')
      return
    if (appendResult === 'gap') {
      bufferedRunEvents.set(item.runId, [item])
      void recoverConversationRun(item.conversationId, item.runId)
      return
    }

    const { conversationId, runId, assistantMessageId } = item
    const event = item.event
    if (event.type === 'run_started') {
      const conversation = consoleState.conversationsById[conversationId]
      if (conversation)
        conversation.unread = false
      const pending = pendingRunStarts.acknowledge(conversationId, event.data.requestId)
      if (pending) {
        pendingRunPayloads.set(runId, pending)
        const conversation = consoleState.conversationsById[conversationId]
        if (conversation && (conversation.title === 'New conversation' || conversation.title === 'New Chat' || conversation.title === 'Loading conversation...'))
          conversation.title = createConversationTitle(pending.content)
      }
      pendingRunVersion.value++
      void loadConversationDetail(conversationId, true)
    }
    else if (event.type === 'user_message') {
      upsertUserMessage(item)
    }
    else if (event.type === 'title_changed') {
      const conversation = consoleState.conversationsById[conversationId]
      if (conversation && event.data.title.trim())
        conversation.title = event.data.title.trim()
    }
    else if (event.type === 'todo_delta') {
      updateTodoProgress(conversationId, runId, event.data.todos)
    }
    else if (event.type === 'approval_requested') {
      updateHitlFromEvent(conversationId, runId, {
        interruptsId: event.data.approvalId,
        actionRequests: event.data.actionRequests,
        reviewConfigs: event.data.reviewConfigs,
      })
    }
    else if (event.type === 'approval_resolved') {
      clearHitlFromEvent(conversationId, event.data.approvalId)
    }

    const terminal = terminalRunStatus(item)
    const parsed = refreshAssistantFromEvents(conversationId, runId, assistantMessageId, Boolean(terminal))
    if (!terminal)
      return

    if (terminal === 'cancelled')
      finalizeCancelledRunMessage(conversationId, runId)
    setRunStatus(
      consoleState,
      runId,
      terminal,
      event.type === 'run_failed' ? event.data.message : undefined,
      { markUnread: true },
    )
    if (parsed?.status === 'error') {
      const message = getAssistantMessage(conversationId, runId, assistantMessageId)
      if (message)
        message.status = 'error'
    }
    refreshPayInfoAfterAgentActivity()
    loadedConversationDetails.delete(conversationId)
    void loadConversationList()
  }

  function installConversationRunSubscriber(): void {
    if (conversationRunSubscriberInstalled)
      return
    conversationRunSubscriberInstalled = true
    agentChannel.subscribe((message: AgentChannelMessage) => {
      if (message.type === 'conversation.run.event') {
        handleConversationRunEvent(message.data)
        return
      }
      if (message.type === 'channel.ready') {
        refreshPayInfoAfterAgentActivity()
        loadedConversationDetails.clear()
        void loadConversationList()
      }
    })
  }

  installConversationRunSubscriber()

  function completeRun(conversationId: string, runId: string) {
    const message = consoleState.messagesByConversationId[conversationId]?.find(item => item.runId === runId && item.role === 'assistant')
    if (message)
      message.status = 'done'

    setRunStatus(consoleState, runId, 'completed', undefined, { markUnread: true })
  }

  function failRun(conversationId: string, runId: string, error: string) {
    const message = getAssistantMessage(conversationId, runId)
    if (message) {
      message.status = 'error'
      message.content = error
      message.errorData = error
    }

    setRunStatus(consoleState, runId, 'failed', error, { markUnread: true })
  }

  function formatStoppedDuration(ms: number) {
    if (ms < 1000)
      return `${$t('已停止')} 1s`

    const seconds = Math.round(ms / 1000)
    if (seconds < 60)
      return `${$t('已停止')} ${seconds}s`

    const minutes = Math.floor(seconds / 60)
    const restSeconds = seconds % 60
    return restSeconds > 0 ? `${$t('已停止')} ${minutes}m${restSeconds}s` : `${$t('已停止')} ${minutes}m`
  }

  function markProcessEventsStopped(events: AgentProcessEvent[]) {
    for (const event of events) {
      if (event.status === 'running' || event.status === 'pending')
        event.status = 'failed'

      if (event.type === 'parallel_dispatch')
        markProcessEventsStopped(event.tasks)

      if (event.type === 'worker_task')
        markProcessEventsStopped(event.events)
    }
  }

  function finalizeCancelledRunMessage(conversationId: string, runId: string) {
    const message = getAssistantMessage(conversationId, runId)
    if (!message)
      return

    message.status = 'done'
    message.createdAt ||= getCurrentDisplayTime()

    if (!message.process)
      return

    const endedAt = Date.now()
    const startedAt = message.process.durationStartedAt ?? endedAt
    message.process.durationEndedAt = endedAt
    message.process.durationLabel = formatStoppedDuration(Math.max(0, endedAt - startedAt))
    message.process.durationState = undefined
    message.process.completed = false
    message.process.collapsed = false
    markProcessEventsStopped(message.process.events)
  }

  function cancelRun(runId: string) {
    const run = consoleState.runsById[runId]
    if (!run)
      return

    const requestId = agentChannel.send('conversation.run.stop', { conversationId: run.conversationId })
    if (!requestId) {
      onlyErrorToast(-1, $t('Agent 连接尚未就绪'))
      return
    }

    locallyStoppedRuns.addRun(runId)
    bufferedRunEvents.delete(runId)
    recoveringRunIds.delete(runId)
    finalizeCancelledRunMessage(run.conversationId, runId)
    setRunStatus(consoleState, runId, 'cancelled')
    loadedConversationDetails.delete(run.conversationId)
  }

  function cancelActiveRun() {
    const conversation = activeConversation.value
    if (!conversation)
      return

    if (pendingRunStarts.has(conversation.id)) {
      const requestId = agentChannel.send('conversation.run.stop', { conversationId: conversation.id })
      if (!requestId) {
        onlyErrorToast(-1, $t('Agent 连接尚未就绪'))
        return
      }

      const pending = pendingRunStarts.acknowledge(conversation.id)
      if (pending) {
        locallyStoppedRuns.addPending(conversation.id, pending.requestId, pending)
      }
      pendingRunVersion.value++
      return
    }

    for (let index = conversation.runningRunIds.length - 1; index >= 0; index--) {
      const runId = conversation.runningRunIds[index]
      const run = consoleState.runsById[runId]
      if (!run || isRunActive(run.status)) {
        cancelRun(runId)
        return
      }
    }
  }

  async function deleteConversation(conversationId: string) {
    const conversation = consoleState.conversationsById[conversationId]
    if (!conversation)
      return

    if (isConversationRunning(consoleState, conversationId)) {
      onlyErrorToast(-1, $t('任务进行中，请先停止再删除'))
      return
    }

    try {
      await agentApi.deleteConversation(conversationId)
      removeConversation(consoleState, conversationId)
      showToast(0, $t('对话已删除'))

      if (activeConversationId.value === conversationId) {
        const nextConversationId = consoleState.conversationIds[0]
        if (nextConversationId)
          await routeToConversation(nextConversationId)
        else
          await router.push({ name: 'agent-console-chat', query: route.query })
      }
    }
    catch (error) {
      console.error('[agent-console] Failed to delete conversation:', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('删除对话失败'))
    }
  }

  async function renameConversation(conversationId: string, title: string) {
    const conversation = consoleState.conversationsById[conversationId]
    const normalizedTitle = title.trim()
    if (!conversation || !normalizedTitle)
      return false
    if (normalizedTitle === conversation.title)
      return true

    try {
      const updatedConversation = mapHistoryConversation(
        await agentApi.updateConversation(conversationId, normalizedTitle),
      )
      mergeConversation(updatedConversation)
      return true
    }
    catch (error) {
      console.error('[agent-console] Failed to rename conversation:', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('重命名失败'))
      return false
    }
  }

  async function submitHitl(payload: AgentHitlSubmitPayload) {
    const conversationId = activeConversationId.value
    const request = conversationId ? consoleState.pendingHitlByConversationId[conversationId] : undefined
    if (!conversationId || !request || request.id !== payload.requestId)
      return

    request.status = 'submitting'

    try {
      const commandId = agentChannel.send('conversation.approval.submit', {
        conversationId,
        approvalId: request.id,
        decisions: createLegacyResumeDecisions(request, payload),
      })
      if (!commandId)
        throw new Error('Agent WebSocket is not ready')
    }
    catch (error) {
      request.status = 'error'
      console.error('[agent-console] Failed to submit HITL decision:', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('提交审批失败'))
    }
  }

  function addPendingAttachments(files: File[]) {
    if (!files.length || isThinking.value)
      return

    const nextAttachments = files.map(file => createLocalAttachment(file))
    if (!nextAttachments.length)
      return

    const conversationId = activeConversationId.value
    if (!conversationId) {
      homePendingAttachments.value = [...homePendingAttachments.value, ...nextAttachments]
      return
    }

    consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
    consoleState.draftsByConversationId[conversationId].attachments.push(...nextAttachments)
  }

  function addPendingFolder(folder: AgentFolderSelection) {
    if (isThinking.value)
      return

    const nextAttachment = createLocalFolderAttachment(folder)
    const conversationId = activeConversationId.value
    if (!conversationId) {
      homePendingAttachments.value = [...homePendingAttachments.value, nextAttachment]
      return
    }

    consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
    consoleState.draftsByConversationId[conversationId].attachments.push(nextAttachment)
  }

  function addPendingPathAttachment(selection: AgentPathSelection) {
    if (isThinking.value)
      return

    const nextAttachment = createLocalPathAttachment(selection)
    const conversationId = activeConversationId.value
    if (!conversationId) {
      homePendingAttachments.value = [...homePendingAttachments.value, nextAttachment]
      return
    }

    consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
    consoleState.draftsByConversationId[conversationId].attachments.push(nextAttachment)
  }

  function removePendingAttachment(fileId: string) {
    const attachments = pendingAttachments.value
    const index = attachments.findIndex(attachment => attachment.fileId === fileId)
    if (index < 0)
      return

    const [attachment] = attachments.splice(index, 1)
    revokeAttachments(attachment ? [attachment] : [])
  }

  function clearPendingAttachments(conversationId?: string) {
    if (!conversationId) {
      revokeAttachments(homePendingAttachments.value)
      homePendingAttachments.value = []
      return
    }

    const draft = consoleState.draftsByConversationId[conversationId]
    if (!draft)
      return

    revokeAttachments(draft.attachments)
    draft.attachments = []
  }

  async function uploadPendingAttachmentsForConversation(conversationId: string) {
    const attachments = pendingAttachments.value.slice()
    const uploadedAttachments: AgentAttachment[] = []

    for (const attachment of attachments) {
      if (attachment.localPath) {
        uploadedAttachments.push({
          ...attachment,
          localFiles: undefined,
          uploadStatus: 'uploaded',
        })
        continue
      }

      if (attachment.kind === 'folder' && attachment.localFiles?.length) {
        const latest = pendingAttachments.value.find(item => item.fileId === attachment.fileId)
        if (latest)
          latest.uploadStatus = 'uploading'

        try {
          const uploadedFiles: AgentAttachment[] = []
          for (const file of attachment.localFiles) {
            const base64 = await agentApi.fileToBase64(file)
            const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
            const uploaded = await agentApi.uploadFile(base64, file.type || 'application/octet-stream', relativePath || file.name, conversationId)
            uploadedFiles.push({
              fileId: uploaded.fileId,
              kind: 'file',
              fileName: uploaded.fileName,
              mimeType: uploaded.mimeType,
              size: uploaded.size,
              url: agentApi.getFileUrl(uploaded.fileId, { fileName: uploaded.fileName }),
              localUrl: uploaded.localUrl || uploaded.url || agentApi.getFileUrl(uploaded.fileId),
              remoteUrl: uploaded.remoteUrl || uploaded.fileUrl,
              fileUrl: uploaded.fileUrl || uploaded.remoteUrl,
              uploadStatus: 'uploaded',
            })
          }

          uploadedAttachments.push({
            ...attachment,
            localFiles: undefined,
            uploadStatus: 'uploaded',
          })
          uploadedAttachments.push(...uploadedFiles)

          const latestIndex = pendingAttachments.value.findIndex(item => item.fileId === attachment.fileId)
          if (latestIndex >= 0) {
            pendingAttachments.value[latestIndex] = {
              ...attachment,
              localFiles: undefined,
              uploadStatus: 'uploaded',
            }
          }
        }
        catch (error) {
          const failed = pendingAttachments.value.find(item => item.fileId === attachment.fileId)
          if (failed)
            failed.uploadStatus = 'error'
          throw error
        }
        continue
      }

      if (!attachment.localFile) {
        uploadedAttachments.push(attachment)
        continue
      }

      const latest = pendingAttachments.value.find(item => item.fileId === attachment.fileId)
      if (latest)
        latest.uploadStatus = 'uploading'

      try {
        const base64 = await agentApi.fileToBase64(attachment.localFile)
        const uploaded = await agentApi.uploadFile(base64, attachment.mimeType, attachment.fileName, conversationId)
        const uploadedAttachment: AgentAttachment = {
          ...attachment,
          fileId: uploaded.fileId,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          size: uploaded.size,
          url: agentApi.getFileUrl(uploaded.fileId, { fileName: uploaded.fileName }),
          localUrl: uploaded.localUrl || uploaded.url || agentApi.getFileUrl(uploaded.fileId),
          remoteUrl: uploaded.remoteUrl || uploaded.fileUrl,
          fileUrl: uploaded.fileUrl || uploaded.remoteUrl,
          preview: undefined,
          localFile: undefined,
          uploadStatus: 'uploaded',
        }
        uploadedAttachments.push(uploadedAttachment)
        revokeAttachments([attachment])

        const latestIndex = pendingAttachments.value.findIndex(item => item.fileId === attachment.fileId)
        if (latestIndex >= 0)
          pendingAttachments.value[latestIndex] = uploadedAttachment
      }
      catch (error) {
        const failed = pendingAttachments.value.find(item => item.fileId === attachment.fileId)
        if (failed)
          failed.uploadStatus = 'error'
        throw error
      }
    }

    return uploadedAttachments
  }

  function appendLocalPathContext(content: string, attachments: AgentAttachment[]) {
    const localPathAttachments = attachments.filter(attachment => attachment.localPath)
    if (!localPathAttachments.length)
      return content

    const pathLines = localPathAttachments.map((attachment) => {
      const params = { name: attachment.fileName, path: attachment.localPath }
      return attachment.kind === 'folder'
        ? $t('[目录] 名称: {name}, 本地路径: {path}', params)
        : $t('[文件] 名称: {name}, 本地路径: {path}', params)
    })
    return [content, pathLines.join('\n')].filter(Boolean).join('\n\n')
  }

  async function sendPrompt() {
    let conversationId = activeConversationId.value
    const content = prompt.value.trim()
    if ((!content && pendingAttachments.value.length === 0) || hasPendingAttachmentUploads.value)
      return

    if (conversationId && (isConversationRunning(consoleState, conversationId) || pendingRunStarts.has(conversationId)))
      return

    if (!conversationId) {
      const conversation = mapHistoryConversation(await agentApi.createConversation())
      mergeConversation(conversation)
      if (!consoleState.conversationIds.includes(conversation.id))
        consoleState.conversationIds.unshift(conversation.id)
      loadedConversationDetails.add(conversation.id)

      conversationId = conversation.id
      consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
      consoleState.draftsByConversationId[conversationId].prompt = content
      consoleState.draftsByConversationId[conversationId].attachments = homePendingAttachments.value
      homePendingAttachments.value = []
      homePrompt.value = ''
      await routeToConversation(conversationId)
    }

    let uploadedAttachments: AgentAttachment[] = []
    try {
      uploadedAttachments = await uploadPendingAttachmentsForConversation(conversationId)
    }
    catch (error) {
      console.error('[agent-console] Failed to upload attachments:', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('文件上传失败'))
      return
    }

    const outgoingContent = appendLocalPathContext(content, uploadedAttachments)
    const displayAttachments = uploadedAttachments.filter((attachment) => {
      if (attachment.kind === 'folder')
        return true

      return !attachment.fileName.includes('/')
    })
    const chatAttachments = uploadedAttachments.filter(attachment => attachment.kind === 'file' && !attachment.localPath)
    const requestId = agentChannel.send('conversation.run.start', {
      conversationId,
      message: outgoingContent,
      attachments: chatAttachments.map(attachment => ({ fileId: attachment.fileId })),
      fullAccess: fullAccess.value,
    })
    if (!requestId) {
      onlyErrorToast(-1, $t('Agent 连接尚未就绪'))
      return
    }

    const pending: PendingRunStart = {
      requestId,
      content: outgoingContent,
      draftContent: content,
      attachments: displayAttachments,
    }
    pendingRunStarts.begin(
      conversationId,
      requestId,
      pending,
      PENDING_RUN_START_TIMEOUT_MS,
      (expired) => {
        const draft = consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
        if (!draft.prompt)
          draft.prompt = expired.draftContent
        if (draft.attachments.length === 0)
          draft.attachments = expired.attachments
        pendingRunVersion.value++
      },
    )
    pendingRunVersion.value++
    const draft = consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
    draft.prompt = ''
    draft.attachments = []
  }

  return {
    activeConversation,
    activeConversationId,
    activeHitlRequest,
    activeTodoProgress,
    addPendingAttachments,
    addPendingFolder,
    addPendingPathAttachment,
    cancelActiveRun,
    cancelRun,
    completeRun,
    conversationList,
    conversationListHasMore,
    conversationListLoadingMore,
    deleteConversation,
    failRun,
    isThinking,
    loadMoreConversations,
    messageList,
    pendingAttachments,
    pendingApprovalConversationIds,
    prompt,
    removePendingAttachment,
    renameConversation,
    runningTaskCount,
    selectConversation,
    sendPrompt,
    startNewChat,
    submitHitl,
    state: consoleState,
    taskGroupList,
    taskMonitorConnected: taskMonitor.connected,
    toggleTaskGroup,
  }
}
