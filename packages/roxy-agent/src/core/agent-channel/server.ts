import type { TaskLogStoreEvent } from '@/database/tasks'
import type {
  AgentChannelClientMessage,
  AgentChannelMessage,
  AgentChannelMessageMap,
  AgentChannelMessageType,
  AgentConversationRunEventDTO,
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
import { v7 as uuidv7 } from 'uuid'
import { WebSocket, WebSocketServer } from 'ws'
import { runEventHub } from '@/core/agent-events/runEventHub'
import { streamEvents } from '@/core/agent-events/streamEvents'
import { abortRun } from '@/core/registry/abortRegistry'
import { cancelInterrupt, resolveInterrupt } from '@/core/registry/interruptRegistry'
import { getMigrationStatus } from '@/core/storage/migrate'
import { taskMonitorHub } from '@/core/task-monitor'
import { taskLogStore } from '@/database/tasks'
import { startConversationRun } from '@/services/chatService'
import { taskExecutionDetailHub } from '@/services/taskExecutionDetails'
import { listAllTaskLogs, toTaskLogDTO } from '@/services/taskService'

const CHANNEL_PATH = '/api/events'
const HEARTBEAT_INTERVAL_MS = 30_000
const MIGRATION_READY_POLL_INTERVAL_MS = 100

type AliveWebSocket = WebSocket & {
  isAlive: boolean
  isInitialized: boolean
  pendingMessages: AgentChannelMessage[]
}

interface TaskMonitorSource {
  getSnapshot: () => AgentTaskMonitorSnapshot
  subscribe: (callback: (snapshot: AgentTaskMonitorSnapshot) => void) => () => void
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

export interface AgentChannelSources {
  taskMonitor: TaskMonitorSource
  taskLogs: TaskLogEventSource
  taskExecution: TaskExecutionEventSource
  conversationRuns?: ConversationRunEventSource
  getTaskLogSnapshot: () => AgentTaskLogDTO[]
}

export interface AgentChannelCommands {
  startRun: (command: AgentChannelClientMessage<'conversation.run.start'>) => void | Promise<void>
  stopRun: (command: AgentChannelClientMessage<'conversation.run.stop'>) => void | Promise<void>
  submitApproval: (command: AgentChannelClientMessage<'conversation.approval.submit'>) => void | Promise<void>
}

function getDefaultTaskLogSnapshot(): AgentTaskLogDTO[] {
  return listAllTaskLogs()
}

const defaultSources: AgentChannelSources = {
  taskMonitor: taskMonitorHub,
  taskLogs: taskLogStore,
  taskExecution: taskExecutionDetailHub,
  conversationRuns: runEventHub,
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

    resolveInterrupt(command.data.conversationId, { decisions: command.data.decisions as any })
  },
}

function createMessage<T extends AgentChannelMessageType>(
  type: T,
  data: AgentChannelMessageMap[T],
): AgentChannelMessage<T> {
  return AgentChannelMessageSchema.parse({ id: uuidv7(), type, data }) as AgentChannelMessage<T>
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
  private readonly unsubscribeTaskLogs: () => void
  private readonly unsubscribeTaskExecution: () => void
  private readonly unsubscribeConversationRuns: () => void
  private closed = false

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
    this.unsubscribeTaskLogs()
    this.unsubscribeTaskExecution()
    this.unsubscribeConversationRuns()

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
      if (isBinary || !client.isInitialized)
        return
      this.handleClientMessage(data.toString())
    })
    void this.initializeClient(client)
  }

  private handleClientMessage(raw: string): void {
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
    if (command.type === 'conversation.run.start') {
      this.runCommand(command.type, () => this.commands.startRun(command))
    }
    else if (command.type === 'conversation.run.stop') {
      this.runCommand(command.type, () => this.commands.stopRun(command))
    }
    else {
      this.runCommand(command.type, () => this.commands.submitApproval(command))
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
    try {
      taskLogs = this.sources.getTaskLogSnapshot()
      taskMonitor = this.sources.taskMonitor.getSnapshot()
    }
    catch (error) {
      console.warn('[agent-channel] Failed to create initial snapshots:', error)
      client.close(1011, 'Initial snapshot unavailable')
      return
    }

    this.send(client, createMessage('task_logs.snapshot', { items: taskLogs }))
    this.send(client, createMessage('task_monitor.snapshot', taskMonitor))
    for (const event of this.sources.conversationRuns?.getActiveEvents?.() ?? [])
      this.send(client, createMessage('conversation.run.event', event))
    client.isInitialized = true
    for (const message of client.pendingMessages) {
      this.send(client, message)
    }
    client.pendingMessages = []
    this.send(client, createMessage('channel.ready', { connectedAt: new Date().toISOString() }))
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

  private broadcast(message: AgentChannelMessage): void {
    for (const socket of this.webSocketServer.clients) {
      const client = socket as AliveWebSocket
      if (client.isInitialized) {
        this.send(client, message)
      }
      else {
        client.pendingMessages.push(message)
      }
    }
  }

  private send(client: WebSocket, message: AgentChannelMessage): void {
    if (client.readyState !== WebSocket.OPEN) {
      return
    }
    client.send(JSON.stringify(message))
  }
}
