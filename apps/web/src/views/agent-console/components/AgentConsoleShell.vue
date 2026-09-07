<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import type { AgentTaskReportSaveRequest } from '../types'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useAgentConsoleApi } from '../api'
import { useAgentChannel } from '../composables/useAgentChannel'
import { useAgentConsole } from '../composables/useAgentConsole'
import { isTrackedOnboardingRunTerminal } from '../onboarding-run-completion'
import { provideProfileMonitorContext } from '../composables/useProfileMonitorContext'
import AgentDeleteConfirmDialog from './AgentDeleteConfirmDialog.vue'
import AgentSidebar from './AgentSidebar.vue'
import SelectWindowGuide from './SelectWindowGuide.vue'
import FeedbackDialog from './dialog/FeedbackDialog.vue'
import RenameConversationDialog from './dialog/RenameConversationDialog.vue'
import ProfileMonitorPanel from './ProfileMonitorPanel.vue'
import { perfLog } from '/@/utils/perf-log'

interface AgentSidebarExpose {
  getNewChatElement: () => HTMLElement | null
}

perfLog('agent-shell:setup:start')

onMounted(() => {
  document.body.classList.add('agent-console-window')
  perfLog('agent-shell:mounted')
})

const agentApi = useAgentConsoleApi()
useAgentChannel()

void agentApi.initializeAgentBackendAuth().catch((error) => {
  console.error('[agent-console] Failed to initialize Agent backend authentication:', error)
})

onUnmounted(() => {
  document.body.classList.remove('agent-console-window')
})

const {
  activeConversation,
  activeConversationId,
  activeHitlRequest,
  activeTodoProgress,
  addPendingAttachments,
  addPendingFolder,
  addPendingPathAttachment,
  cancelActiveRun,
  conversationList,
  conversationListHasMore,
  conversationListLoadingMore,
  isThinking,
  loadMoreConversations,
  loadEarlierMessages,
  messageList,
  messageHistoryHasMore,
  messageHistoryLoading,
  pendingAttachments,
  pendingApprovalConversationIds,
  profileCount,
  prompt,
  queuedPrompts,
  removePendingAttachment,
  removeQueuedPrompt,
  renameConversation,
  reorderQueuedPrompt,
  restoreQueuedPrompt,
  runningTaskCount,
  taskGroupList,
  deleteConversation,
  selectConversation,
  sendPrompt,
  state: agentConsoleState,
  startNewChat,
  submitHitl,
  toggleTaskGroup,
} = useAgentConsole()

perfLog('agent-shell:setup-complete')

const TASK_MONITOR_MIN_VIEWPORT_WIDTH = 1181
const TASK_MONITOR_DEFAULT_WIDTH = 320
const TASK_MONITOR_MIN_WIDTH = 280
const TASK_MONITOR_MAX_WIDTH = 480
const AGENT_SIDEBAR_DEFAULT_WIDTH = 220
const AGENT_SIDEBAR_MIN_WIDTH = 200
const AGENT_SIDEBAR_MAX_WIDTH = 360
const CHAT_MIN_WIDTH = 460
const AGENT_UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000
const taskMonitorOpen = ref(false)
const taskMonitorViewportAvailable = ref(typeof window === 'undefined' ? true : window.innerWidth >= TASK_MONITOR_MIN_VIEWPORT_WIDTH)
const taskMonitorAvailable = computed(() => taskMonitorViewportAvailable.value && profileCount.value > 0)
const taskMonitorVisible = computed(() => taskMonitorOpen.value && taskMonitorAvailable.value)
const taskMonitorWidth = ref(TASK_MONITOR_DEFAULT_WIDTH)
const agentSidebarWidth = ref(AGENT_SIDEBAR_DEFAULT_WIDTH)
const agentSidebarRef = ref<AgentSidebarExpose | null>(null)
const onboardingNewChatGuideVisible = ref(false)
const onboardingNewChatGuideTarget = shallowRef<HTMLElement | null>(null)
const onboardingCompletionVisible = ref(false)
const onboardingTrackedRunId = ref<string>()
let onboardingRunRequestVersion = 0
const agentConsoleLayoutStyle = computed(() => ({
  '--agent-sidebar-width': `${agentSidebarWidth.value}px`,
  '--task-monitor-width': `${taskMonitorWidth.value}px`,
}))
const taskMonitorWindowKeys = computed(() => taskGroupList.value.flatMap(group =>
  group.tasks.filter(task => task.status === 'running').map(task => `${group.id}:${task.id}`),
))

