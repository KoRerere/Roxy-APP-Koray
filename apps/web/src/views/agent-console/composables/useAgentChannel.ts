import type {
  AgentChannelClientMessageMap,
  AgentChannelClientMessageType,
  AgentChannelMessage,
  AgentTaskExecutionReplay,
} from '@roxy/shared/channel'
import {
  AgentChannelClientMessageSchema,
  AgentChannelMessageSchema,
} from '@roxy/shared/channel'
import { useAgentStore } from '/@/stores/agent'
import {
  applyAgentChannelMessage,
  createAgentChannelDedupState,
  resetAgentChannelMonitorSnapshots,
  replaceTaskExecutionReplays,
  type AgentChannelDataState,
} from '../agent-channel-state'
import { createPerfTimer, perfLog } from '/@/utils/perf-log'

type AgentChannelStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
type AgentStore = ReturnType<typeof useAgentStore>

interface AgentChannelState extends AgentChannelDataState {
  status: AgentChannelStatus
  lastError?: string
}

const RECONNECT_BASE_DELAY_MS = 500
const RECONNECT_MAX_DELAY_MS = 15_000
const CONNECTED_WAIT_TIMEOUT_MS = 15_000
const state = reactive<AgentChannelState>({
  status: 'disconnected',
  taskLogs: [],
  taskLogsReady: false,
  taskExecutionDetails: {},
  taskExecutionReady: false,
  taskExecutionGapDetected: false,
})

const dedupState = createAgentChannelDedupState()
let socket: WebSocket | undefined
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let boundServerUrl = ''
let reconnectAttempt = 0
let connectionGeneration = 0
let shouldReconnect = false
let activeAgentStore: AgentStore | undefined
let taskExecutionCalibration = 0
let bufferedTaskExecutionMessages: Array<AgentChannelMessage<'task_execution.event'>> = []
let recentConversationRunMessages: Array<AgentChannelMessage<'conversation.run.event'>> = []
const messageListeners = new Set<(message: AgentChannelMessage) => void>()
const MAX_RECENT_CONVERSATION_RUN_MESSAGES = 500
let connectedWaitPromise: Promise<void> | undefined
let connectedWaitTimeout: ReturnType<typeof setTimeout> | undefined
let rejectConnectedWait: ((reason?: unknown) => void) | undefined

function notifyMessageListeners(message: AgentChannelMessage): void {
  for (const listener of messageListeners) {
    try {
      listener(message)
    }
    catch (error) {
      console.error('[agent-channel] Message listener failed:', error)
    }
  }
}

function sendAgentChannelMessage<T extends AgentChannelClientMessageType>(
  type: T,
  data: AgentChannelClientMessageMap[T],
): string | undefined {
  const allowWhileConnecting = type === 'conversation.run.stop'
    || type === 'conversation.approval.submit'
    || type === 'execution.control'

  if (socket?.readyState !== WebSocket.OPEN)
    return undefined

  if (!allowWhileConnecting && state.status !== 'connected')
    return undefined

  const id = crypto.randomUUID()
  const parsed = AgentChannelClientMessageSchema.safeParse({ id, type, data })
  if (!parsed.success)
    return undefined
  socket.send(JSON.stringify(parsed.data))
  return id
}

function waitUntilConnected(timeoutMs = CONNECTED_WAIT_TIMEOUT_MS): Promise<void> {
  if (state.status === 'connected') {
    return Promise.resolve()
  }
  if (state.status === 'disconnected') {
    return Promise.reject(new Error('Agent WebSocket is not ready'))
  }
  if (connectedWaitPromise) {
    return connectedWaitPromise
  }

  connectedWaitPromise = new Promise<void>((resolve, reject) => {
    rejectConnectedWait = reject
    const stop = watch(
      () => state.status,
      (status) => {
        if (status === 'connected') {
          cleanup()
          resolve()
          return
        }
        if (status === 'disconnected') {
          cleanup()
          reject(new Error('Agent WebSocket is not ready'))
        }
      },
      { immediate: true },
    )

    connectedWaitTimeout = setTimeout(() => {
      cleanup()
      reject(new Error('Agent WebSocket is not ready'))
    }, timeoutMs)

    function cleanup() {
      stop()
      if (connectedWaitTimeout !== undefined)
        clearTimeout(connectedWaitTimeout)
      connectedWaitTimeout = undefined
      rejectConnectedWait = undefined
      connectedWaitPromise = undefined
    }
  })

  return connectedWaitPromise
}

