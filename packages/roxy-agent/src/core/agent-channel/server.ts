import type { TaskLogStoreEvent } from '@/database/tasks'
import type {
  AgentChannelClientMessage,
  AgentChannelMessage,
  AgentChannelMessageMap,
  AgentChannelMessageType,
  AgentConversationRunEventDTO,
  AgentProfileMonitorSnapshot,
  AgentTaskExecutionEvent,
  AgentTaskLogDTO,
  AgentTaskMonitorSnapshot,
} from '@roxy/shared/channel'
import type { Buffer } from 'node:buffer'
import type { Server as HttpServer, IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import {
  AgentChannelClientMessageSchema,
  AgentChannelMessageSchema,
} from '@roxy/shared/channel'
import { randomBytes } from 'node:crypto'
import { WebSocket, WebSocketServer } from 'ws'
import { runEventHub } from '@/core/agent-events/runEventHub'
import { streamEvents } from '@/core/agent-events/streamEvents'
import { abortRun } from '@/core/registry/abortRegistry'
import { executionCenter } from '@/core/registry/executionCenter'
import { mcpManager } from '@/core/mcp/mcpManager'
import { cancelInterrupt, resolveInterrupt } from '@/core/registry/interruptRegistry'
import { getMigrationStatus } from '@/core/storage/migrate'
import { profileMonitorHub } from '@/core/task-monitor'
import { taskLogStore } from '@/database/tasks'
import { startConversationRun } from '@/services/chatService'
import { taskExecutionDetailHub } from '@/services/taskExecutionDetails'
import { listAllTaskLogs, toTaskLogDTO } from '@/services/taskService'

const CHANNEL_PATH = '/api/events'
const HEARTBEAT_INTERVAL_MS = 30_000
const MIGRATION_READY_POLL_INTERVAL_MS = 100
const PROFILE_MONITOR_POLL_INTERVAL_MS = 5_000

/** Generate a sortable UUIDv7 using Node's built-in crypto primitives. */
function uuidv7(): string {
  const bytes = randomBytes(16)
  const timestamp = BigInt(Date.now())
  for (let index = 0; index < 6; index++) {
    bytes[index] = Number((timestamp >> BigInt((5 - index) * 8)) & 0xFFn)
  }
  bytes[6] = (bytes[6] & 0x0F) | 0x70
  bytes[8] = (bytes[8] & 0x3F) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

type AliveWebSocket = WebSocket & {
  isAlive: boolean
  isInitialized: boolean
  pendingMessages: AgentChannelMessage[]
}

interface TaskMonitorSource {
  getSnapshot: () => AgentTaskMonitorSnapshot
  subscribe: (callback: (snapshot: AgentTaskMonitorSnapshot) => void) => () => void
  getProfileSnapshot?: () => AgentProfileMonitorSnapshot
  subscribeProfiles?: (callback: (snapshot: AgentProfileMonitorSnapshot) => void) => () => void
  syncConnections?: (connections: Awaited<ReturnType<typeof mcpManager.listOpenProfiles>>) => void
}

interface TaskLogEventSource {
  subscribe: (callback: (event: TaskLogStoreEvent) => void) => () => void
}

interface TaskExecutionEventSource {
  subscribe: (callback: (event: AgentTaskExecutionEvent) => void) => () => void
}

interface ConversationRunEventSource {
  getActiveEvents?: () => AgentConversationRunEventDTO[]
  subscribe: (callback: (event: AgentConversationRunEventDTO) => void) => () => void
}

interface ExecutionCenterSource {
  getSnapshot: () => ReturnType<typeof executionCenter.snapshot>
  subscribe: (callback: (snapshot: ReturnType<typeof executionCenter.snapshot>) => void) => () => void
}

export interface AgentChannelSources {
  taskMonitor: TaskMonitorSource
  taskLogs: TaskLogEventSource
  taskExecution: TaskExecutionEventSource
  conversationRuns?: ConversationRunEventSource
  executionCenter?: ExecutionCenterSource
  getTaskLogSnapshot: () => AgentTaskLogDTO[]
}

export interface AgentChannelCommands {
  startRun: (command: AgentChannelClientMessage<'conversation.run.start'>) => void | Promise<void>
  stopRun: (command: AgentChannelClientMessage<'conversation.run.stop'>) => void | Promise<void>
  submitApproval: (command: AgentChannelClientMessage<'conversation.approval.submit'>) => void | Promise<void>
  controlExecution?: (command: AgentChannelClientMessage<'execution.control'>) => void | Promise<void>
}

function getDefaultTaskLogSnapshot(): AgentTaskLogDTO[] {
  return listAllTaskLogs()
}

const defaultSources: AgentChannelSources = {
  taskMonitor: profileMonitorHub,
  taskLogs: taskLogStore,
  taskExecution: taskExecutionDetailHub,
  conversationRuns: runEventHub,
  executionCenter,
  getTaskLogSnapshot: getDefaultTaskLogSnapshot,
}

const defaultCommands: AgentChannelCommands = {
  startRun: command => startConversationRun(command.data, command.id),
  stopRun: (command) => {
    const { conversationId } = command.data
    cancelInterrupt(conversationId)

    const publisher = runEventHub.getActive(conversationId)
    if (!publisher) {
      console.warn(`[agent-channel] Cannot stop inactive conversation ${conversationId}`)
      return
    }

    void executionCenter.cancelByConversation(conversationId, 'user')
    const aborted = abortRun(publisher.identity.runId)
    publisher.publish(streamEvents.cancelled({ message: 'Agent stopped: User cancelled' }))

    if (!aborted) {
      console.warn(`[agent-channel] Missing abort controller for run ${publisher.identity.runId}`)
    }
  },
  submitApproval: (command) => {
    const publisher = runEventHub.getActive(command.data.conversationId)
    if (!publisher || publisher.pendingApprovalId !== command.data.approvalId) {
      return
    }

    const decisionRequestsFullAccess = command.data.decisions.some((decision) => {
      return Boolean(decision && typeof decision === 'object' && 'fullAccess' in decision
        && (decision as { fullAccess?: unknown }).fullAccess === true)
    })
    resolveInterrupt(command.data.conversationId, {
      decisions: command.data.decisions as any,
      ...(command.data.fullAccess || decisionRequestsFullAccess ? { fullAccess: true } : {}),
    })
  },
  controlExecution: (command) => {
    const { executionId, action } = command.data
    if (action === 'cancel') {
      void executionCenter.cancel(executionId, 'user')
    }
    else if (action === 'pause') {
      executionCenter.pause(executionId)
    }
    else {
      executionCenter.resume(executionId)
    }
  },
}

function createMessage<T extends AgentChannelMessageType>(
  type: T,
  data: AgentChannelMessageMap[T],
): AgentChannelMessage<T> {
  return AgentChannelMessageSchema.parse({ id: uuidv7(), type, data }) as AgentChannelMessage<T>
}

function canHandleBeforeInitialization(command: AgentChannelClientMessage): boolean {
  return command.type === 'conversation.run.stop'
    || command.type === 'conversation.approval.submit'
    || command.type === 'execution.control'
}

function canSendBeforeInitialization(message: AgentChannelMessage): boolean {
  return message.type === 'conversation.run.event'
}

async function waitForStorageMigration(): Promise<void> {
  while (getMigrationStatus().state === 'running') {
    await new Promise(resolve => setTimeout(resolve, MIGRATION_READY_POLL_INTERVAL_MS))
  }
}

export class AgentChannelServer {
  private readonly webSocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
    perMessageDeflate: false,
  })

  private readonly heartbeatTimer: ReturnType<typeof setInterval>
  private readonly unsubscribeTaskMonitor: () => void
  private readonly unsubscribeProfileMonitor: () => void
  private readonly unsubscribeTaskLogs: () => void
  private readonly unsubscribeTaskExecution: () => void
  private readonly unsubscribeConversationRuns: () => void
  private readonly unsubscribeExecutionCenter: () => void
  private closed = false
  private profilePollTimer?: ReturnType<typeof setInterval>
  private profileRefresh?: Promise<void>

  constructor(
    private readonly httpServer: HttpServer,
    private readonly sources: AgentChannelSources = defaultSources,
    heartbeatIntervalMs = HEARTBEAT_INTERVAL_MS,
    private readonly waitUntilReady: () => Promise<void> = waitForStorageMigration,
    private readonly commands: AgentChannelCommands = defaultCommands,
  ) {
    this.httpServer.on('upgrade', this.handleUpgrade)
    this.webSocketServer.on('connection', this.handleConnection)

    this.unsubscribeTaskMonitor = this.sources.taskMonitor.subscribe((snapshot) => {
      this.broadcast(createMessage('task_monitor.snapshot', snapshot))
    })
    this.unsubscribeProfileMonitor = this.sources.taskMonitor.subscribeProfiles?.((snapshot) => {
      this.broadcast(createMessage('profile_monitor.snapshot', snapshot))
    }) ?? (() => {})

    this.unsubscribeTaskLogs = this.sources.taskLogs.subscribe((event) => {
      if (event.type === 'changed') {
        this.broadcast(createMessage('task_log.changed', toTaskLogDTO(event.log)))
      }
      else {
        this.broadcast(createMessage('task_log.deleted', { logId: event.logId }))
      }
    })

    this.unsubscribeTaskExecution = this.sources.taskExecution.subscribe((event) => {
      this.broadcast(createMessage('task_execution.event', event))
    })

    this.unsubscribeConversationRuns = (this.sources.conversationRuns ?? runEventHub).subscribe((event) => {
      this.broadcast(createMessage('conversation.run.event', event))
    })
    this.unsubscribeExecutionCenter = (this.sources.executionCenter ?? executionCenter).subscribe((snapshot) => {
      this.broadcast(createMessage('execution_center.snapshot', snapshot))
    })

    this.heartbeatTimer = setInterval(() => this.heartbeat(), heartbeatIntervalMs)
    this.heartbeatTimer.unref?.()
  }

  async close(): Promise<void> {
    if (this.closed) {
      return
    }

    this.closed = true
    clearInterval(this.heartbeatTimer)
    this.unsubscribeTaskMonitor()
    this.unsubscribeProfileMonitor()
    this.stopProfilePolling()
    this.unsubscribeTaskLogs()
    this.unsubscribeTaskExecution()
    this.unsubscribeConversationRuns()
    this.unsubscribeExecutionCenter()

    this.httpServer.off('upgrade', this.handleUpgrade)
    for (const client of this.webSocketServer.clients) {
      client.terminate()
    }

    await new Promise<void>((resolve, reject) => {
      this.webSocketServer.close(error => error ? reject(error) : resolve())
    })
  }

  private readonly handleUpgrade = (request: IncomingMessage, socket: Socket, head: Buffer): void => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    if (pathname !== CHANNEL_PATH) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
      socket.destroy()
      return
    }

    this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      this.webSocketServer.emit('connection', webSocket, request)
    })
  }

  private readonly handleConnection = (webSocket: WebSocket): void => {
    const client = webSocket as AliveWebSocket
    client.isAlive = true
    client.isInitialized = false
    client.pendingMessages = []

    client.on('pong', () => {
      client.isAlive = true
    })

    client.on('error', (error) => {
      console.warn('[agent-channel] WebSocket client error:', error)
    })

    client.on('message', (data, isBinary) => {
      if (isBinary) {
        return
      }
      this.handleClientMessage(data.toString(), client)
    })
    client.on('close', () => {
      if (![...this.webSocketServer.clients].some(socket => socket.readyState === WebSocket.OPEN)) {
        this.stopProfilePolling()
      }
    })
    this.sendActiveConversationRuns(client)
    void this.initializeClient(client)
  }

  private handleClientMessage(raw: string, client: AliveWebSocket): void {
    let value: unknown
    try {
      value = JSON.parse(raw)
    }
    catch {
      return
    }

    const parsed = AgentChannelClientMessageSchema.safeParse(value)
    if (!parsed.success) {
      return
    }

    const command = parsed.data
    if (!client.isInitialized && !canHandleBeforeInitialization(command)) {
      return
    }

    if (command.type === 'conversation.run.start') {
      this.runCommand(command.type, () => this.commands.startRun(command))
    }
    else if (command.type === 'conversation.run.stop') {
      this.runCommand(command.type, () => this.commands.stopRun(command))
    }
    else if (command.type === 'conversation.approval.submit') {
      this.runCommand(command.type, () => this.commands.submitApproval(command))
    }
    else {
      this.runCommand(command.type, () => (this.commands.controlExecution ?? defaultCommands.controlExecution!)(command))
    }
  }

  private runCommand(type: AgentChannelClientMessage['type'], execute: () => void | Promise<void>): void {
    void Promise.resolve()
      .then(execute)
      .catch((error) => {
        console.warn(`[agent-channel] Failed to handle ${type}:`, error)
      })
  }

  private async initializeClient(client: AliveWebSocket): Promise<void> {
    await this.waitUntilReady()
    if (client.readyState !== WebSocket.OPEN) {
      return
    }

    let taskLogs: AgentTaskLogDTO[]
    let taskMonitor: AgentTaskMonitorSnapshot
    let executionSnapshot: ReturnType<typeof executionCenter.snapshot>
    let profileMonitor: AgentProfileMonitorSnapshot | undefined
    try {
      await this.refreshOpenProfiles()
      taskLogs = this.sources.getTaskLogSnapshot()
      taskMonitor = this.sources.taskMonitor.getSnapshot()
      profileMonitor = this.sources.taskMonitor.getProfileSnapshot?.()
      executionSnapshot = (this.sources.executionCenter ?? executionCenter).getSnapshot()
    }
    catch (error) {
      console.warn('[agent-channel] Failed to create initial snapshots:', error)
      client.close(1011, 'Initial snapshot unavailable')
      return
    }

    this.send(client, createMessage('task_logs.snapshot', { items: taskLogs }))
    this.send(client, createMessage('task_monitor.snapshot', taskMonitor))
    if (profileMonitor) {
      client.pendingMessages = client.pendingMessages.filter(message => message.type !== 'profile_monitor.snapshot')
      this.send(client, createMessage('profile_monitor.snapshot', profileMonitor))
    }
    this.send(client, createMessage('execution_center.snapshot', executionSnapshot))
    client.isInitialized = true
    for (const message of client.pendingMessages) {
      this.send(client, message)
    }
    client.pendingMessages = []
    this.send(client, createMessage('channel.ready', { connectedAt: new Date().toISOString() }))
    this.startProfilePolling()
  }

  private heartbeat(): void {
    for (const socket of this.webSocketServer.clients) {
      const client = socket as AliveWebSocket
      if (!client.isAlive) {
        client.terminate()
        continue
      }

      client.isAlive = false
      client.ping()
    }
  }

  private startProfilePolling(): void {
    if (this.profilePollTimer || !this.sources.taskMonitor.syncConnections) return
    void this.refreshOpenProfiles()
    this.profilePollTimer = setInterval(() => void this.refreshOpenProfiles(), PROFILE_MONITOR_POLL_INTERVAL_MS)
    this.profilePollTimer.unref?.()
  }

  private stopProfilePolling(): void {
    if (!this.profilePollTimer) return
    clearInterval(this.profilePollTimer)
    this.profilePollTimer = undefined
  }

  private refreshOpenProfiles(): Promise<void> {
    if (!this.sources.taskMonitor.syncConnections) return Promise.resolve()
    if (!this.profileRefresh) {
      this.profileRefresh = (async () => {
        try {
          const connections = await mcpManager.listOpenProfiles()
          await mcpManager.reconcileOpenProfiles(connections)
          this.sources.taskMonitor.syncConnections?.(connections)
        }
        catch (error) {
          console.warn('[profile-monitor] Failed to refresh open profiles:', error instanceof Error ? error.message : String(error))
        }
      })().finally(() => {
        this.profileRefresh = undefined
      })
    }
    return this.profileRefresh
  }

  private broadcast(message: AgentChannelMessage): void {
    for (const socket of this.webSocketServer.clients) {
      const client = socket as AliveWebSocket
      if (client.isInitialized || canSendBeforeInitialization(message)) {
        this.send(client, message)
      }
      else {
        client.pendingMessages.push(message)
      }
    }
  }

  private sendActiveConversationRuns(client: AliveWebSocket): void {
    for (const event of this.sources.conversationRuns?.getActiveEvents?.() ?? []) {
      this.send(client, createMessage('conversation.run.event', event))
    }
  }

  private send(client: WebSocket, message: AgentChannelMessage): void {
    if (client.readyState !== WebSocket.OPEN) {
      return
    }
    client.send(JSON.stringify(message))
  }
}