watch(taskMonitorWindowKeys, (windowKeys, previousWindowKeys) => {
  const previousWindowKeySet = new Set(previousWindowKeys)
  if (windowKeys.some(windowKey => !previousWindowKeySet.has(windowKey))) {
    taskMonitorOpen.value = true
  }
})
const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const dialog = useDialog()
const [, onlyErrorToast] = useResponseToast()
const isRoxyClawSettings = computed(() => String(route.name ?? '').startsWith('agent-console-roxyclaw'))
const isSettingsLayout = computed(() => (
  route.meta.agentConsoleLayout === 'settings'
  || isRoxyClawSettings.value
))
const chatRouteNames = new Set(['agent-console-chat', 'agent-console-conversation'])
const routeContextRouteNames = new Set([
  'agent-console-credits',
  'agent-console-roxyclaw',
  'agent-console-task-manager',
])
const promptRouteNames = new Set([
  ...routeContextRouteNames,
  'agent-console-my-templates',
  'agent-console-template-store',
])
const agentUpdateInfo = ref<ResourceUpdateMessage | null>(null)
const applyingAgentUpdate = ref(false)
const newChatFocusKey = ref(0)
const agentUpdateReady = computed(() => {
  return agentUpdateInfo.value?.type === 'agent' && ['update', 'downloaded', 'failed'].includes(agentUpdateInfo.value.status!)
})
const hasRunningAgentActivity = computed(() => {
  return isThinking.value
    || runningTaskCount.value > 0
    || conversationList.value.some(conversation => conversation.runningRunIds.length > 0)
})

async function saveTaskReportTemplate(request: AgentTaskReportSaveRequest): Promise<void> {
  const started = await sendPrompt({
    conversationId: request.conversationId,
    content: $t('请你将刚才的任务保存为模板'),
    templateContext: {
      sourceReportId: request.sourceReportId,
      report: request.report,
    },
  })
  if (started) {
    request.resolve()
    return
  }
  request.reject(new Error('Template save turn could not be started.'))
}
const backToAppRoute = computed(() => activeConversationId.value
  ? { name: 'agent-console-conversation', params: { conversationId: activeConversationId.value } }
  : { name: 'agent-console-chat' })
let removeTaskMonitorViewportListener: (() => void) | null = null
let removeTaskMonitorDragListeners: (() => void) | null = null
let removeAgentSidebarDragListeners: (() => void) | null = null
let removeMcpNavigateListener: (() => void) | null = null
let removeMcpResourceUpdateListener: (() => void) | null = null
let agentUpdateCheckTimer: ReturnType<typeof setInterval> | null = null

function getTaskMonitorMaxWidth(): number {
  if (typeof window === 'undefined') {
    return TASK_MONITOR_MAX_WIDTH
  }

  return Math.max(
    TASK_MONITOR_MIN_WIDTH,
    Math.min(TASK_MONITOR_MAX_WIDTH, window.innerWidth - agentSidebarWidth.value - CHAT_MIN_WIDTH),
  )
}

function clampTaskMonitorWidth(width: number): number {
  return Math.min(Math.max(width, TASK_MONITOR_MIN_WIDTH), getTaskMonitorMaxWidth())
}

function resizeTaskMonitorBy(delta: number) {
  taskMonitorWidth.value = clampTaskMonitorWidth(taskMonitorWidth.value + delta)
}