function subscribeAgentChannelMessages(listener: (message: AgentChannelMessage) => void): () => void {
  messageListeners.add(listener)
  for (const message of recentConversationRunMessages) {
    try {
      listener(message)
    }
    catch (error) {
      console.error('[agent-channel] Message listener failed:', error)
    }
  }
  return () => messageListeners.delete(listener)
}

function rememberConversationRunMessage(message: AgentChannelMessage<'conversation.run.event'>): void {
  recentConversationRunMessages.push(message)
  if (recentConversationRunMessages.length > MAX_RECENT_CONVERSATION_RUN_MESSAGES)
    recentConversationRunMessages = recentConversationRunMessages.slice(-MAX_RECENT_CONVERSATION_RUN_MESSAGES)
}

function toWebSocketUrl(serverUrl: string): string {
  const url = new URL(serverUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/api/events'
  url.search = ''
  url.hash = ''
  return url.toString()
}

function clearReconnectTimer(): void {
  if (reconnectTimer)
    clearTimeout(reconnectTimer)
  reconnectTimer = undefined
}

function replayTaskIds(): string[] {
  return Array.from(new Set([
    ...state.taskLogs
      .filter(log => log.status === 'preparing' || log.status === 'running')
      .map(log => log.id),
    ...state.taskLogs.slice(0, 5).map(log => log.id),
  ]))
}

async function fetchTaskExecutionReplay(
  serverUrl: string,
  taskLogId: string,
): Promise<AgentTaskExecutionReplay | null> {
  const url = new URL(`/api/tasks/logs/${encodeURIComponent(taskLogId)}/replay`, serverUrl)
  const response = await fetch(url)
  if (response.status === 404)
    return null
  const result = await response.json() as {
    code?: number
    msg?: string
    data?: AgentTaskExecutionReplay
  }
  if (!response.ok || result.code !== 0 || !result.data)
    throw new Error(result.msg || `Task execution replay failed (${response.status})`)
  return result.data
}

async function calibrateTaskExecutions(generation: number): Promise<void> {
  const serverUrl = boundServerUrl
  const calibration = ++taskExecutionCalibration
  state.taskExecutionReady = false
  state.taskExecutionGapDetected = false
  try {
    const replays = (await Promise.all(
      replayTaskIds().map(taskLogId => fetchTaskExecutionReplay(serverUrl, taskLogId)),
    )).filter((item): item is AgentTaskExecutionReplay => Boolean(item))
    if (generation !== connectionGeneration || calibration !== taskExecutionCalibration)
      return

    replaceTaskExecutionReplays(state, replays)
    const buffered = bufferedTaskExecutionMessages
    bufferedTaskExecutionMessages = []
    for (const message of buffered)
      applyAgentChannelMessage(state, dedupState, message)
    if (state.taskExecutionGapDetected)
      throw new Error('Agent WebSocket task execution sequence gap')
  }
  catch (error) {
    if (generation !== connectionGeneration || calibration !== taskExecutionCalibration)
      return
    state.lastError = error instanceof Error ? error.message : String(error)
    setTimeout(reconnectAgentChannel, 0)
  }
}

function scheduleReconnect(generation: number): void {
  if (!shouldReconnect || generation !== connectionGeneration || reconnectTimer)
    return
  state.status = 'reconnecting'
  const exponentialDelay = Math.min(
    RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt,
    RECONNECT_MAX_DELAY_MS,
  )
  const jitteredDelay = Math.round(exponentialDelay * (0.75 + Math.random() * 0.5))
  reconnectAttempt++
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined
    if (shouldReconnect && generation === connectionGeneration)
      connect(generation)
  }, jitteredDelay)
}

