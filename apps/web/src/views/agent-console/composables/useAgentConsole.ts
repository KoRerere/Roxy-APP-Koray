import type { AgentAttachment, AgentConsoleState, AgentConversation, AgentFolderSelection, AgentHitlSubmitPayload, AgentMessage, AgentPathSelection, AgentProcessEvent, AgentQueuedPrompt, AgentRunStatus, AgentTodoItem, AgentTodoItemStatus, AgentTodoProgress } from '../types'
import type { AgentChannelMessage, AgentConversationRunEventDTO } from '@roxy/shared/channel'
import type { TaskReportTemplateContext } from '@roxy/shared'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { collectTaskConversationIds } from '../agent-channel-state'
import type { AgentConsoleConversationDetailDTO } from '../api'
import { useAgentConsoleApi } from '../api'
import type { ConversationReadTarget } from '../conversation-unread-state'
import { getConversationReadTarget } from '../conversation-unread-state'
import type { PendingRunPresentation } from '../conversation-run-state'
import { appendConversationRunEvent, appendConversationRunPresentationEvents, appendOrderedConversationRunEvents, createPendingRunMessages, LocallyStoppedConversationRunRegistry, PendingConversationRunRegistry, reconcileConversationRunMessages, reconcileConversationRunSummary, replaceConversationRunEvents, shouldPinConversationMessageCache, shouldRequestConversationDetail, terminalRunStatus } from '../conversation-run-state'
import { createHitlRequestFromAgentEvent, createLegacyResumeDecisions } from '../hitlAdapter'
import { resolveHitlActionTitles } from '../hitlResourcePresentation'
import { buildProcessFromEvents, formatDuration, formatTime, mapHistoryConversation, mapHistoryMessages } from '../historyAdapter'
import { IncrementalProcessUpdater } from '../incrementalProcess'
import { resolveScriptRunPresentationEvents } from '../scriptRunPresentation'
import { createIdleAwareStreamTextEventBufferScheduler, StreamTextEventBuffer } from '../streamTextEventBuffer'
import { createQueuedPrompt, reorderQueuedPrompt as movePromptInQueue, removeQueuedPrompt as removePromptFromQueue } from '../prompt-queue'
import { collectLocalPathAttachments } from '../local-path-context'
import { reconcilePendingAttachments } from '../attachment-reconciliation'
import {
  AI_BATCH_CREATE_PROMPT_QUERY_KEY,
  AI_BATCH_CREATE_TEMPLATE_SLUG,
  isAiBatchCreatePromptRequest,
  pickAiBatchCreatePrompt,
} from '../batch-create-prefill'
import { requestAiBatchCreateGuide } from '../batch-create-guide'
import {
  buildCreateAutomationPromptAfterWindowLoad,
  CREATE_AUTOMATION_QUERY_KEY,
  CREATE_AUTOMATION_WINDOW_IDS_QUERY_KEY,
  isCreateAutomationRequest,
  parseCreateAutomationWindowIds,
} from '../create-automation-prefill'
import { requestCreateAutomationGuide } from '../create-automation-guide'
import { readHomeTemplateCache } from '../home-template-cache'
import { cacheAgentProfileLabels } from '../profile-token-display'
import { fetchTaskWindowOptionsByDirIds } from '../task-window-options'
import { readCatalogList } from '../template-store'
import type { OfficialTemplate } from '../template-store'
import { useAgentAccessMode } from './useAgentAccessMode'
import { useAgentChannelState } from './useAgentChannel'
import { useProfileMonitor } from './useProfileMonitor'
import { createPerfTimer, perfLog } from '/@/utils/perf-log'
import { useSimpleLocale } from '/@/stores/locale'

let state: AgentConsoleState | undefined
const homePrompt = ref('')
const homePendingAttachments = ref<AgentAttachment[]>([])
const homePendingMessages = ref<AgentMessage[]>([])
const homeQueuedPrompts = ref<AgentQueuedPrompt[]>([])
let homeRunPreparationToken: string | undefined

const CONVERSATION_PAGE_SIZE = 10
const CONVERSATION_MESSAGE_PAGE_SIZE = 5
const STREAM_TEXT_BUFFER_TTL_MS = 50
const ASSISTANT_REFRESH_INTERVAL_MS = 50

const loadingConversationDetails = new Set<string>()
const refreshingServerTerminalRuns = new Set<string>()
const bufferedRunEvents = new Map<string, AgentConversationRunEventDTO[]>()
let conversationListLoadPromise: Promise<void> | undefined
let conversationListMorePromise: Promise<void> | undefined
let conversationServerIds: string[] = []
const conversationListHasMore = ref(true)
const conversationListLoadingMore = ref(false)
let conversationRunSubscriberInstalled = false

interface ConversationMessagePaginationState {
  hasMore: boolean
  loading: boolean
  nextCursor: string | null
}

const conversationMessagePaginationById = reactive<Record<string, ConversationMessagePaginationState>>({})
const pendingAttachmentUploadPromises = new Map<string, Promise<AgentAttachment[]>>()

interface PendingRunDraft extends PendingRunPresentation {
  content: string
  draftContent: string
  attachments: AgentAttachment[]
}

interface PendingRunStart extends PendingRunDraft {
  onRunStarted?: (run: { conversationId: string, runId: string }) => void
  requestId: string
}

interface SendPromptOptions {
  attachments?: AgentAttachment[]
  content?: string
  conversationId?: string
  fromQueue?: boolean
  onRunStarted?: (run: { conversationId: string, runId: string }) => void
  templateContext?: TaskReportTemplateContext
}

const PENDING_RUN_START_TIMEOUT_MS = 15_000
const pendingRunStarts = new PendingConversationRunRegistry<PendingRunStart>()
const pendingRunPayloads = new Map<string, PendingRunStart>()
const preparingRunStarts = new Map<string, PendingRunDraft>()
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
    queuedPromptsByConversationId: {},
    messagesByConversationId: {},
    runsById: {},
    streamsByRunId: {},
    todoProgressByRunId: {},
    taskGroupsByConversationId: {},
    pendingHitlByConversationId: {},
  }
}

function getRouteConversationId(value: unknown) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return typeof value === 'string' ? value : undefined
}

function createConversationTitle(prompt?: string) {
  const normalized = prompt?.trim()
  if (!normalized) {
    return 'New conversation'
  }

  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized
}

function getCurrentDisplayTime() {
  return formatTime(Date.now())
}

function createConversation(
  consoleState: AgentConsoleState,
  title = 'New conversation',
  conversationId?: string,
  initializeMessageCache = true,
) {
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
  consoleState.queuedPromptsByConversationId[id] = []
  if (initializeMessageCache) {
    consoleState.messagesByConversationId[id] = []
  }
  consoleState.taskGroupsByConversationId[id] = []

  return conversation
}

function ensureConversation(consoleState: AgentConsoleState, conversationId?: string) {
  if (!conversationId) {
    return undefined
  }

  return consoleState.conversationsById[conversationId]
    ?? createConversation(consoleState, 'Loading conversation...', conversationId, false)
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
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      run.completedAt = getCurrentDisplayTime()
    }
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
      if (conversation.runningRunIds.length === 0) {
        touchConversationCache(consoleState, run.conversationId)
      }
      if (options.markUnread) {
        conversation.unread = true
      }
    }
    delete consoleState.todoProgressByRunId[runId]
    delete consoleState.pendingHitlByConversationId[run.conversationId]
  }
}

function isRunActive(status?: AgentRunStatus) {
  return status === 'queued' || status === 'streaming'
}