function getAgentSidebarMaxWidth(): number {
  if (typeof window === 'undefined') {
    return AGENT_SIDEBAR_MAX_WIDTH
  }

  const monitorOccupiedWidth = taskMonitorVisible.value ? taskMonitorWidth.value : 0
  return Math.max(
    AGENT_SIDEBAR_MIN_WIDTH,
    Math.min(AGENT_SIDEBAR_MAX_WIDTH, window.innerWidth - CHAT_MIN_WIDTH - monitorOccupiedWidth),
  )
}

function clampAgentSidebarWidth(width: number): number {
  return Math.min(Math.max(width, AGENT_SIDEBAR_MIN_WIDTH), getAgentSidebarMaxWidth())
}

function resizeAgentSidebarBy(delta: number) {
  agentSidebarWidth.value = clampAgentSidebarWidth(agentSidebarWidth.value + delta)
}

function stopTaskMonitorResize() {
  removeTaskMonitorDragListeners?.()
  removeTaskMonitorDragListeners = null
  document.body.classList.remove('agent-console-window--resizing-monitor')
}

function startTaskMonitorResize(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  stopTaskMonitorResize()

  const startX = event.clientX
  const startWidth = taskMonitorWidth.value
  const handlePointerMove = (moveEvent: PointerEvent) => {
    taskMonitorWidth.value = clampTaskMonitorWidth(startWidth + startX - moveEvent.clientX)
    // monitor 宽度变化会收紧 sidebar 上限，同步夹取以保护中间聊天区最小宽度
    agentSidebarWidth.value = clampAgentSidebarWidth(agentSidebarWidth.value)
  }
  const handlePointerEnd = () => stopTaskMonitorResize()

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerEnd)
  window.addEventListener('pointercancel', handlePointerEnd)
  window.addEventListener('blur', handlePointerEnd)
  document.body.classList.add('agent-console-window--resizing-monitor')

  removeTaskMonitorDragListeners = () => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerEnd)
    window.removeEventListener('pointercancel', handlePointerEnd)
    window.removeEventListener('blur', handlePointerEnd)
  }
}

function stopAgentSidebarResize() {
  removeAgentSidebarDragListeners?.()
  removeAgentSidebarDragListeners = null
  document.body.classList.remove('agent-console-window--resizing-sidebar')
}

function startAgentSidebarResize(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  stopAgentSidebarResize()

  const startX = event.clientX
  const startWidth = agentSidebarWidth.value
  const handlePointerMove = (moveEvent: PointerEvent) => {
    agentSidebarWidth.value = clampAgentSidebarWidth(startWidth + (moveEvent.clientX - startX))
    // sidebar 宽度变化会收紧 monitor 上限，同步夹取以保护中间聊天区最小宽度
    taskMonitorWidth.value = clampTaskMonitorWidth(taskMonitorWidth.value)
  }
  const handlePointerEnd = () => stopAgentSidebarResize()

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerEnd)
  window.addEventListener('pointercancel', handlePointerEnd)
  window.addEventListener('blur', handlePointerEnd)
  document.body.classList.add('agent-console-window--resizing-sidebar')

  removeAgentSidebarDragListeners = () => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerEnd)
    window.removeEventListener('pointercancel', handlePointerEnd)
    window.removeEventListener('blur', handlePointerEnd)
  }
}

function syncTaskMonitorAvailability(available: boolean) {
  if (taskMonitorViewportAvailable.value === available) {
    return
  }

  taskMonitorViewportAvailable.value = available

  if (!available) {
    stopTaskMonitorResize()
    taskMonitorOpen.value = false
  }
}

watch(taskMonitorAvailable, (available) => {
  if (!available) {
    taskMonitorOpen.value = false
  }
})

