import type { AgentRunEvent } from '@roxy/shared/channel'
import type { AgentStreamEvent, ParsedApplyPatchOperation } from 'roxy-agent-runtime'
import { applyPatchInputSchema, normalizeApplyPatchInput } from 'roxy-agent-runtime'
import { withAgentPath } from '@/core/agent-events/events'
import { streamEvents } from '@/core/agent-events/streamEvents'

export interface RuntimeEventPublisherOptions {
  /** Scope all worker events to one frontend worker task. */
  workerId?: string
  /** Worker streams must not terminate the parent run. */
  emitDone?: boolean
  /** Stable agent tree path. `/root` is the main agent. */
  agentPath?: string
}

interface ApplyPatchEventDetails {
  patchType: 'create' | 'update' | 'delete' | 'mixed'
  target?: string
}

function getApplyPatchEventDetails(input: unknown): ApplyPatchEventDetails | undefined {
  const parsed = applyPatchInputSchema.safeParse(input)
  if (!parsed.success) {
    return undefined
  }

  let operations: ParsedApplyPatchOperation[]
  try {
    operations = normalizeApplyPatchInput(parsed.data)
  }
  catch {
    return undefined
  }
  const operation = operations[0]
  if (operations.length !== 1 || !operation || (operation.type === 'update' && operation.moveTo)) {
    return { patchType: 'mixed' }
  }

  return {
    patchType: operation.type === 'add' ? 'create' : operation.type,
    target: operation.path,
  }
}

function getReadFileTarget(input: unknown): string | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }

  const path = (input as Record<string, unknown>).path
  return typeof path === 'string' && path ? path : undefined
}

function hasWebSearchPresentation(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false
  }

  const record = input as Record<string, unknown>
  const action = record.type === 'search' || record.type === 'open_page' || record.type === 'find_in_page'
    ? record
    : record.action && typeof record.action === 'object' && !Array.isArray(record.action)
      ? record.action as Record<string, unknown>
      : undefined
  return action?.type === 'search' || action?.type === 'open_page' || action?.type === 'find_in_page'
}

export class RuntimeEventPublisher {
  private readonly toolStarts = new Map<string, { name: string, startedAt: number }>()
  private readonly webSearchStarts = new Map<string, number>()
  private readonly completedWebSearches = new Set<string>()
  private readonly textPartsByCall = new Map<number, string[]>()
  private lastTextCallIndex = -1
  private readonly thinkingIds = new Map<number, string>()
  private readonly thinkingStarts = new Map<number, number>()
  private streamDone = false

  private readonly workerId?: string
  private readonly emitDone: boolean
  private readonly agentPath?: string
  private retryPending = false

  private callId(callIndex: number): string {
    return `llm-${callIndex}`
  }

  constructor(
    private readonly publish: (event: AgentRunEvent) => void,
    options: RuntimeEventPublisherOptions = {},
  ) {
    this.workerId = options.workerId
    this.emitDone = options.emitDone ?? true
    this.agentPath = options.agentPath
  }

  private emit(event: AgentRunEvent): void {
    this.publish(this.agentPath ? withAgentPath(event, this.agentPath) : event)
  }

  getFinalAnswer(): string {
    return this.lastTextCallIndex >= 0 ? (this.textPartsByCall.get(this.lastTextCallIndex)?.join('') ?? '') : ''
  }

  /** Mark the current model stream as replaceable after a network retry. */
  markRetryPending(): void {
    this.retryPending = true
    this.webSearchStarts.clear()
    this.completedWebSearches.clear()
  }

  /** Close streamed reasoning before an outer error path publishes a terminal run event. */
  finishOpenThinking(): void {
    for (const callIndex of this.thinkingIds.keys()) {
      this.finishThinking(callIndex)
    }
  }

  private finishThinking(callIndex: number): void {
    const thinkingId = this.thinkingIds.get(callIndex)
    if (!thinkingId) {
      return
    }

    const endTimestamp = Date.now()
    const startTimestamp = this.thinkingStarts.get(callIndex) ?? endTimestamp
    this.emit(
      streamEvents.thinkingCompleteEvent({
        id: thinkingId,
        thinkingId,
        startTimestamp,
        endTimestamp,
        durationMs: endTimestamp - startTimestamp,
        workerId: this.workerId,
      }),
    )
    this.thinkingIds.delete(callIndex)
    this.thinkingStarts.delete(callIndex)
  }