function isTerminalRunStatus(
  status?: AgentRunStatus,
): status is Extract<AgentRunStatus, 'completed' | 'failed' | 'cancelled'> {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

function isConversationRunning(consoleState: AgentConsoleState, conversationId: string) {
  const conversation = consoleState.conversationsById[conversationId]
  if (!conversation) {
    return false
  }

  return conversation.runningRunIds.some((runId) => {
    const run = consoleState.runsById[runId]
    return !run || isRunActive(run.status)
  })
}

// 非运行中会话的消息缓存 LRU 上限。运行中会话常驻内存，不参与淘汰。
const MESSAGE_CACHE_LIMIT = 3
// Map 保持插入顺序：delete 后重新 set 即把会话移到"最近使用"位置。
const recentConversationIds = new Map<string, true>()

function isConversationCachePinned(consoleState: AgentConsoleState, conversationId: string): boolean {
  const hasRunningAssistantMessage = consoleState.messagesByConversationId[conversationId]?.some((message) => {
    return message.role === 'assistant'
      && (message.status === 'thinking' || message.status === 'streaming')
  }) ?? false

  return shouldPinConversationMessageCache({
    hasActiveRun: isConversationRunning(consoleState, conversationId),
    hasPendingRun: pendingRunStarts.has(conversationId),
    hasPreparingRun: preparingRunStarts.has(conversationId),
    hasRunningMessage: hasRunningAssistantMessage,
    hasStoppedPendingRun: locallyStoppedRuns.hasPending(conversationId),
  })
}

function pinConversationCache(conversationId: string): void {
  recentConversationIds.delete(conversationId)
}

function evictConversationMessages(consoleState: AgentConsoleState, conversationId: string): void {
  if (isConversationCachePinned(consoleState, conversationId)) {
    pinConversationCache(conversationId)
    return
  }

  delete consoleState.messagesByConversationId[conversationId]
  delete conversationMessagePaginationById[conversationId]
}

/**
 * 将会话标记为最近使用并纳入 LRU 管理；超出上限时淘汰最久未用的非运行中会话消息。
 * preparing、pending 和运行中会话常驻内存，不进入 LRU。
 */
function touchConversationCache(consoleState: AgentConsoleState, conversationId: string) {
  if (isConversationCachePinned(consoleState, conversationId)) {
    pinConversationCache(conversationId)
    return
  }

  recentConversationIds.delete(conversationId)
  recentConversationIds.set(conversationId, true)

  while (recentConversationIds.size > MESSAGE_CACHE_LIMIT) {
    const oldest = recentConversationIds.keys().next().value
    if (oldest === undefined) {
      break
    }

    recentConversationIds.delete(oldest)
    evictConversationMessages(consoleState, oldest)
  }
}

function isLocalConversationId(id: string) {
  return id.startsWith('conv-')
}

function removeConversation(consoleState: AgentConsoleState, conversationId: string) {
  conversationServerIds = conversationServerIds.filter(id => id !== conversationId)
  revokeAttachments(consoleState.draftsByConversationId[conversationId]?.attachments)
  consoleState.conversationIds = consoleState.conversationIds.filter(id => id !== conversationId)
  delete consoleState.conversationsById[conversationId]
  delete consoleState.draftsByConversationId[conversationId]
  delete consoleState.queuedPromptsByConversationId[conversationId]
  delete consoleState.messagesByConversationId[conversationId]
  delete conversationMessagePaginationById[conversationId]
  delete consoleState.taskGroupsByConversationId[conversationId]
  delete consoleState.pendingHitlByConversationId[conversationId]
  loadingConversationDetails.delete(conversationId)
  recentConversationIds.delete(conversationId)

  const conversationRunIds = Object.values(consoleState.runsById)
    .filter(run => run.conversationId === conversationId)
    .map(run => run.id)
  locallyStoppedRuns.removeConversation(conversationId, conversationRunIds)

  for (const runId of Object.keys(consoleState.runsById)) {
    if (consoleState.runsById[runId]?.conversationId !== conversationId) {
      continue
    }

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
    if (attachment.preview) {
      URL.revokeObjectURL(attachment.preview)
    }
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
  if (fallback && fallback !== 'application/octet-stream') {
    return fallback
  }

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
    uploadStatus: 'uploading',
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
    uploadStatus: folder.path ? 'uploaded' : 'uploading',
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
    uploadStatus: 'uploaded',
  }
}

function normalizeTodoStatus(value: unknown): AgentTodoItemStatus {
  if (value === 'in_progress' || value === 'completed') {
    return value
  }

  return 'pending'
}

function getTodoSource(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data
  }

  if (data && typeof data === 'object') {
    const todos = (data as { todos?: unknown }).todos
    if (Array.isArray(todos)) {
      return todos
    }
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

  if (!todos.length) {
    return undefined
  }

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
  const workspaceStore = useWorkspaceStore()
  const localeStore = useSimpleLocale()
  const { fullAccess } = useAgentAccessMode()
  const [showToast, onlyErrorToast] = useResponseToast()
  const agentChannel = useAgentChannelState()
  const profileMonitor = useProfileMonitor()
  const route = useRoute()
  const router = useRouter()
  perfLog('agent-console:useAgentConsole:start')
  const queuedAssistantRefreshes = new Map<string, {
    assistantMessageId: string
    conversationId: string
  }>()
  const releasedRunEvents = new Map<string, AgentConversationRunEventDTO[]>()
  const presentationEventQueues = new Map<string, AgentConversationRunEventDTO[]>()
  const processUpdatersByRunId = new Map<string, IncrementalProcessUpdater>()
  const drainingPresentationRuns = new Set<string>()
  let assistantRefreshTimer: number | undefined

  onBeforeUnmount(() => {
    if (assistantRefreshTimer !== undefined) {
      window.clearTimeout(assistantRefreshTimer)
    }
    queuedAssistantRefreshes.clear()
    processUpdatersByRunId.clear()
  })

  let aiBatchCreatePromptRequestId = 0
  let createAutomationPromptRequestId = 0

  async function consumeAiBatchCreatePrompt() {
    const requestId = ++aiBatchCreatePromptRequestId
    homePrompt.value = ''
    revokeAttachments(homePendingAttachments.value)
    homePendingAttachments.value = []

    try {
      const response = await agentApi.templates.listOfficialTemplates({
        limit: 20,
        search: AI_BATCH_CREATE_TEMPLATE_SLUG,
        templateType: 'prompt',
      })
      const templates = readCatalogList<OfficialTemplate>(response, $t('加载官方模板失败'))
      const prompt = pickAiBatchCreatePrompt(templates, localeStore.currentLocale)
      if (!prompt) {
        throw new Error($t('未找到批量创建窗口模板'))
      }

      if (requestId === aiBatchCreatePromptRequestId && route.name === 'agent-console-chat') {
        homePrompt.value = prompt
      }
    }
    catch (error) {
      const cachedPrompt = pickAiBatchCreatePrompt(
        readHomeTemplateCache()?.templates ?? [],
        localeStore.currentLocale,
      )
      if (requestId === aiBatchCreatePromptRequestId && route.name === 'agent-console-chat') {
        if (cachedPrompt) {
          homePrompt.value = cachedPrompt
        }
        else {
          console.error('[agent-console] Failed to load the batch profile creation template:', error)
          onlyErrorToast(-1, error instanceof Error ? error.message : $t('加载官方模板失败'))
        }
      }
    }
    finally {
      if (requestId === aiBatchCreatePromptRequestId && route.name === 'agent-console-chat') {
        const query = { ...route.query }
        delete query[AI_BATCH_CREATE_PROMPT_QUERY_KEY]
        void router.replace({ name: 'agent-console-chat', query })
      }
    }
  }

  async function consumeCreateAutomationPrompt() {
    const requestId = ++createAutomationPromptRequestId
    const windowIds = parseCreateAutomationWindowIds(
      route.query[CREATE_AUTOMATION_WINDOW_IDS_QUERY_KEY],
    )
    homePrompt.value = ''
    revokeAttachments(homePendingAttachments.value)
    homePendingAttachments.value = []

    try {
      const prompt = await buildCreateAutomationPromptAfterWindowLoad(
        windowIds,
        async (selectedWindowIds) => {
          const windows = await fetchTaskWindowOptionsByDirIds(
            selectedWindowIds,
            workspaceStore.currentWorkspace?.workspaceName,
          )
          cacheAgentProfileLabels(windows.map(window => ({
            id: window.id,
            label: window.code || window.name || window.id,
          })))
        },
        profileReference => $t('在 {profile} 窗口中运行', { profile: profileReference }),
      )

      if (requestId === createAutomationPromptRequestId && route.name === 'agent-console-chat') {
        homePrompt.value = prompt
      }
    }
    catch (error) {
      if (requestId === createAutomationPromptRequestId && route.name === 'agent-console-chat') {
        console.error('[agent-console] Failed to load windows for automation prefill:', error)
        onlyErrorToast(-1, error instanceof Error ? error.message : $t('获取窗口信息失败'))
      }
    }
    finally {
      if (requestId === createAutomationPromptRequestId && route.name === 'agent-console-chat') {
        const query = { ...route.query }
        delete query[CREATE_AUTOMATION_QUERY_KEY]
        delete query[CREATE_AUTOMATION_WINDOW_IDS_QUERY_KEY]
        void router.replace({ name: 'agent-console-chat', query })
      }
    }
  }

  watch(
    () => [
      route.name,
      route.query[AI_BATCH_CREATE_PROMPT_QUERY_KEY],
      route.query[CREATE_AUTOMATION_WINDOW_IDS_QUERY_KEY],
    ] as const,
    ([routeName, prefill]) => {
      if (routeName !== 'agent-console-chat') {
        return
      }

      if (isAiBatchCreatePromptRequest(prefill)) {
        requestAiBatchCreateGuide()
        void consumeAiBatchCreatePrompt()
      }
      else if (isCreateAutomationRequest(prefill)) {
        requestCreateAutomationGuide()
        void consumeCreateAutomationPrompt()
      }
    },
    { immediate: true },
  )

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
        if (conversationId) {
          void loadConversationDetail(conversationId)
        }
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
          void loadConversationList()
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
    if (conversationId && consoleState.conversationsById[conversationId]) {
      return conversationId
    }

    return undefined
  })

  const activeConversation = computed(() => {
    const conversationId = activeConversationId.value
    return conversationId ? consoleState.conversationsById[conversationId] : undefined
  })

  const markingConversationReadKeys = new Set<string>()

  async function markConversationRead(target: ConversationReadTarget) {
    const key = `${target.conversationId}:${target.runId}`
    if (markingConversationReadKeys.has(key)) {
      return
    }

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
      if (target) {
        void markConversationRead(target)
      }
    },
    { immediate: true },
  )

  const conversationList = computed(() => consoleState.conversationIds.map(id => consoleState.conversationsById[id]).filter(Boolean))

  const messageList = computed(() => {
    const conversationId = activeConversationId.value
    return conversationId ? consoleState.messagesByConversationId[conversationId] ?? [] : homePendingMessages.value
  })

  const messageHistoryHasMore = computed(() => {
    const conversationId = activeConversationId.value
    return conversationId
      ? conversationMessagePaginationById[conversationId]?.hasMore === true
      : false
  })

  const messageHistoryLoading = computed(() => {
    const conversationId = activeConversationId.value
    return conversationId
      ? conversationMessagePaginationById[conversationId]?.loading === true
      : false
  })

  const taskGroupList = profileMonitor.taskGroupList

  const activeHitlRequest = computed(() => {
    const conversationId = activeConversationId.value
    return conversationId ? consoleState.pendingHitlByConversationId[conversationId] : undefined
  })
  const pendingApprovalConversationIds = computed(() => Object.keys(consoleState.pendingHitlByConversationId))

  const activeTodoProgress = computed(() => {
    const conversation = activeConversation.value
    if (!conversation) {
      return undefined
    }

    for (let index = conversation.runningRunIds.length - 1; index >= 0; index--) {
      const runId = conversation.runningRunIds[index]
      const run = consoleState.runsById[runId]
      const progress = consoleState.todoProgressByRunId[runId]
      if (progress && (run?.status === 'queued' || run?.status === 'streaming')) {
        return progress
      }
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

  const queuedPrompts = computed(() => {
    const conversationId = activeConversationId.value
    if (!conversationId) {
      return homeQueuedPrompts.value
    }

    return consoleState.queuedPromptsByConversationId[conversationId] ||= []
  })

  const drainingPromptQueues = new Set<string>()

  function getPromptQueue(conversationId?: string) {
    if (!conversationId) {
      return homeQueuedPrompts.value
    }

    return consoleState.queuedPromptsByConversationId[conversationId] ||= []
  }

  function enqueuePrompt(
    conversationId: string | undefined,
    content: string,
    options: { attachments?: AgentAttachment[], draftContent?: string } = {},
  ) {
    const normalized = content.trim()
    if (!normalized && !options.attachments?.length) {
      return
    }

    getPromptQueue(conversationId).push(createQueuedPrompt(
      conversationId ?? 'home',
      normalized,
      Date.now(),
      options,
    ))
  }

  function removeQueuedPrompt(promptId: string) {
    const item = removePromptFromQueue(queuedPrompts.value, promptId)
    revokeAttachments(item?.attachments)
  }

  function reorderQueuedPrompt(payload: { promptId: string, targetIndex: number }) {
    movePromptInQueue(queuedPrompts.value, payload.promptId, payload.targetIndex)
  }

  function restoreQueuedPrompt(promptId: string) {
    const item = removePromptFromQueue(queuedPrompts.value, promptId)
    if (item) {
      prompt.value = item.draftContent ?? item.content
      if (item.attachments?.length) {
        const conversationId = activeConversationId.value
        if (!conversationId) {
          homePendingAttachments.value = [...homePendingAttachments.value, ...item.attachments]
        }
        else {
          const draft = consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
          draft.attachments.push(...item.attachments)
        }
      }
    }
  }

  function isConversationStarting(conversationId: string) {
    return isConversationRunning(consoleState, conversationId)
      || pendingRunStarts.has(conversationId)
      || preparingRunStarts.has(conversationId)
  }

  function schedulePromptQueueDrain(conversationId?: string) {
    const queueKey = conversationId ?? 'home'
    queueMicrotask(() => void drainPromptQueue(conversationId, queueKey))
  }

  async function drainPromptQueue(conversationId: string | undefined, queueKey: string) {
    if (drainingPromptQueues.has(queueKey)) {
      return
    }

    if (conversationId ? isConversationStarting(conversationId) : Boolean(homeRunPreparationToken)) {
      return
    }

    const queue = getPromptQueue(conversationId)
    const item = queue[0]
    if (!item) {
      return
    }

    drainingPromptQueues.add(queueKey)
    try {
      const started = await sendPrompt({
        attachments: item.attachments ?? [],
        content: item.content,
        conversationId,
        fromQueue: true,
      })
      if (started) {
        removePromptFromQueue(queue, item.id)
      }
    }
    finally {
      drainingPromptQueues.delete(queueKey)
    }
  }

  const pendingAttachments = computed(() => {
    const conversationId = activeConversationId.value
    if (!conversationId) {
      return homePendingAttachments.value
    }

    consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
    return consoleState.draftsByConversationId[conversationId].attachments
  })

  const isThinking = computed(() => {
    const conversation = activeConversation.value
    if (!conversation) {
      return homePendingMessages.value.some((message) => {
        return message.role === 'assistant' && (message.status === 'thinking' || message.status === 'streaming')
      })
    }

    if (pendingRunVersion.value >= 0 && pendingRunStarts.has(conversation.id)) {
      return true
    }

    return conversation.runningRunIds.some((runId) => {
      const run = consoleState.runsById[runId]
      return run?.status === 'queued' || run?.status === 'streaming'
    })
  })

  const runningTaskCount = computed(() => {
    return profileMonitor.runningTaskCount.value
  })
  const profileCount = computed(() => profileMonitor.profileCount.value)

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
    homeRunPreparationToken = undefined
    homePendingMessages.value = []
    homeQueuedPrompts.value = []
    homePrompt.value = ''
    clearPendingAttachments()
    await router.push({
      name: 'agent-console-chat',
      query: route.query,
    })
  }

  function toggleTaskGroup(id: string) {
    profileMonitor.toggleTaskGroup(id)
  }

  function mergeConversation(conversation: AgentConversation) {
    const existing = consoleState.conversationsById[conversation.id]
    const previousRunId = existing?.latestRunId
    const previousRun = previousRunId ? consoleState.runsById[previousRunId] : undefined
    const wasRunning = Boolean(
      previousRunId
      && previousRunId === conversation.latestRunId
      && (isRunActive(previousRun?.status) || existing?.runningRunIds.includes(previousRunId)),
    )
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
    consoleState.queuedPromptsByConversationId[conversation.id] ||= []
    consoleState.taskGroupsByConversationId[conversation.id] ||= []

    if (wasRunning && conversation.latestRunId && isTerminalRunStatus(runSummary.latestRunStatus)) {
      finalizeRunFromServer(conversation.id, conversation.latestRunId, runSummary.latestRunStatus)
      refreshServerTerminalRun(conversation.id, conversation.latestRunId)
    }

    if (isConversationCachePinned(consoleState, conversation.id)) {
      consoleState.messagesByConversationId[conversation.id] ||= []
      pinConversationCache(conversation.id)
    }
  }

  async function loadConversationList() {
    if (conversationListLoadPromise) {
      return conversationListLoadPromise
    }

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

        if (conversationId) {
          await loadConversationDetail(conversationId)
        }
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
    if (conversationListLoadPromise) {
      await conversationListLoadPromise
    }
    if (!conversationListHasMore.value || conversationListMorePromise) {
      return conversationListMorePromise
    }

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

  function canLoadConversationDetail(conversationId: string): boolean {
    const conversation = consoleState.conversationsById[conversationId]
    const isTerminal = conversation?.latestRunStatus === 'completed'
      || conversation?.latestRunStatus === 'failed'
      || conversation?.latestRunStatus === 'cancelled'
    const isKnownConversation = conversationServerIds.includes(conversationId) || isTerminal
    const hasMessageCache = Object.hasOwn(consoleState.messagesByConversationId, conversationId)
    const isRunning = isConversationCachePinned(consoleState, conversationId)

    return shouldRequestConversationDetail({
      hasMessageCache,
      isKnownConversation,
      isRunning,
    })
  }

  async function resolveHistoryScriptRunPresentation(detail: AgentConsoleConversationDetailDTO): Promise<AgentConsoleConversationDetailDTO> {
    const messages = await Promise.all(detail.messages.map(async (message) => {
      if (!message.events?.length) {
        return message
      }

      return {
        ...message,
        events: await resolveScriptRunPresentationEvents(message.events, {
          templates: agentApi.templates,
          userTemplates: agentApi.userTemplates,
          locale: localeStore.currentLocale,
          workspaceId: workspaceStore.currentWorkspace?.id,
        }),
      }
    }))

    return { ...detail, messages }
  }

  async function loadConversationDetail(conversationId: string) {
    if (!canLoadConversationDetail(conversationId) || loadingConversationDetails.has(conversationId)) {
      return
    }

    touchConversationCache(consoleState, conversationId)

    const endLoadConversationDetail = createPerfTimer('agent-console:loadConversationDetail', {
      conversationId,
    })
    loadingConversationDetails.add(conversationId)

    try {
      let detail = await agentApi.conversationDetail(conversationId, {
        limit: CONVERSATION_MESSAGE_PAGE_SIZE,
      })
      if (!canLoadConversationDetail(conversationId)) {
        return
      }
      detail = await resolveHistoryScriptRunPresentation(detail)
      if (!canLoadConversationDetail(conversationId)) {
        return
      }

      const conversation = mapHistoryConversation(detail.conversation)
      mergeConversation(conversation)

      if (!consoleState.conversationIds.includes(conversation.id)) {
        consoleState.conversationIds.unshift(conversation.id)
      }

      const terminalRuns: Array<{ runId: string, status: AgentRunStatus, error?: string }> = []
      for (const message of detail.messages) {
        if (message.role !== 'assistant' || !message.events?.length) {
          continue
        }
        if (locallyStoppedRuns.hasRun(message.events[0].runId)) {
          continue
        }

        const stream = ensureConversationRunState(message.events[0])
        if (!replaceConversationRunEvents(stream, message.events)) {
          continue
        }
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

      consoleState.messagesByConversationId[conversationId] = mapHistoryMessages(detail)
      conversationMessagePaginationById[conversationId] = {
        hasMore: detail.hasMore === true && detail.nextCursor !== null,
        loading: false,
        nextCursor: detail.nextCursor ?? null,
      }

      for (const terminal of terminalRuns) {
        setRunStatus(consoleState, terminal.runId, terminal.status, terminal.error)
        schedulePromptQueueDrain(conversationId)
      }
    }
    catch (error) {
      console.error(`[agent-console] Failed to load conversation detail ${conversationId}:`, error)
    }
    finally {
      loadingConversationDetails.delete(conversationId)
      endLoadConversationDetail({
        loaded: Object.hasOwn(consoleState.messagesByConversationId, conversationId),
      })
    }
  }

  async function loadEarlierMessages() {
    const conversationId = activeConversationId.value
    if (!conversationId) {
      return
    }

    const pagination = conversationMessagePaginationById[conversationId]
    if (!pagination?.hasMore || pagination.loading || !pagination.nextCursor) {
      return
    }

    pagination.loading = true
    try {
      const response = await agentApi.conversationDetail(conversationId, {
        cursor: pagination.nextCursor,
        limit: CONVERSATION_MESSAGE_PAGE_SIZE,
      })
      const detail = await resolveHistoryScriptRunPresentation(response)
      const currentMessages = consoleState.messagesByConversationId[conversationId] ?? []
      const currentMessageIds = new Set(currentMessages.map(message => message.id))
      const earlierMessages = mapHistoryMessages(detail)
        .filter(message => !currentMessageIds.has(message.id))

      consoleState.messagesByConversationId[conversationId] = [
        ...earlierMessages,
        ...currentMessages,
      ]
      pagination.hasMore = detail.hasMore === true && detail.nextCursor !== null
      pagination.nextCursor = detail.nextCursor ?? null
      touchConversationCache(consoleState, conversationId)
    }
    catch (error) {
      console.error(`[agent-console] Failed to load earlier messages for ${conversationId}:`, error)
    }
    finally {
      pagination.loading = false
    }
  }

  function ensureConversationRunState(item: AgentConversationRunEventDTO) {
    const { conversationId, runId, assistantMessageId } = item
    const conversation = ensureConversation(consoleState, conversationId)!
    if (!consoleState.conversationIds.includes(conversationId)) {
      consoleState.conversationIds.unshift(conversationId)
    }

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
    }
    // 运行中会话常驻内存：从 LRU 移除（普通 delete 不清理消息）
    pinConversationCache(conversationId)

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
          revision: 0,
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
    const messages = consoleState.messagesByConversationId[conversationId]
    if (!messages) {
      return undefined
    }

    const matchesAssistant = (message: AgentMessage) => {
      return message.role === 'assistant'
        && (message.runId === runId || Boolean(assistantMessageId && message.id === assistantMessageId))
    }
    const assistantMessage = messages.find(matchesAssistant)
    if (!assistantMessage) {
      return undefined
    }

    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index]!
      if (message !== assistantMessage && matchesAssistant(message)) {
        messages.splice(index, 1)
      }
    }

    return assistantMessage
  }

  function settleProcessEvents(events: AgentProcessEvent[], failed: boolean) {
    for (const event of events) {
      if (event.status === 'running' || event.status === 'pending') {
        event.status = failed ? 'failed' : 'success'
      }
    }
  }

  function finalizeRunFromServer(conversationId: string, runId: string, status: Extract<AgentRunStatus, 'completed' | 'failed' | 'cancelled'>) {
    const message = getAssistantMessage(conversationId, runId)
    if (message?.process) {
      const endedAt = Date.now()
      const startedAt = message.process.durationStartedAt ?? endedAt
      message.process.durationEndedAt = endedAt
      message.process.durationLabel ??= formatTerminalDuration(status, Math.max(0, endedAt - startedAt))
      message.process.durationState = undefined
      message.process.completed = status === 'completed'
      message.process.collapsed = status === 'completed'
      settleProcessEvents(message.process.events, status === 'failed')
    }

    if (message) {
      message.status = status === 'failed' ? 'error' : 'done'
      message.createdAt ||= getCurrentDisplayTime()
    }
    setRunStatus(consoleState, runId, status)
    schedulePromptQueueDrain(conversationId)
  }

  function refreshServerTerminalRun(conversationId: string, runId: string) {
    if (refreshingServerTerminalRuns.has(runId)) {
      return
    }

    refreshingServerTerminalRuns.add(runId)
    queueMicrotask(() => {
      void loadConversationDetail(conversationId)
        .finally(() => refreshingServerTerminalRuns.delete(runId))
    })
  }

  function refreshAssistantFromEvents(conversationId: string, runId: string, assistantMessageId: string, finalize = false) {
    const stream = consoleState.streamsByRunId[runId]
    if (!stream) {
      return undefined
    }

    const presentationEvents = releasedRunEvents.get(runId) ?? stream.events
    const message = getAssistantMessage(conversationId, runId, assistantMessageId)
    const updater = processUpdatersByRunId.get(runId)

    const incremental = !finalize && message?.process
      ? updater?.update(assistantMessageId, message.process, presentationEvents)
      : false
    if (incremental) {
      message.content = incremental.content
      message.errorData = incremental.errorData
      message.status = incremental.status === 'error' ? 'error' : 'streaming'
      return {
        ...incremental,
        status: message.status,
      }
    }

    const parsed = buildProcessFromEvents(assistantMessageId, presentationEvents, { finalize })
    const nextUpdater = updater ?? new IncrementalProcessUpdater()
    nextUpdater.reset(presentationEvents, parsed.checkpoint)
    processUpdatersByRunId.set(runId, nextUpdater)

    if (message) {
      const frontendStartedAt = message.process?.durationStartedAt
      if (frontendStartedAt !== undefined
        && (parsed.process.durationStartedAt === undefined || frontendStartedAt < parsed.process.durationStartedAt)) {
        parsed.process.durationStartedAt = frontendStartedAt
        if (parsed.process.durationEndedAt !== undefined) {
          parsed.process.durationLabel = formatDuration(Math.max(0, parsed.process.durationEndedAt - frontendStartedAt))
        }
      }
      message.content = parsed.content
      message.process = parsed.process
      message.errorData = parsed.errorData
      message.status = finalize ? parsed.status : (parsed.status === 'error' ? 'error' : 'streaming')
      if (finalize) {
        message.createdAt = parsed.completedAt
      }
    }

    return parsed
  }

  function flushAssistantRefresh(runId: string, finalize = false) {
    const queued = queuedAssistantRefreshes.get(runId)
    if (!queued) {
      return undefined
    }

    queuedAssistantRefreshes.delete(runId)
    const parsed = refreshAssistantFromEvents(queued.conversationId, runId, queued.assistantMessageId, finalize)
    if (assistantRefreshTimer !== undefined && queuedAssistantRefreshes.size === 0) {
      window.clearTimeout(assistantRefreshTimer)
      assistantRefreshTimer = undefined
    }
    return parsed
  }

  function scheduleAssistantRefresh(conversationId: string, runId: string, assistantMessageId: string): void {
    queuedAssistantRefreshes.set(runId, { assistantMessageId, conversationId })
    if (assistantRefreshTimer !== undefined) {
      return
    }

    assistantRefreshTimer = window.setTimeout(() => {
      assistantRefreshTimer = undefined
      const runIds = [...queuedAssistantRefreshes.keys()]
      for (const queuedRunId of runIds) {
        flushAssistantRefresh(queuedRunId)
      }
    }, ASSISTANT_REFRESH_INTERVAL_MS)
  }

  async function updateHitlFromEvent(conversationId: string, runId: string, data: Record<string, unknown> | undefined) {
    const actionTitles = await resolveHitlActionTitles(data?.actionRequests, {
      officialScripts: agentApi.officialScripts,
      templates: agentApi.templates,
      userTemplates: agentApi.userTemplates,
      locale: localeStore.currentLocale,
      workspaceName: workspaceStore.currentWorkspace?.workspaceName,
    })
    const request = createHitlRequestFromAgentEvent(conversationId, runId, data, { actionTitles })
    if (!request) {
      return
    }

    consoleState.pendingHitlByConversationId[conversationId] = request
  }

  function clearHitlFromEvent(conversationId: string, approvalId?: string) {
    const request = consoleState.pendingHitlByConversationId[conversationId]
    if (!request) {
      return
    }

    if (!approvalId || approvalId === request.id) {
      delete consoleState.pendingHitlByConversationId[conversationId]
    }
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
    if (item.event.type !== 'user_message') {
      return []
    }
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
    if (item.event.type !== 'user_message') {
      return
    }
    const { conversationId, runId, assistantMessageId } = item
    const pending = pendingRunPayloads.get(runId)
    const messages = consoleState.messagesByConversationId[conversationId] ||= []
    const receivedAttachments = eventAttachments(item)
    const next: AgentMessage = {
      id: item.event.data.messageId,
      conversationId,
      runId,
      role: 'user',
      author: 'You',
      content: item.event.data.content,
      attachments: pending?.attachments.length
        ? reconcilePendingAttachments(pending.attachments, receivedAttachments)
        : receivedAttachments,
      createdAt: formatTime(item.event.data.createdAt || item.timestamp),
      status: 'done',
    }
    const existingIndex = messages.findIndex((message) => {
      return message.id === next.id || message.id === pending?.userMessageId
    })
    if (existingIndex >= 0) {
      messages[existingIndex] = next
    }
    else {
      const assistantIndex = messages.findIndex(message => message.id === assistantMessageId)
      messages.splice(assistantIndex >= 0 ? assistantIndex : messages.length, 0, next)
    }
    pendingRunPayloads.delete(runId)
  }

  async function processAcceptedConversationRunEvent(item: AgentConversationRunEventDTO): Promise<void> {
    const event = item.event
    const { conversationId, runId, assistantMessageId } = item
    if (event.type === 'user_message') {
      upsertUserMessage(item)
    }
    else if (event.type === 'title_changed') {
      const conversation = consoleState.conversationsById[conversationId]
      if (conversation && event.data.title.trim()) {
        conversation.title = event.data.title.trim()
      }
    }
    else if (event.type === 'plan_updated') {
      updateTodoProgress(conversationId, runId, event.data.todos)
    }
    else if (event.type === 'approval_requested') {
      await updateHitlFromEvent(conversationId, runId, {
        ...event.data,
        interruptsId: event.data.approvalId,
      })
    }
    else if (event.type === 'approval_resolved') {
      clearHitlFromEvent(conversationId, event.data.approvalId)
    }

    const terminal = terminalRunStatus(item)
    queuedAssistantRefreshes.set(runId, { assistantMessageId, conversationId })
    if (!terminal) {
      scheduleAssistantRefresh(conversationId, runId, assistantMessageId)
      return
    }

    const parsed = flushAssistantRefresh(runId, true)

    if (terminal === 'cancelled') {
      finalizeCancelledRunMessage(conversationId, runId)
    }
    setRunStatus(
      consoleState,
      runId,
      terminal,
      event.type === 'run_failed' ? event.data.message : undefined,
      { markUnread: true },
    )
    schedulePromptQueueDrain(conversationId)
    if (parsed?.status === 'error') {
      const message = getAssistantMessage(conversationId, runId, assistantMessageId)
      if (message) {
        message.status = 'error'
      }
    }
    refreshPayInfoAfterAgentActivity()
    void loadConversationList()
  }

  async function releaseConversationRunEvents(items: AgentConversationRunEventDTO[]): Promise<void> {
    const presentationItems = await resolveScriptRunPresentationEvents(items, {
      templates: agentApi.templates,
      userTemplates: agentApi.userTemplates,
      locale: localeStore.currentLocale,
      workspaceId: workspaceStore.currentWorkspace?.id,
    })
    const runIds = new Set<string>()
    const terminalRunIds = new Set<string>()
    for (const item of presentationItems) {
      if (item.startSequence !== undefined) {
        processUpdatersByRunId.delete(item.runId)
      }
      const presentationEvents = releasedRunEvents.get(item.runId) ?? []
      appendConversationRunPresentationEvents(presentationEvents, [item])
      releasedRunEvents.set(item.runId, presentationEvents)
      runIds.add(item.runId)
      if (terminalRunStatus(item)) {
        terminalRunIds.add(item.runId)
      }
      await processAcceptedConversationRunEvent(item)
    }

    for (const runId of runIds) {
      flushAssistantRefresh(runId)
    }
    await nextTick()

    for (const runId of terminalRunIds) {
      releasedRunEvents.delete(runId)
      presentationEventQueues.delete(runId)
      processUpdatersByRunId.delete(runId)
    }
  }

  const streamTextEventBuffer = new StreamTextEventBuffer({
    ttlMs: STREAM_TEXT_BUFFER_TTL_MS,
    scheduler: createIdleAwareStreamTextEventBufferScheduler(window),
    onFlush: releaseConversationRunEvents,
    onError(error) {
      console.error('[agent-console] Failed to flush buffered stream text events:', error)
    },
  })

  async function drainPresentationEvents(runId: string): Promise<void> {
    if (drainingPresentationRuns.has(runId)) {
      return
    }

    drainingPresentationRuns.add(runId)
    try {
      const queue = presentationEventQueues.get(runId)
      while (queue?.length) {
        const item = queue.shift()!
        if (streamTextEventBuffer.enqueue(item)) {
          continue
        }

        try {
          await streamTextEventBuffer.flushRun(runId)
        }
        catch (error) {
          console.error('[agent-console] Failed to render buffered stream text before a run event:', error)
        }
        await releaseConversationRunEvents([item])
      }
    }
    finally {
      drainingPresentationRuns.delete(runId)
      if (presentationEventQueues.get(runId)?.length) {
        void drainPresentationEvents(runId)
      }
    }
  }

  function enqueuePresentationEvent(item: AgentConversationRunEventDTO): void {
    const queue = presentationEventQueues.get(item.runId) ?? []
    queue.push(item)
    presentationEventQueues.set(item.runId, queue)
    void drainPresentationEvents(item.runId)
  }

  function handleConversationRunEvent(item: AgentConversationRunEventDTO): void {
    const stoppedPending = locallyStoppedRuns.resolve(item)
    if (stoppedPending) {
      reconcileConversationRunMessages(
        consoleState.messagesByConversationId[item.conversationId] ?? [],
        stoppedPending,
        item,
      )
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
      schedulePromptQueueDrain(item.conversationId)
    }

    if (locallyStoppedRuns.hasRun(item.runId)) {
      if (terminalRunStatus(item)) {
        refreshPayInfoAfterAgentActivity()
        void loadConversationList()
      }
      return
    }

    if (item.event.type === 'run_started') {
      const startedPending = pendingRunStarts.acknowledge(
        item.conversationId,
        item.event.data.requestId,
      )
      if (startedPending) {
        pendingRunPayloads.set(item.runId, startedPending)
        reconcileConversationRunMessages(
          consoleState.messagesByConversationId[item.conversationId] ?? [],
          startedPending,
          item,
        )
        startedPending.onRunStarted?.({
          conversationId: item.conversationId,
          runId: item.runId,
        })
      }

      const conversation = consoleState.conversationsById[item.conversationId]
      if (conversation) {
        conversation.unread = false
        if (startedPending && (conversation.title === 'New conversation' || conversation.title === 'New Chat' || conversation.title === 'Loading conversation...')) {
          conversation.title = createConversationTitle(startedPending.content)
        }
      }
      pendingRunVersion.value++
    }

    const stream = ensureConversationRunState(item)
    const ordered = appendOrderedConversationRunEvents(
      stream,
      bufferedRunEvents.get(item.runId) ?? [],
      item,
    )
    if (ordered.buffered.length > 0) {
      bufferedRunEvents.set(item.runId, ordered.buffered)
    }
    else {
      bufferedRunEvents.delete(item.runId)
    }

    for (const acceptedItem of ordered.accepted) {
      enqueuePresentationEvent(acceptedItem)
    }
  }

  function installConversationRunSubscriber(): void {
    if (conversationRunSubscriberInstalled) {
      return
    }
    conversationRunSubscriberInstalled = true
    agentChannel.subscribe((message: AgentChannelMessage) => {
      if (message.type === 'conversation.run.event') {
        handleConversationRunEvent(message.data)
        return
      }
      if (message.type === 'channel.ready') {
        refreshPayInfoAfterAgentActivity()
        void loadConversationList()
      }
    })
  }

  installConversationRunSubscriber()

  function completeRun(conversationId: string, runId: string) {
    const message = consoleState.messagesByConversationId[conversationId]?.find(item => item.runId === runId && item.role === 'assistant')
    if (message) {
      message.status = 'done'
    }

    setRunStatus(consoleState, runId, 'completed', undefined, { markUnread: true })
    schedulePromptQueueDrain(conversationId)
  }

  function failRun(conversationId: string, runId: string, error: string) {
    const message = getAssistantMessage(conversationId, runId)
    if (message) {
      message.status = 'error'
      message.content = error
      message.errorData = error
    }

    setRunStatus(consoleState, runId, 'failed', error, { markUnread: true })
    schedulePromptQueueDrain(conversationId)
  }

  function formatStoppedDuration(ms: number) {
    if (ms < 1000) {
      return `${$t('已停止')} 1s`
    }

    const seconds = Math.round(ms / 1000)
    if (seconds < 60) {
      return `${$t('已停止')} ${seconds}s`
    }

    const minutes = Math.floor(seconds / 60)
    const restSeconds = seconds % 60
    return restSeconds > 0 ? `${$t('已停止')} ${minutes}m${restSeconds}s` : `${$t('已停止')} ${minutes}m`
  }

  function formatTerminalDuration(status: AgentRunStatus, ms: number) {
    if (status === 'cancelled') {
      return formatStoppedDuration(ms)
    }

    if (ms < 1000) {
      return `${$t('任务耗时')} 1s`
    }

    const seconds = Math.round(ms / 1000)
    if (seconds < 60) {
      return `${$t('任务耗时')} ${seconds}s`
    }

    const minutes = Math.floor(seconds / 60)
    const restSeconds = seconds % 60
    return restSeconds > 0 ? `${$t('任务耗时')} ${minutes}m${restSeconds}s` : `${$t('任务耗时')} ${minutes}m`
  }

  function markProcessEventsStopped(events: AgentProcessEvent[]) {
    for (const event of events) {
      if (event.status === 'running' || event.status === 'pending') {
        event.status = 'failed'
      }

      if (event.type === 'agent_lifecycle') {
        markProcessEventsStopped(event.events)
        markProcessEventsStopped(event.children)
      }
    }
  }

  function finalizeCancelledRunMessage(conversationId: string, runId: string) {
    const message = getAssistantMessage(conversationId, runId)
    if (!message) {
      return
    }

    message.status = 'done'
    message.createdAt ||= getCurrentDisplayTime()

    if (!message.process) {
      return
    }

    const endedAt = Date.now()
    const startedAt = message.process.durationStartedAt ?? endedAt
    message.process.durationEndedAt = endedAt
    message.process.durationLabel = formatStoppedDuration(Math.max(0, endedAt - startedAt))
    message.process.durationState = undefined
    message.process.completed = false
    message.process.collapsed = false
    markProcessEventsStopped(message.process.events)
  }

  async function cancelRun(runId: string) {
    const run = consoleState.runsById[runId]
    if (!run) {
      return
    }

    const requestId = agentChannel.send('conversation.run.stop', { conversationId: run.conversationId })
    if (!requestId) {
      onlyErrorToast(-1, $t('Agent 连接尚未就绪'))
      return
    }

    locallyStoppedRuns.addRun(runId)
    try {
      await streamTextEventBuffer.flushRun(runId)
    }
    catch (error) {
      console.error('[agent-console] Failed to render buffered stream text before stopping a run:', error)
    }
    presentationEventQueues.delete(runId)
    streamTextEventBuffer.discardRun(runId)
    flushAssistantRefresh(runId)
    bufferedRunEvents.delete(runId)
    queuedAssistantRefreshes.delete(runId)
    releasedRunEvents.delete(runId)
    processUpdatersByRunId.delete(runId)
    finalizeCancelledRunMessage(run.conversationId, runId)
    setRunStatus(consoleState, runId, 'cancelled')
    schedulePromptQueueDrain(run.conversationId)
  }

  function cancelActiveRun() {
    const conversation = activeConversation.value
    if (!conversation && homeRunPreparationToken) {
      homeRunPreparationToken = undefined
      homePendingMessages.value = []
      schedulePromptQueueDrain()
      return
    }

    if (!conversation) {
      return
    }

    if (pendingRunStarts.has(conversation.id)) {
      const requestId = agentChannel.send('conversation.run.stop', { conversationId: conversation.id })
      if (!requestId) {
        onlyErrorToast(-1, $t('Agent 连接尚未就绪'))
        return
      }

      const pending = pendingRunStarts.acknowledge(conversation.id)
      if (pending) {
        locallyStoppedRuns.addPending(conversation.id, pending.requestId, pending)
        const message = consoleState.messagesByConversationId[conversation.id]?.find(item => item.id === pending.assistantMessageId)
        if (message) {
          message.status = 'done'
          message.createdAt = getCurrentDisplayTime()
          if (message.process) {
            const endedAt = Date.now()
            message.process.durationEndedAt = endedAt
            message.process.durationLabel = formatStoppedDuration(Math.max(0, endedAt - pending.startedAt))
            message.process.durationState = undefined
          }
        }
      }
      pendingRunVersion.value++
      schedulePromptQueueDrain(conversation.id)
      return
    }

    for (let index = conversation.runningRunIds.length - 1; index >= 0; index--) {
      const runId = conversation.runningRunIds[index]
      const run = consoleState.runsById[runId]
      if (!run || isRunActive(run.status)) {
        void cancelRun(runId)
        return
      }
    }
  }

  async function deleteConversation(conversationId: string) {
    const conversation = consoleState.conversationsById[conversationId]
    if (!conversation) {
      return
    }

    if (isConversationRunning(consoleState, conversationId)) {
      onlyErrorToast(-1, $t('任务进行中，请先停止再删除'))
      return
    }

    try {
      await agentApi.deleteConversation(conversationId)
      streamTextEventBuffer.removeConversation(conversationId)
      for (const stream of Object.values(consoleState.streamsByRunId)) {
        if (stream.conversationId === conversationId) {
          presentationEventQueues.delete(stream.runId)
          releasedRunEvents.delete(stream.runId)
          processUpdatersByRunId.delete(stream.runId)
        }
      }
      removeConversation(consoleState, conversationId)
      showToast(0, $t('对话已删除'))

      if (activeConversationId.value === conversationId) {
        const nextConversationId = consoleState.conversationIds[0]
        if (nextConversationId) {
          await routeToConversation(nextConversationId)
        }
        else {
          await router.push({ name: 'agent-console-chat', query: route.query })
        }
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
    if (!conversation || !normalizedTitle) {
      return false
    }
    if (normalizedTitle === conversation.title) {
      return true
    }

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
    if (!conversationId || !request || request.id !== payload.requestId) {
      return
    }

    request.status = 'submitting'

    try {
      const decisions = createLegacyResumeDecisions(request, payload).map(decision =>
        payload.fullAccess && decision.type === 'approve'
          ? { ...decision, fullAccess: true }
          : decision,
      )
      const commandId = agentChannel.send('conversation.approval.submit', {
        conversationId,
        approvalId: request.id,
        decisions,
      })
      if (!commandId) {
        throw new Error('Agent WebSocket is not ready')
      }
      if (payload.fullAccess) {
        fullAccess.value = true
      }
    }
    catch (error) {
      request.status = 'error'
      console.error('[agent-console] Failed to submit HITL decision:', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('提交审批失败'))
    }
  }

  function addPendingAttachments(files: File[]) {
    if (!files.length || isThinking.value) {
      return
    }

    const nextAttachments = files.map(file => createLocalAttachment(file))
    if (!nextAttachments.length) {
      return
    }

    const conversationId = activeConversationId.value
    const target = getPendingAttachmentTarget(conversationId)
    target.push(...nextAttachments)
    for (const attachment of target.slice(-nextAttachments.length)) {
      startPendingAttachmentUpload(conversationId, target, attachment)
    }
  }

  function addPendingFolder(folder: AgentFolderSelection) {
    if (isThinking.value) {
      return
    }

    const nextAttachment = createLocalFolderAttachment(folder)
    const conversationId = activeConversationId.value
    const target = getPendingAttachmentTarget(conversationId)
    target.push(nextAttachment)
    startPendingAttachmentUpload(conversationId, target, target[target.length - 1])
  }

  function addPendingPathAttachment(selection: AgentPathSelection) {
    const nextAttachment = createLocalPathAttachment(selection)
    const conversationId = activeConversationId.value
    if (!conversationId) {
      homePendingAttachments.value = [...homePendingAttachments.value, nextAttachment]
      return
    }

    consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
    consoleState.draftsByConversationId[conversationId].attachments.push(nextAttachment)
  }

  function getPendingAttachmentTarget(conversationId?: string) {
    if (!conversationId) {
      return homePendingAttachments.value
    }

    consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
    return consoleState.draftsByConversationId[conversationId].attachments
  }

  function startPendingAttachmentUpload(
    conversationId: string | undefined,
    sourceAttachments: AgentAttachment[],
    attachment: AgentAttachment | undefined,
  ) {
    if (!attachment || attachment.uploadStatus === 'uploaded') {
      return
    }

    const uploadKey = attachment.fileId
    const uploadPromise = uploadPendingAttachmentsForConversation(conversationId, sourceAttachments, [attachment])
    pendingAttachmentUploadPromises.set(uploadKey, uploadPromise)
    void uploadPromise.catch((error) => {
      console.error('[agent-console] Failed to upload attachment:', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('文件上传失败'))
    }).finally(() => {
      if (pendingAttachmentUploadPromises.get(uploadKey) === uploadPromise) {
        pendingAttachmentUploadPromises.delete(uploadKey)
      }
    })
  }

  function removePendingAttachment(fileId: string) {
    const attachments = pendingAttachments.value
    const index = attachments.findIndex(attachment => attachment.fileId === fileId)
    if (index < 0) {
      return
    }

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
    if (!draft) {
      return
    }

    revokeAttachments(draft.attachments)
    draft.attachments = []
  }

  function detachPendingAttachments(conversationId?: string) {
    if (!conversationId) {
      homePendingAttachments.value = []
      return
    }

    const draft = consoleState.draftsByConversationId[conversationId]
    if (draft) {
      draft.attachments = []
    }
  }

  async function uploadPendingAttachmentsForConversation(
    conversationId: string | undefined,
    sourceAttachments: AgentAttachment[],
    attachments = sourceAttachments.slice(),
  ) {
    const uploadedAttachments: AgentAttachment[] = []

    for (const attachment of attachments) {
      if (!sourceAttachments.includes(attachment)) {
        continue
      }

      const pendingUpload = pendingAttachmentUploadPromises.get(attachment.fileId)
      if (pendingUpload) {
        uploadedAttachments.push(...await pendingUpload)
        continue
      }

      if (attachment.localPath) {
        attachment.uploadStatus = 'uploaded'
        uploadedAttachments.push(attachment)
        continue
      }

      if (attachment.kind === 'folder' && attachment.localFiles?.length) {
        attachment.uploadStatus = 'uploading'

        try {
          const uploadedFiles: AgentAttachment[] = []
          for (const file of attachment.localFiles) {
            if (!sourceAttachments.includes(attachment)) {
              return uploadedAttachments
            }

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

          if (!sourceAttachments.includes(attachment)) {
            continue
          }

          Object.assign(attachment, {
            localFiles: undefined,
            uploadedFiles,
            uploadStatus: 'uploaded',
          })
          uploadedAttachments.push(attachment)
          uploadedAttachments.push(...uploadedFiles)
        }
        catch (error) {
          if (sourceAttachments.includes(attachment)) {
            attachment.uploadStatus = 'error'
          }
          throw error
        }
        continue
      }

      if (attachment.kind === 'folder') {
        uploadedAttachments.push(attachment, ...(attachment.uploadedFiles ?? []))
        continue
      }

      if (!attachment.localFile) {
        uploadedAttachments.push(attachment)
        continue
      }

      attachment.uploadStatus = 'uploading'

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
        if (!sourceAttachments.includes(attachment)) {
          continue
        }

        revokeAttachments([attachment])
        Object.assign(attachment, uploadedAttachment)
        uploadedAttachments.push(attachment)
      }
      catch (error) {
        if (sourceAttachments.includes(attachment)) {
          attachment.uploadStatus = 'error'
        }
        throw error
      }
    }

    return uploadedAttachments
  }

  async function sendPrompt(options: SendPromptOptions = {}): Promise<boolean> {
    const startedAt = Date.now()
    let conversationId = options.conversationId ?? activeConversationId.value
    const content = (options.content ?? prompt.value).trim()
    const sourceAttachments = options.attachments ?? (options.content === undefined ? pendingAttachments.value : [])
    if (
      (!content && sourceAttachments.length === 0)
    ) {
      return false
    }

    const conversationBusy = conversationId
      ? isConversationStarting(conversationId)
      : Boolean(homeRunPreparationToken)
    if (conversationBusy) {
      if (
        options.fromQueue
        || options.templateContext !== undefined
        || (!content && sourceAttachments.length === 0)
        || sourceAttachments.some(attachment => !attachment.localPath)
      ) {
        return false
      }

      enqueuePrompt(conversationId, content, {
        attachments: sourceAttachments.slice(),
        draftContent: content,
      })
      detachPendingAttachments(conversationId)
      prompt.value = ''
      return true
    }

    const token = `${startedAt}-${Math.random().toString(16).slice(2, 8)}`
    const startedFromHome = !conversationId
    const optimistic = createPendingRunMessages({
      conversationId: conversationId ?? `pending-home-${token}`,
      content,
      attachments: [...sourceAttachments],
      createdAt: formatTime(startedAt),
      startedAt,
      token,
    })
    const preparing: PendingRunDraft = {
      ...optimistic.presentation,
      content,
      draftContent: content,
      attachments: optimistic.messages[0]?.attachments ?? [],
    }

    if (startedFromHome) {
      homeRunPreparationToken = token
      homePendingMessages.value = optimistic.messages
    }
    else {
      consoleState.messagesByConversationId[conversationId] ||= []
      consoleState.messagesByConversationId[conversationId].push(...optimistic.messages)
      preparingRunStarts.set(conversationId, preparing)
      pinConversationCache(conversationId)
    }

    if (startedFromHome) {
      let conversation: AgentConversation
      try {
        conversation = mapHistoryConversation(await agentApi.createConversation())
      }
      catch (error) {
        if (homeRunPreparationToken === token) {
          homeRunPreparationToken = undefined
          homePendingMessages.value = []
        }
        console.error('[agent-console] Failed to create conversation:', error)
        onlyErrorToast(-1, error instanceof Error ? error.message : $t('创建会话失败'))
        return false
      }

      if (homeRunPreparationToken !== token) {
        return false
      }

      mergeConversation(conversation)
      if (!consoleState.conversationIds.includes(conversation.id)) {
        consoleState.conversationIds.unshift(conversation.id)
      }
      conversationId = conversation.id
      const pendingHomeQueue = homeQueuedPrompts.value
      for (const queuedPrompt of pendingHomeQueue) {
        queuedPrompt.conversationId = conversationId
      }
      consoleState.queuedPromptsByConversationId[conversationId] = pendingHomeQueue
      homeQueuedPrompts.value = []
      consoleState.messagesByConversationId[conversationId] ||= []
      for (const message of optimistic.messages) {
        message.conversationId = conversationId
      }
      consoleState.messagesByConversationId[conversationId].push(...optimistic.messages)
      consoleState.draftsByConversationId[conversationId].prompt = content
      consoleState.draftsByConversationId[conversationId].attachments = homePendingAttachments.value
      preparingRunStarts.set(conversationId, preparing)
      pinConversationCache(conversationId)
      homePendingAttachments.value = []
      homePrompt.value = ''
      await routeToConversation(conversationId)
      if (homeRunPreparationToken === token) {
        homeRunPreparationToken = undefined
        homePendingMessages.value = []
      }
    }

    function removePreparingMessages(): void {
      const messages = consoleState.messagesByConversationId[conversationId] ?? []
      consoleState.messagesByConversationId[conversationId] = messages.filter((message) => {
        return message.id !== preparing.userMessageId && message.id !== preparing.assistantMessageId
      })
      preparingRunStarts.delete(conversationId)
      touchConversationCache(consoleState, conversationId)
    }

    try {
      await agentChannel.waitUntilConnected()
    }
    catch (error) {
      removePreparingMessages()
      console.error('[agent-console] Agent channel is not ready:', error)
      onlyErrorToast(-1, $t('Agent 连接尚未就绪'))
      return false
    }
    const displayAttachments = sourceAttachments.filter((attachment) => {
      if (attachment.kind === 'folder') {
        return true
      }

      return !attachment.fileName.includes('/')
    })
    const pendingAttachmentMetadata = displayAttachments.map(attachment => ({
      fileId: attachment.fileId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      ...(attachment.size !== undefined ? { size: attachment.size } : {}),
      ...(attachment.url ? { url: attachment.url } : {}),
      ...(attachment.localUrl ? { localUrl: attachment.localUrl } : {}),
      ...(attachment.remoteUrl ? { remoteUrl: attachment.remoteUrl } : {}),
      ...(attachment.fileUrl ? { fileUrl: attachment.fileUrl } : {}),
    }))
    const requestId = agentChannel.send('conversation.run.start', {
      conversationId,
      turnId: preparing.userMessageId,
      message: content,
      ...(sourceAttachments.length > 0 ? { attachmentsPending: true } : {}),
      ...(pendingAttachmentMetadata.length > 0 ? { pendingAttachments: pendingAttachmentMetadata } : {}),
      ...(options.templateContext ? { templateContext: options.templateContext } : {}),
      fullAccess: fullAccess.value,
    })
    if (!requestId) {
      removePreparingMessages()
      onlyErrorToast(-1, $t('Agent 连接尚未就绪'))
      return false
    }

    const pending: PendingRunStart = {
      ...preparing,
      requestId,
      content,
      attachments: displayAttachments,
      onRunStarted: options.onRunStarted,
    }
    const optimisticUserMessage = consoleState.messagesByConversationId[conversationId]?.find(message => message.id === preparing.userMessageId)
    if (optimisticUserMessage) {
      optimisticUserMessage.content = content
      optimisticUserMessage.attachments = displayAttachments
    }
    preparingRunStarts.delete(conversationId)
    pendingRunStarts.begin(
      conversationId,
      requestId,
      pending,
      PENDING_RUN_START_TIMEOUT_MS,
      (expired) => {
        const messages = consoleState.messagesByConversationId[conversationId] ?? []
        consoleState.messagesByConversationId[conversationId] = messages.filter((message) => {
          return message.id !== expired.userMessageId && message.id !== expired.assistantMessageId
        })
        const draft = consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
        if (!draft.prompt) {
          draft.prompt = expired.draftContent
        }
        if (draft.attachments.length === 0) {
          draft.attachments = expired.attachments
        }
        touchConversationCache(consoleState, conversationId)
        pendingRunVersion.value++
      },
    )
    pendingRunVersion.value++
    if (!options.fromQueue) {
      const draft = consoleState.draftsByConversationId[conversationId] ||= createEmptyDraft(conversationId)
      draft.prompt = ''
      draft.attachments = []
    }

    let uploadedAttachments: AgentAttachment[] = []
    try {
      uploadedAttachments = await uploadPendingAttachmentsForConversation(conversationId, sourceAttachments)
    }
    catch (error) {
      console.error('[agent-console] Failed to upload attachments:', error)
      onlyErrorToast(-1, error instanceof Error ? error.message : $t('文件上传失败'))
      agentChannel.send('conversation.run.stop', { conversationId })
      return true
    }

    if (sourceAttachments.length > 0) {
      const localAttachments = collectLocalPathAttachments(uploadedAttachments)
      const chatAttachments = uploadedAttachments.filter(attachment => attachment.kind === 'file' && !attachment.localPath)
      const readyRequestId = agentChannel.send('conversation.run.attachments.ready', {
        conversationId,
        turnId: preparing.userMessageId,
        attachments: chatAttachments.map(attachment => ({ fileId: attachment.fileId })),
        ...(localAttachments.length > 0 ? { localAttachments } : {}),
      })
      if (!readyRequestId) {
        onlyErrorToast(-1, $t('Agent 连接尚未就绪'))
        agentChannel.send('conversation.run.stop', { conversationId })
      }
    }

    return true
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
    loadEarlierMessages,
    messageList,
    messageHistoryHasMore,
    messageHistoryLoading,
    pendingAttachments,
    pendingApprovalConversationIds,
    prompt,
    queuedPrompts,
    removePendingAttachment,
    removeQueuedPrompt,
    renameConversation,
    reorderQueuedPrompt,
    restoreQueuedPrompt,
    runningTaskCount,
    profileCount,
    selectConversation,
    sendPrompt,
    startNewChat,
    submitHitl,
    state: consoleState,
    taskGroupList,
    profileMonitorConnected: profileMonitor.connected,
    toggleTaskGroup,
  }
}