async function restartAgentForUpdate() {
  if (!globalThis.isElectron || !agentUpdateReady.value || applyingAgentUpdate.value) {
    return
  }

  applyingAgentUpdate.value = true
  try {
    const result = await triggerAgentUpdate(route.fullPath)
    if (!result.success) {
      onlyErrorToast(-1, result.message || $t('AI Agent 更新失败'))
      applyingAgentUpdate.value = false
    }
  }
  catch (error) {
    console.error('Failed to restart agent for update:', error)
    onlyErrorToast(-1, error instanceof Error ? error.message : $t('AI Agent 更新失败'))
    applyingAgentUpdate.value = false
  }
}

async function triggerAgentUpdate(routePath: string) {
  try {
    return await globalThis.electronAPI.send('mcp:triggerAgentUpdate', { route: routePath })
  }
  catch (error) {
    console.warn('[agent-console] fallback to legacy agent update IPC:', error)
    return globalThis.electronAPI.send('mcp:restartAgentForUpdate', { route: routePath })
  }
}

async function checkAgentForUpdates() {
  if (!globalThis.isElectron) {
    return
  }

  try {
    const data = await checkAgentForUpdatesByIpc()
    console.log('[agent-console] agent update info:', data)
    agentUpdateInfo.value = data
  }
  catch (error) {
    console.error('Failed to check agent update:', error)
  }
}

async function checkAgentForUpdatesByIpc() {
  try {
    return await globalThis.electronAPI.send('mcp:checkAgentForUpdates')
  }
  catch (error) {
    console.warn('[agent-console] fallback to legacy agent update info IPC:', error)
    return globalThis.electronAPI.send('mcp:getAgentUpdateInfo')
  }
}

function handleRestartAgentForUpdate() {
  if (!agentUpdateReady.value) {
    return
  }

  if (!hasRunningAgentActivity.value) {
    void restartAgentForUpdate()
    return
  }

  confirm.require({
    header: $t('更新 AI Agent'),
    message: $t('当前有对话正在进行中，更新会中断当前对话。确认继续更新吗？'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('继续更新'),
    },
    accept: () => {
      void restartAgentForUpdate()
    },
  })
}

function isRouteNameIn(routeName: string | symbol | null | undefined, routeNames: Set<string>) {
  return typeof routeName === 'string' && routeNames.has(routeName)
}

function isChatRouteName(routeName: string | symbol | null | undefined) {
  return isRouteNameIn(routeName, chatRouteNames)
}

function isRouteContextRouteName(routeName: string | symbol | null | undefined) {
  return isRouteNameIn(routeName, routeContextRouteNames)
}

function isPromptRouteName(routeName: string | symbol | null | undefined) {
  return isRouteNameIn(routeName, promptRouteNames)
}

function confirmDeleteConversation(conversationId: string) {
  const conversation = conversationList.value.find(item => item.id === conversationId)
  if (!conversation) {
    return
  }

  confirm.require({
    group: 'agentConsoleDeleteConfirmDialog',
    header: $t('删除对话'),
    message: $t('删除后无法恢复，确认删除对话“{name}”吗？', { name: conversation.title }),
    acceptLabel: $t('删除'),
    rejectLabel: $t('取消'),
    accept: () => {
      void deleteConversation(conversationId)
    },
  })
}

function openRenameConversationDialog(conversationId: string) {
  const conversation = conversationList.value.find(item => item.id === conversationId)
  if (!conversation) {
    return
  }

  dialog.open(RenameConversationDialog, {
    props: {
      modal: true,
      blockScroll: true,
      dismissableMask: false,
      draggable: false,
      showHeader: false,
      style: { width: 'min(440px, calc(100vw - 32px))' },
      pt: {
        root: 'agent-console-dialog agent-console-rename-conversation-dialog',
        content: '!p-0 !overflow-hidden',
      },
    },
    data: {
      initialTitle: conversation.title,
      onSave: (title: string) => renameConversation(conversationId, title),
    },
  })
}

function openFeedbackDialog() {
  dialog.open(FeedbackDialog, {
    props: {
      modal: true,
      blockScroll: true,
      closeOnEscape: false,
      dismissableMask: false,
      draggable: false,
      showHeader: false,
      style: { width: 'min(520px, calc(100vw - 32px))' },
      pt: {
        root: 'agent-console-dialog agent-console-feedback-dialog',
        content: '!p-0 !overflow-hidden',
      },
    },
  })
}