  handle(event: AgentStreamEvent): void {
    if (this.streamDone) {
      return
    }

    if (this.retryPending && (event.type === 'text' || event.type === 'thinking' || event.type === 'tool_call' || event.type === 'web_search_call')) {
      this.textPartsByCall.delete(event.callIndex)
      this.thinkingIds.delete(event.callIndex)
      this.thinkingStarts.delete(event.callIndex)
      this.retryPending = false
    }

    if (event.type === 'text') {
      this.lastTextCallIndex = Math.max(this.lastTextCallIndex, event.callIndex)
      const parts = this.textPartsByCall.get(event.callIndex) ?? []
      parts.push(event.delta)
      this.textPartsByCall.set(event.callIndex, parts)
      this.emit(streamEvents.contentEvent(event.delta, this.callId(event.callIndex), this.workerId))
      return
    }
    if (event.type === 'thinking') {
      const thinkingId = this.thinkingIds.get(event.callIndex) ?? this.callId(event.callIndex)
      this.thinkingIds.set(event.callIndex, thinkingId)
      this.thinkingStarts.set(event.callIndex, this.thinkingStarts.get(event.callIndex) ?? Date.now())
      this.emit(streamEvents.thinkingEvent(event.delta, thinkingId, this.workerId))
      return
    }
    if (event.type === 'thinking_complete') {
      this.finishThinking(event.callIndex)
      return
    }
    if (event.type === 'tool_call') {
      this.toolStarts.set(event.block.id, {
        name: event.block.name,
        startedAt: Date.now(),
      })
      const patchDetails = event.block.name === 'apply_patch'
        ? getApplyPatchEventDetails(event.block.input)
        : undefined
      const readFileTarget = event.block.name === 'read_file'
        ? getReadFileTarget(event.block.input)
        : undefined
      this.emit(
        streamEvents.toolCallEvent({
          toolName: event.block.name,
          args: event.block.input,
          toolId: event.block.id,
          taskId: this.workerId,
          patchType: patchDetails?.patchType,
          target: patchDetails?.target ?? readFileTarget,
        }),
      )
      return
    }
    if (event.type === 'web_search_call') {
      const toolId = event.item.id
      if (this.completedWebSearches.has(toolId)) {
        return
      }

      const startedAt = this.webSearchStarts.get(toolId) ?? Date.now()
      const hasStarted = this.webSearchStarts.has(toolId)
      const terminal = event.item.status === 'completed' || event.item.status === 'failed'
      if (!hasStarted && (hasWebSearchPresentation(event.item.action) || terminal)) {
        this.webSearchStarts.set(toolId, startedAt)
        this.emit(
          streamEvents.toolCallEvent({
            toolName: 'web_search',
            args: event.item.action ?? null,
            toolId,
            taskId: this.workerId,
          }),
        )
      }

      if (terminal) {
        this.emit(
          streamEvents.toolResultEvent({
            toolName: 'web_search',
            result: null,
            toolId,
            taskId: this.workerId,
            status: event.item.status === 'failed' ? 'failed' : 'success',
            et: Date.now() - startedAt,
          }),
        )
        this.webSearchStarts.delete(toolId)
        this.completedWebSearches.add(toolId)
      }
      return
    }
    if (event.type === 'tool_result') {
      const start = this.toolStarts.get(event.result.toolUseId)
      this.emit(
        streamEvents.toolResultEvent({
          toolName: start?.name ?? 'unknown',
          result: event.result.content,
          toolId: event.result.toolUseId,
          taskId: this.workerId,
          status: event.result.isError ? 'failed' : 'success',
          et: start ? Date.now() - start.startedAt : undefined,
        }),
      )
      this.toolStarts.delete(event.result.toolUseId)
      return
    }
    if (event.type === 'plan_updated') {
      if (!this.workerId) {
        this.emit(streamEvents.planUpdatedEvent(event.todos))
      }
      return
    }
    if (event.type === 'context_compacted') {
      this.emit(
        streamEvents.contextCompacted({
          status: event.status,
          compactedCount: event.compactedCount,
          ...(event.summary ? { summary: event.summary } : {}),
          ...(this.workerId ? { workerId: this.workerId } : {}),
        }),
      )
      return
    }
    if (event.type === 'done') {
      this.finishOpenThinking()
      if (this.emitDone) {
        if (event.stopReason === 'max_tokens') {
          this.emit(
            streamEvents.error('Model output was truncated before the assistant could finish. Please retry with a shorter response or smaller tool input.'),
          )
        }
        else {
          this.emit(streamEvents.done(this.getFinalAnswer()))
        }
      }
      this.streamDone = true
      return
    }
    if (event.type === 'hitl_pending') {
      const request = event.pending.request
      this.emit(
        streamEvents.hitlInterrupt({
          actionRequests: [
            {
              name: request.toolName,
              args: request.input,
              ...(request.diff ? { diff: request.diff } : {}),
            },
          ],
          reviewConfigs: [],
          interruptsId: event.pending.traceId,
        }),
      )
      return
    }
    if (event.type === 'clarification_pending') {
      const questions = event.pending.request.questions
      this.emit(
        streamEvents.clarificationRequest({
          clarificationId: event.pending.traceId,
          ...(questions?.length
            ? { questions }
            : {
                question: event.pending.request.question ?? '',
                options: event.pending.request.options,
              }),
        }),
      )
    }
  }
}