function connect(generation: number): void {
  if (!boundServerUrl || generation !== connectionGeneration)
    return
  const endConnect = createPerfTimer('agent-channel:connect', { generation, boundServerUrl })
  state.status = reconnectAttempt > 0 ? 'reconnecting' : 'connecting'
  activeAgentStore?.markAgentChannelConnecting()
  const nextSocket = new WebSocket(toWebSocketUrl(boundServerUrl))
  socket = nextSocket

  nextSocket.onopen = () => {
    if (generation !== connectionGeneration) {
      nextSocket.close()
      return
    }
    state.lastError = undefined
    perfLog('agent-channel:onopen', { generation })
  }

  nextSocket.onmessage = (event) => {
    if (generation !== connectionGeneration || typeof event.data !== 'string')
      return
    try {
      const parsed = AgentChannelMessageSchema.safeParse(JSON.parse(event.data))
      if (parsed.success) {
        const message = parsed.data
        if (message.type === 'task_execution.event' && !state.taskExecutionReady) {
          bufferedTaskExecutionMessages.push(message)
          return
        }
        if (!applyAgentChannelMessage(state, dedupState, message))
          return
        if (message.type === 'conversation.run.event')
          rememberConversationRunMessage(message)
        if (state.taskExecutionGapDetected) {
          state.lastError = 'Agent WebSocket task execution sequence gap'
          void calibrateTaskExecutions(generation)
          return
        }
        if (message.type === 'channel.ready') {
          reconnectAttempt = 0
          state.status = 'connected'
          activeAgentStore?.markAgentChannelReady()
          perfLog('agent-channel:ready', { generation })
          void calibrateTaskExecutions(generation)
        }
        notifyMessageListeners(message)
      }
    }
    catch (error) {
      console.warn('[agent-channel] Failed to parse message:', error)
    }
  }

  nextSocket.onerror = () => {
    if (generation === connectionGeneration)
      state.lastError = 'Agent WebSocket connection failed'
  }

  nextSocket.onclose = () => {
    if (socket === nextSocket)
      socket = undefined
    if (shouldReconnect && generation === connectionGeneration) {
      const error = state.lastError ?? 'Agent WebSocket connection closed'
      state.lastError = error
      activeAgentStore?.markAgentChannelFailure(error)
    }
    scheduleReconnect(generation)
    endConnect({
      generation,
      status: state.status,
    })
  }
}

function startAgentChannel(serverUrl: string): void {
  if (shouldReconnect && boundServerUrl === serverUrl)
    return
  stopAgentChannel(false)
  shouldReconnect = true
  boundServerUrl = serverUrl
  perfLog('agent-channel:start', { serverUrl })
  state.taskLogsReady = false
  state.taskExecutionReady = false
  state.taskExecutionGapDetected = false
  resetAgentChannelMonitorSnapshots(state)
  bufferedTaskExecutionMessages = []
  recentConversationRunMessages = []
  state.lastError = undefined
  const generation = ++connectionGeneration
  connect(generation)
}

function reconnectAgentChannel(): void {
  const serverUrl = boundServerUrl
  if (!serverUrl)
    return
  stopAgentChannel(false)
  startAgentChannel(serverUrl)
}

function stopAgentChannel(notifyStore = true): void {
  shouldReconnect = false
  boundServerUrl = ''
  perfLog('agent-channel:stop')
  rejectConnectedWait?.(new Error('Agent WebSocket is not ready'))
  reconnectAttempt = 0
  taskExecutionCalibration++
  bufferedTaskExecutionMessages = []
  recentConversationRunMessages = []
  connectionGeneration++
  clearReconnectTimer()
  const currentSocket = socket
  socket = undefined
  currentSocket?.close(1000, 'Agent console closed')
  state.status = 'disconnected'
  if (notifyStore)
    activeAgentStore?.markAgentChannelStopped()
}

export function useAgentChannelState() {
  return {
    connected: computed(() => state.status === 'connected'),
    lastError: computed(() => state.lastError),
    reconnect: reconnectAgentChannel,
    send: sendAgentChannelMessage,
    waitUntilConnected,
    status: computed(() => state.status),
    subscribe: subscribeAgentChannelMessages,
    taskLogs: computed(() => state.taskLogs),
    taskLogsReady: computed(() => state.taskLogsReady),
    taskExecutionDetails: computed(() => state.taskExecutionDetails),
    taskExecutionReady: computed(() => state.taskExecutionReady),
    taskMonitorSnapshot: computed(() => state.taskMonitorSnapshot),
    profileMonitorSnapshot: computed(() => state.profileMonitorSnapshot),
    executionCenterSnapshot: computed(() => state.executionCenterSnapshot),
    controlExecution: (executionId: string, action: 'cancel' | 'pause' | 'resume') =>
      sendAgentChannelMessage('execution.control', { executionId, action }),
  }
}

export function useAgentChannel() {
  const agentStore = useAgentStore()
  activeAgentStore = agentStore

  watch(
    () => agentStore.serverUrl,
    (serverUrl) => {
      if (serverUrl)
        startAgentChannel(serverUrl)
      else
        stopAgentChannel()
    },
    { immediate: true },
  )

  onMounted(() => {
    void agentStore.initMcp().catch((error) => {
      console.error('[agent-channel] Agent failed to become ready:', error)
    })
  })

  onBeforeUnmount(() => {
    stopAgentChannel()
  })

  return useAgentChannelState()
}