function dismissOnboardingNewChatGuide() {
  onboardingNewChatGuideVisible.value = false
  onboardingNewChatGuideTarget.value = null
}

function resetOnboardingRunTracking() {
  onboardingRunRequestVersion += 1
  onboardingTrackedRunId.value = undefined
  onboardingCompletionVisible.value = false
}

async function handleOnboardingRun() {
  const requestVersion = ++onboardingRunRequestVersion
  onboardingTrackedRunId.value = undefined
  onboardingCompletionVisible.value = false

  const started = await sendPrompt({
    onRunStarted: ({ runId }) => {
      if (requestVersion === onboardingRunRequestVersion) {
        onboardingTrackedRunId.value = runId
      }
    },
  })

  if (!started && requestVersion === onboardingRunRequestVersion) {
    onboardingTrackedRunId.value = undefined
  }
}

watch(
  () => onboardingTrackedRunId.value
    ? agentConsoleState.runsById[onboardingTrackedRunId.value]?.status
    : undefined,
  () => {
    if (!isTrackedOnboardingRunTerminal(onboardingTrackedRunId.value, agentConsoleState.runsById)) {
      return
    }

    onboardingTrackedRunId.value = undefined
    onboardingCompletionVisible.value = true
  },
  { flush: 'sync' },
)

async function showOnboardingNewChatGuide() {
  await nextTick()
  const target = agentSidebarRef.value?.getNewChatElement() ?? null
  if (!target) {
    return
  }

  onboardingNewChatGuideTarget.value = target
  onboardingNewChatGuideVisible.value = true
}

async function handleStartNewChat() {
  dismissOnboardingNewChatGuide()
  await startNewChat()
  newChatFocusKey.value += 1
}

onMounted(() => {
  const handleViewportResize = () => {
    syncTaskMonitorAvailability(window.innerWidth >= TASK_MONITOR_MIN_VIEWPORT_WIDTH)
    taskMonitorWidth.value = clampTaskMonitorWidth(taskMonitorWidth.value)
    agentSidebarWidth.value = clampAgentSidebarWidth(agentSidebarWidth.value)
  }
  handleViewportResize()
  window.addEventListener('resize', handleViewportResize)
  removeTaskMonitorViewportListener = () => window.removeEventListener('resize', handleViewportResize)

  if (globalThis.isElectron) {
    removeMcpNavigateListener = globalThis.electronAPI.on('mcp:navigate', (targetPath) => {
      if (!targetPath) {
        return
      }
      void router.push(targetPath).catch(() => {})
    })

    removeMcpResourceUpdateListener = globalThis.electronAPI.on('mcp:resource-update', (data) => {
      if (data.type === 'agent') {
        agentUpdateInfo.value = data
      }
    })

    void checkAgentForUpdates()
    agentUpdateCheckTimer = setInterval(() => {
      void checkAgentForUpdates()
    }, AGENT_UPDATE_CHECK_INTERVAL_MS)
  }
})

onUnmounted(() => {
  stopTaskMonitorResize()
  stopAgentSidebarResize()
  removeTaskMonitorViewportListener?.()
  removeTaskMonitorViewportListener = null
  removeMcpNavigateListener?.()
  removeMcpNavigateListener = null
  removeMcpResourceUpdateListener?.()
  removeMcpResourceUpdateListener = null
  if (agentUpdateCheckTimer) {
    clearInterval(agentUpdateCheckTimer)
    agentUpdateCheckTimer = null
  }
})

// monitor 打开/关闭会改变 sidebar 可用最大宽度，需同步夹取以保护中间聊天区最小宽度
watch(taskMonitorVisible, () => {
  agentSidebarWidth.value = clampAgentSidebarWidth(agentSidebarWidth.value)
})

