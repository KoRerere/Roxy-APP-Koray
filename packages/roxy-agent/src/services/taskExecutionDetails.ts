import type { TaskLog, TaskScriptRun } from '@/database/tasks'
import type { AgentPaths } from '@roxy/shared/agent-paths'
import type {
  AgentTaskArtifactDTO,
  AgentTaskConversationMessageDTO,
  AgentTaskExecutionEvent,
  AgentTaskExecutionEventPayload,
  AgentTaskExecutionReplay,
  AgentTaskScriptWindowStatus,
} from '@roxy/shared/channel'
import { sanitizeId } from '@roxy/shared/agent-paths'
import fs from 'node:fs'
import path from 'node:path'
import { projectMessagesFromRollout } from '@/core/agent-events/rolloutHistory'
import { agentPaths } from '@/core/storage/agentPaths'
import { FileRecordStore } from '@/database/conversations'

type TaskExecutionSubscriber = (event: AgentTaskExecutionEvent) => void

export class TaskExecutionDetailHub {
  private readonly eventsByTask = new Map<string, AgentTaskExecutionEvent[]>()
  private readonly subscribers = new Set<TaskExecutionSubscriber>()

  append(taskLogId: string, payload: AgentTaskExecutionEventPayload): AgentTaskExecutionEvent {
    const events = this.eventsByTask.get(taskLogId) ?? []
    const event: AgentTaskExecutionEvent = {
      taskLogId,
      sequence: (events.at(-1)?.sequence ?? 0) + 1,
      createdAt: new Date().toISOString(),
      payload,
    }
    events.push(event)
    this.eventsByTask.set(taskLogId, events)
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event)
      }
      catch {}
    }
    return event
  }

  replay(taskLogId: string, afterSequence = 0): AgentTaskExecutionReplay {
    const events = this.eventsByTask.get(taskLogId) ?? []
    return {
      taskLogId,
      revision: events.at(-1)?.sequence ?? 0,
      events: events.filter(event => event.sequence > afterSequence),
    }
  }

  restore(replay: AgentTaskExecutionReplay): AgentTaskExecutionReplay {
    if (this.eventsByTask.has(replay.taskLogId)) {
      return this.replay(replay.taskLogId)
    }

    this.eventsByTask.set(replay.taskLogId, replay.events.map(event => ({
      ...event,
      payload: structuredClone(event.payload),
    })))
    return this.replay(replay.taskLogId)
  }

  delete(taskLogId: string): void {
    this.eventsByTask.delete(taskLogId)
  }

  get taskDetailCount(): number {
    return this.eventsByTask.size
  }

  subscribe(subscriber: TaskExecutionSubscriber): () => void {
    this.subscribers.add(subscriber)
    return () => this.subscribers.delete(subscriber)
  }
}

export const taskExecutionDetailHub = new TaskExecutionDetailHub()

interface LocalReplayMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content?: string
  created_at: string
}

export interface LocalTaskExecutionReplayDependencies {
  getConversationMessages: (conversationId: string) => LocalReplayMessage[]
  readScriptRunLog: (run: TaskScriptRun, startedAt: string) => string
  describeArtifacts: (fileIds: string[]) => AgentTaskArtifactDTO[]
}

export function taskArtifacts(fileIds: string[]): AgentTaskArtifactDTO[] {
  return fileIds.map((fileId) => {
    const record = FileRecordStore.getByFileId(fileId)
    return {
      fileId,
      fileName: record?.file_name || fileId,
      mimeType: record?.mime_type || 'application/octet-stream',
      size: record?.size ?? null,
    }
  })
}

export function readTaskScriptRunLog(
  run: TaskScriptRun,
  startedAt: string,
  paths: AgentPaths = agentPaths,
): string {
  const startedDate = new Date(startedAt)
  const directPath = Number.isNaN(startedDate.getTime())
    ? undefined
    : paths.workdirRunLogFile(run.slug, run.runId, startedDate)
  if (directPath) {
    try {
      return fs.readFileSync(directPath, 'utf8')
    }
    catch {}
  }

  const logsDir = path.join(paths.workdir(run.slug), 'logs')
  const fileName = `${sanitizeId(run.runId)}.log`
  try {
    const dayDirectories = fs.readdirSync(logsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => b.localeCompare(a))
    for (const dayDirectory of dayDirectories) {
      try {
        return fs.readFileSync(path.join(logsDir, dayDirectory, fileName), 'utf8')
      }
      catch {}
    }
  }
  catch {}
  return ''
}

function scriptWindowStatus(
  log: TaskLog,
  run: TaskScriptRun,
): Exclude<AgentTaskScriptWindowStatus, 'running'> | undefined {
  if (log.status === 'preparing' || log.status === 'running') {
    return undefined
  }

  if (log.status === 'success') {
    return 'success'
  }

  if (log.status === 'interrupted') {
    return 'interrupted'
  }

  if (log.status === 'partial_failed') {
    return run.fileIds.length > 0 ? 'success' : 'failed'
  }
  return 'failed'
}

const localReplayDependencies: LocalTaskExecutionReplayDependencies = {
  getConversationMessages: conversationId => projectMessagesFromRollout(conversationId, { source: 'scheduled_task' }),
  readScriptRunLog: readTaskScriptRunLog,
  describeArtifacts: taskArtifacts,
}

export function replayTaskExecutionFromLocalStorage(
  log: TaskLog,
  dependencies: LocalTaskExecutionReplayDependencies = localReplayDependencies,
): AgentTaskExecutionReplay {
  const events: AgentTaskExecutionEvent[] = []
  const append = (payload: AgentTaskExecutionEventPayload, createdAt = log.started_at) => {
    events.push({
      taskLogId: log.id,
      sequence: events.length + 1,
      createdAt,
      payload,
    })
  }

  if (log.template_type === 'script') {
    for (const run of log.script_runs) {
      const windowKey = run.dirId ?? run.runId
      append({
        type: 'script.window.started',
        window: {
          key: windowKey,
          dirId: run.dirId,
          runId: run.runId,
          label: run.dirId ?? run.runId,
        },
      })
      append({
        type: 'script.log.replace',
        windowKey,
        text: dependencies.readScriptRunLog(run, log.started_at),
      })
      append({
        type: 'artifacts.updated',
        windowKey,
        artifacts: dependencies.describeArtifacts(run.fileIds),
      })
      const status = scriptWindowStatus(log, run)
      if (status) {
        append({
          type: 'script.window.finished',
          windowKey,
          status,
          failedFiles: [],
        }, log.ended_at ?? log.started_at)
      }
    }
  }
  else if (log.conversation_id) {
    const messages = dependencies.getConversationMessages(log.conversation_id)
      .filter((message): message is LocalReplayMessage & { role: 'user' | 'assistant' } =>
        message.role === 'user' || message.role === 'assistant')
      .map<AgentTaskConversationMessageDTO>(message => ({
        id: message.id,
        role: message.role,
        content: message.content ?? '',
        createdAt: message.created_at,
      }))
    for (const message of messages) {
      append({
        type: 'agent.message.upsert',
        conversationId: log.conversation_id,
        message,
      }, message.createdAt)
    }
    append({
      type: 'artifacts.updated',
      artifacts: dependencies.describeArtifacts(log.file_ids),
    }, log.ended_at ?? log.started_at)
  }

  return {
    taskLogId: log.id,
    revision: events.length,
    events,
  }
}

export function recordTaskExecutionEvent(
  taskLogId: string,
  payload: AgentTaskExecutionEventPayload,
): AgentTaskExecutionEvent {
  return taskExecutionDetailHub.append(taskLogId, payload)
}