provideProfileMonitorContext(taskMonitorOpen, taskMonitorAvailable, runningTaskCount)
</script>

<template>
  <div
    class="agent-console"
    :style="agentConsoleLayoutStyle"
    :class="{
      'agent-console--monitor-open': taskMonitorVisible && !isSettingsLayout,
      'agent-console--settings': isSettingsLayout,
    }"
  >
    <AgentDeleteConfirmDialog />

    <template v-if="isSettingsLayout">
      <aside class="agent-settings-sidebar">
        <RouterLink v-slot="{ href, navigate }" custom :to="backToAppRoute">
          <a :href="href" class="agent-settings-nav-item" @click="navigate">
            <SvgIcon name="base/rx_ic_arrow_left" size="18" />
            <span>{{ $t('返回应用') }}</span>
          </a>
        </RouterLink>

        <RouterLink v-slot="{ href, isActive, navigate }" custom :to="{ name: 'agent-console-roxyclaw' }">
          <a
            :href="href"
            class="agent-settings-nav-item"
            :class="{ active: isActive }"
            @click="navigate"
          >
            <SvgIcon name="roxy-agent/rx-ic-roxyclaw" size="18" />
            <span>RoxyClaw</span>
          </a>
        </RouterLink>

        <RouterLink v-slot="{ href, isExactActive, navigate }" custom :to="{ name: 'agent-console-settings' }">
          <a
            :href="href"
            class="agent-settings-nav-item"
            :class="{ active: isExactActive }"
            @click="navigate"
          >
            <SvgIcon name="base/rx_ic_mcp" size="18" />
            <span>{{ $t('MCP 服务') }}</span>
          </a>
        </RouterLink>

        <div
          class="agent-settings-sidebar-resize-handle"
          role="separator"
          aria-orientation="vertical"
          :aria-label="$t('调整会话栏宽度')"
          :aria-valuemax="getAgentSidebarMaxWidth()"
          :aria-valuemin="AGENT_SIDEBAR_MIN_WIDTH"
          :aria-valuenow="agentSidebarWidth"
          tabindex="0"
          @keydown.left.prevent="resizeAgentSidebarBy(-16)"
          @keydown.right.prevent="resizeAgentSidebarBy(16)"
          @pointerdown="startAgentSidebarResize"
        />
      </aside>
    </template>

    <AgentSidebar
      v-else
      ref="agentSidebarRef"
      :active-conversation-id="activeConversationId"
      :conversations="conversationList"
      :has-more-conversations="conversationListHasMore"
      :loading-more-conversations="conversationListLoadingMore"
      :max-width="getAgentSidebarMaxWidth()"
      :pending-approval-conversation-ids="pendingApprovalConversationIds"
      :min-width="AGENT_SIDEBAR_MIN_WIDTH"
      :sidebar-width="agentSidebarWidth"
      :update-info="agentUpdateInfo"
      @delete-conversation="confirmDeleteConversation"
      @new-chat="handleStartNewChat"
      @open-feedback="openFeedbackDialog"
      @rename-conversation="openRenameConversationDialog"
      @resize-start="startAgentSidebarResize"
      @resize-step="resizeAgentSidebarBy"
      @restart-agent-for-update="handleRestartAgentForUpdate"
      @select-conversation="selectConversation"
      @load-more-conversations="loadMoreConversations"
    />

    <RouterView v-slot="{ Component, route: currentRoute }">
      <main
        v-if="isSettingsLayout"
        class="agent-settings-content-shell"
        :class="{ 'agent-settings-content-shell--roxyclaw': isRoxyClawSettings }"
      >
        <section
          class="agent-settings-panel"
          :class="{ 'agent-settings-panel--roxyclaw': isRoxyClawSettings }"
        >
          <component
            :is="Component"
            v-if="isRouteContextRouteName(currentRoute.name)"
            v-model:prompt="prompt"
            :active-conversation-id="activeConversationId"
            :route-title="currentRoute.meta.title"
            :thinking="isThinking"
            @send="sendPrompt"
          />
          <component :is="Component" v-else />
        </section>
      </main>

      <component
        :is="Component"
        v-else-if="isChatRouteName(currentRoute.name)"
        v-model:prompt="prompt"
        :active-conversation-id="activeConversationId"
        :conversation-title="activeConversation?.title"
        :composer-focus-key="newChatFocusKey"
        :hitl-request="activeHitlRequest"
        :messages="messageList"
        :onboarding-completion-visible="onboardingCompletionVisible"
        :has-earlier-messages="messageHistoryHasMore"
        :loading-earlier-messages="messageHistoryLoading"
        :pending-attachments="pendingAttachments"
        :queued-prompts="queuedPrompts"
        :route-title="currentRoute.meta.title"
        :thinking="isThinking"
        :todo-progress="activeTodoProgress"
        @add-attachments="addPendingAttachments"
        @add-folder="addPendingFolder"
        @add-path-attachment="addPendingPathAttachment"
        @remove-attachment="removePendingAttachment"
        @remove-queued-prompt="removeQueuedPrompt"
        @reorder-queued-prompt="reorderQueuedPrompt"
        @restore-queued-prompt="restoreQueuedPrompt"
        @load-earlier-messages="loadEarlierMessages"
        @save-template="saveTaskReportTemplate"
        @onboarding-complete="showOnboardingNewChatGuide"
        @onboarding-completion-dismiss="onboardingCompletionVisible = false"
        @onboarding-reset="resetOnboardingRunTracking"
        @onboarding-run="handleOnboardingRun"
        @send="sendPrompt"
        @stop="cancelActiveRun"
        @submit-hitl="submitHitl"
      />

      <component
        :is="Component"
        v-else-if="isRouteContextRouteName(currentRoute.name)"
        v-model:prompt="prompt"
        :active-conversation-id="activeConversationId"
        :route-title="currentRoute.meta.title"
        :thinking="isThinking"
      />

      <component
        :is="Component"
        v-else-if="isPromptRouteName(currentRoute.name)"
        v-model:prompt="prompt"
      />

      <component :is="Component" v-else />
    </RouterView>

    <ProfileMonitorPanel
      v-if="taskMonitorVisible && !isSettingsLayout"
      :groups="taskGroupList"
      :max-width="getTaskMonitorMaxWidth()"
      :min-width="TASK_MONITOR_MIN_WIDTH"
      :monitor-width="taskMonitorWidth"
      :running-count="runningTaskCount"
      @close="taskMonitorOpen = false"
      @resize-start="startTaskMonitorResize"
      @resize-step="resizeTaskMonitorBy"
      @toggle-group="toggleTaskGroup"
    />

    <SelectWindowGuide
      callout-below-target
      interactive-target
      :label="$t('点击新对话继续体验')"
      :target="onboardingNewChatGuideTarget"
      :visible="onboardingNewChatGuideVisible"
      @dismiss="dismissOnboardingNewChatGuide"
    />
  </div>
</template>

<style lang="scss" scoped>
:global(body.agent-console-window) {
  --component-scrollbar-bg: transparent;
  --component-scrollbar-indicator: var(--color-bg-quaternary);
  --component-scrollbar-indicator-container-hover: rgb(214, 214, 214);
}

:global([data-theme='dark'] body.agent-console-window),
:global(body.agent-console-window[data-theme='dark']) {
  --component-scrollbar-indicator-container-hover: rgb(82, 82, 82);
}

:global(body.agent-console-window *) {
  scrollbar-color: var(--component-scrollbar-indicator) var(--component-scrollbar-bg);
  scrollbar-width: thin;
}

:global(body.agent-console-window *:hover) {
  scrollbar-color: var(--component-scrollbar-indicator-container-hover) var(--component-scrollbar-bg);
}

:global(body.agent-console-window *::-webkit-scrollbar) {
  background: transparent;
}

:global(body.agent-console-window *::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: var(--component-scrollbar-indicator);
}

:global(body.agent-console-window *:hover::-webkit-scrollbar-thumb) {
  background: var(--component-scrollbar-indicator-container-hover);
}

:global(body.agent-console-window *::-webkit-scrollbar-track) {
  background: var(--component-scrollbar-bg);
}

:global(body.agent-console-window *::-webkit-scrollbar-track-piece) {
  background: var(--component-scrollbar-bg);
}

:global(body.agent-console-window *::-webkit-scrollbar-corner) {
  background: var(--component-scrollbar-bg);
}

:global(body.agent-console-window--resizing-monitor),
:global(body.agent-console-window--resizing-monitor *),
:global(body.agent-console-window--resizing-sidebar),
:global(body.agent-console-window--resizing-sidebar *) {
  cursor: col-resize !important;
  user-select: none !important;
}

.agent-console {
  display: grid;
  grid-template-columns: var(--agent-sidebar-width, 220px) minmax(460px, 1fr);
  width: 100vw;
  height: 100vh;
  height: 100svh;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  overflow: hidden;
}

.agent-console--monitor-open {
  grid-template-columns: var(--agent-sidebar-width, 220px) minmax(460px, 1fr) var(--task-monitor-width, 320px);
}

.agent-console--settings {
  grid-template-columns: var(--agent-sidebar-width, 220px) minmax(460px, 1fr);
}

.agent-settings-sidebar {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 1px;
  padding: 16px;
  background: var(--color-bg-tertiary, var(--color-bg-quaternary));
}

.agent-settings-sidebar-resize-handle {
  position: absolute;
  z-index: 2;
  top: 16px;
  right: -5px;
  bottom: 16px;
  width: 10px;
  border-radius: 999px;
  cursor: col-resize;
  outline: none;

  &::after {
    position: absolute;
    top: 0;
    right: 4px;
    bottom: 0;
    width: 2px;
    border-radius: inherit;
    background: transparent;
    content: '';
    transition: background-color 0.16s ease;
  }

  &:hover::after,
  &:focus-visible::after {
    background: var(--color-border-primary);
  }
}

.agent-settings-nav-item {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 10px;
  color: var(--color-text-primary, var(--color-text-primary));
  font-size: 14px;
  line-height: 20px;
  text-decoration: none;

  &:hover,
  &.active {
    background: var(--color-bg-tertiary-hover, var(--color-border-secondary));
  }
}

.agent-settings-content-shell {
  min-width: 0;
  min-height: 0;
  padding: 10px 10px 10px 0;
  background: var(--color-bg-tertiary, var(--color-bg-quaternary));
  overflow: hidden;
}

.agent-settings-panel {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 58px 64px 40px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 16px;
  background: var(--color-bg-primary, var(--color-bg-primary));
  overflow: auto;
}

.agent-settings-content-shell--roxyclaw {
  padding: 0;
}

.agent-settings-panel--roxyclaw {
  padding: 0;
  border: 0;
  background: transparent;
  overflow: hidden;
}

@media (max-width: 1180px) {
  .agent-console {
    grid-template-columns: var(--agent-sidebar-width, 220px) minmax(420px, 1fr);
  }

  .agent-console--settings {
    grid-template-columns: var(--agent-sidebar-width, 220px) minmax(420px, 1fr);
  }

  .agent-console :deep(.task-monitor) {
    display: none;
  }
}

@media (max-width: 860px) {
  .agent-console {
    grid-template-columns: 1fr;
  }

  .agent-console :deep(.agent-sidebar) {
    display: none;
  }

  .agent-console--settings {
    grid-template-columns: 1fr;
  }

  .agent-settings-sidebar {
    display: none;
  }

  .agent-settings-content-shell {
    padding: 0;
  }

  .agent-settings-panel {
    border-radius: 0;
    padding: 32px 16px;
  }

  .agent-settings-panel--roxyclaw {
    padding: 0;
  }
}
</style>
