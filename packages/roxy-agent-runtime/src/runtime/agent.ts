import type { ZodType } from 'zod'
import type {
  Agent,
  AgentInput,
  AgentResponse,
  AgentStreamEvent,
  AgentPath,
  ApprovalResult,
  ChatRequest,
  ClarificationResult,
  ContentBlock,
  Message,
  PendingApproval,
  PendingClarification,
  RolloutEvent,
  RoxyAssistantItem,
  SessionId,
  StopReason,
  StructuredAgent,
  StructuredOutputOptions,
  ThinkingBlock,
  ToolErrorKind,
  ToolEvent,
  ToolMiddlewareContext,
  ToolResult,
  ToolResultBlock,
  ToolUseBlock,
  TrimSummary,
} from '../core/interfaces.ts'
import { ToolExecutor } from '../tools/executor.ts'
import { buildSystemPrompt } from '../memory/summarizer.ts'
import { estimateTokens } from '../provider/estimate.ts'
import { assistantMessageToItems } from '../transcript/items.ts'
import { SuspendingClarificationHandler } from '../clarification/handler.ts'
import { buildApprovalRequest } from '../hitl/interceptor.ts'
import { toolNeedsHumanApproval } from '../hitl/policy.ts'
import type { AgentGraph, AgentGraphDeps } from './graph.ts'
import { extractDeps } from './graph.ts'
import { runAfterMiddleware, runBeforeMiddleware, runPreviewMiddleware } from './middleware_chain.ts'
import { renderSelectedSkillMessages } from '../skills/prompt.ts'
import { runContributors } from './contributor_chain.ts'
import { renderContributionContext, renderSummaryContext } from './turn-context.ts'
import { createCompactionSummaryMessage } from '../memory/memory.ts'

const DEFAULT_COMPACTION_TRIGGER_RATIO = 0.8
const FALLBACK_COMPACTION_TRIGGER_TOKENS = 150_000

function resolveCompactionTriggerTokens(deps: Pick<AgentGraphDeps, 'contextWindowTokens' | 'triggerTokens'>): number {
  return (
    deps.triggerTokens ??
    (deps.contextWindowTokens === undefined
      ? FALLBACK_COMPACTION_TRIGGER_TOKENS
      : Math.floor(deps.contextWindowTokens * DEFAULT_COMPACTION_TRIGGER_RATIO))
  )
}

function unwrapAgentInput(input: AgentInput): {
  conversationInput: string | Message[]
  contextualMessages: Message[]
  trailingMessages: Message[]
  selections: import('../core/interfaces.ts').SkillSelection[]
} {
  if (typeof input === 'string') {
    return { conversationInput: input, contextualMessages: [], trailingMessages: [], selections: [] }
  }
  if (Array.isArray(input)) {
    return { conversationInput: input, contextualMessages: input.slice(0, -1), trailingMessages: [], selections: [] }
  }

  const contextualMessages = Array.isArray(input.input) ? input.input.slice(0, -1) : []
  return {
    conversationInput: input.input,
    contextualMessages,
    trailingMessages: input.trailingMessages ?? [],
    selections: input.skills ?? [],
  }
}

function parseArchivedMessages(archivedText: string): Message[] {
  if (!archivedText) {
    return []
  }
  return archivedText.split('\n').map((line): Message => {
    const i = line.indexOf(': ')
    if (i < 0) {
      return { role: 'user', content: line }
    }
    const role = line.slice(0, i) as Message['role']
    const contentText = line.slice(i + 2)
    try {
      return { role, content: JSON.parse(contentText) as ContentBlock[] }
    } catch {
      return { role, content: contentText }
    }
  })
}

function describeErrorCause(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }
  const cause = (error as { cause?: unknown }).cause
  if (typeof cause === 'string' && cause.trim()) {
    return cause.trim()
  }
  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}`
  }
  if (cause !== undefined && cause !== null) {
    try {
      return typeof cause === 'object' ? JSON.stringify(cause) : String(cause)
    } catch {
      return String(cause)
    }
  }
  return undefined
}

function serializeErrorDetails(error: unknown): {
  name?: string
  message: string
  stack?: string
  cause?: string
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message || error.name,
      ...(error.stack ? { stack: error.stack } : {}),
      ...(describeErrorCause(error) ? { cause: describeErrorCause(error) } : {}),
    }
  }
  if (typeof error === 'string') {
    return { message: error }
  }
  try {
    return { message: JSON.stringify(error) }
  } catch {
    return { message: String(error) }
  }
}

/**
 * Internal {@link Agent} implementation. Owns the tool-use loop, HITL
 * intercept, context-contributor chain, lifecycle hooks, and stream/resume
 * machinery. The package root exposes {@link AgentRuntime} instead.
 */
export class AgentImpl implements Agent {
  readonly id: string
  readonly sessionId: SessionId

  private readonly deps: AgentGraphDeps
  private readonly agentPath: AgentPath | undefined
  private readonly executor: ToolExecutor
  private disposed = false
  private readonly disposeCallbacks: Array<() => void | Promise<void>> = []

  // Key = traceId (one pending approval per trace at a time in Phase 4).
  private readonly pendingApprovals = new Map<string, (r: ApprovalResult) => void>()
  private readonly pendingClarifications = new Map<string, (r: ClarificationResult) => void>()
  // Pendings parked by a SuspendingClarificationHandler, awaiting a
  // `clarification_pending` yield from an active stream (drained by the
  // streamLoop's execute-race; resolved out-of-band via clarify() otherwise).
  private readonly clarificationQueue: PendingClarification[] = []
  private clarificationArrived: (() => void)[] = []
  // REAL context size as last reported by the API (`usage.input_tokens` of the
  // most recent model call). The compaction trigger prefers this over the
  // chars/4 heuristic — code-heavy histories drift far from the estimate.
  // 0 = no signal yet (fresh/resumed session, or just compacted).
  private lastInputTokens = 0

  constructor(graph: AgentGraph, _deps: unknown, id: string, sessionId: SessionId) {
    this.id = id
    this.sessionId = sessionId
    this.deps = extractDeps(graph)
    this.agentPath = this.deps.agentPath
    this.executor = new ToolExecutor(this.deps.tools)
    // Wire the interactive clarification channel: parked ask_user requests
    // register for Agent.clarify() and surface as clarification_pending
    // stream events (see the execute-race in streamLoop).
    if (this.deps.clarification instanceof SuspendingClarificationHandler) {
      this.deps.clarification.onPending = (p) => this.acceptPendingClarification(p)
    }
  }

  private recordToolEvent(traceId: string, event: ToolEvent): void {
    this.deps.recorder.emit({
      traceId,
      ts: Date.now(),
      phase: event.type,
      data: { todos: event.todos },
    })
  }

  /**
   * Register a parked clarification so BOTH resolution paths work: the
   * `clarification_pending` stream event (UI calls `pending.resume`) and the
   * out-of-band `Agent.clarify(traceId, …)`. Whichever fires first cleans up
   * the map and the queue; the underlying handler ignores late duplicates.
   */
  private acceptPendingClarification(p: PendingClarification): void {
    const wrapped: PendingClarification = {
      ...p,
      resume: (r: ClarificationResult) => {
        this.pendingClarifications.delete(p.traceId)
        const i = this.clarificationQueue.indexOf(wrapped)
        if (i >= 0) {
          this.clarificationQueue.splice(i, 1)
        }
        p.resume(r)
      },
    }
    this.pendingClarifications.set(p.traceId, wrapped.resume)
    this.clarificationQueue.push(wrapped)
    const waiters = this.clarificationArrived
    this.clarificationArrived = []
    for (const w of waiters) {
      w()
    }
  }

  /** Resolves when the next clarification parks (used by the stream race). */
  private nextClarificationSignal(): Promise<void> {
    return new Promise((resolve) => this.clarificationArrived.push(resolve))
  }

  /**
   * Double-write hook: mirror a `memory.append` into the durable rollout store,
   * when one is configured. In development we want this to fail loudly: if the
   * durable event stream cannot be written, the run should stop immediately so
   * the root cause is visible instead of being silently swallowed.
   */
  private async record(event: RolloutEvent): Promise<void> {
    const { sessionStore, logger } = this.deps
    if (!sessionStore) {
      return
    }
    try {
      await sessionStore.append(this.sessionId, event)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      logger.error('rollout append failed — stopping agent run', {
        error,
      })
      throw new Error(`rollout append failed: ${error}`, { cause: err })
    }
  }

  private async recordTurnTerminal(
    status: 'completed' | 'aborted' | 'failed',
    options: { stopReason?: StopReason; error?: unknown; reason?: unknown } = {},
  ): Promise<void> {
    if (status === 'completed') {
      await this.record({
        type: 'turn_completed',
        stopReason: options.stopReason ?? 'end_turn',
      })
      return
    }
    if (status === 'aborted') {
      await this.record({
        type: 'turn_aborted',
        ...(typeof options.reason === 'string' && options.reason ? { message: options.reason } : {}),
      })
      return
    }
    const error = serializeErrorDetails(options.error)
    await this.record({
      type: 'turn_error',
      phase: 'turn_failed',
      ...error,
    })
    await this.record({
      type: 'turn_failed',
      message: error.message,
    })
  }

  private async recordAssistantTurn(message: Message, stopReason: StopReason): Promise<void> {
    await this.deps.memory.append(this.sessionId, message)
    await this.record({ type: 'assistant_turn', items: assistantMessageToItems(message), stopReason })
  }

  /**
   * Materialize the complete turn-start input once, then persist every message
   * to both memory and the durable rollout before the first model call.
   * Internal context remains part of the replayable history; presentation
   * layers decide whether to render it from `visible`.
   */
  private async appendTurnStartMessages(
    traceId: string,
    conversationInput: string | Message[],
    contextualMessages: Message[],
    trailingMessages: Message[],
    selections: import('../core/interfaces.ts').SkillSelection[],
  ): Promise<{ userMessage: Message; appendedCount: number }> {
    const rawUserMessage: Message =
      typeof conversationInput === 'string'
        ? { role: 'user', content: conversationInput }
        : (conversationInput[conversationInput.length - 1] ?? { role: 'user', content: '' })
    if (rawUserMessage.role !== 'user') {
      throw new Error('The final turn input message must use the user role')
    }

    const userMessage: Message = {
      role: 'user',
      content: rawUserMessage.content,
      ...(rawUserMessage.metadata ? { metadata: rawUserMessage.metadata } : {}),
      ...(rawUserMessage.transcriptItems ? { transcriptItems: rawUserMessage.transcriptItems } : {}),
    }
    const history = await this.deps.memory.getAll(this.sessionId)
    const summary = await this.deps.memory.getSummary(this.sessionId)
    const contributions = await runContributors(
      this.deps.contributors ?? [],
      {
        agentId: this.id,
        sessionId: this.sessionId,
        traceId,
        recentMessages: [...history, userMessage].slice(-10),
      },
      this.deps.logger,
    )
    const skillMessages = await renderSelectedSkillMessages(selections, this.deps.skills ?? [])
    const normalizeInternalMessage = (message: Message): Message => {
      if (message.role !== 'user' && message.role !== 'developer') {
        throw new Error('Turn-start context messages must use the user or developer role')
      }
      return {
        role: message.role,
        content: message.content,
        visible: false,
        ...(message.compactionKey ? { compactionKey: message.compactionKey } : {}),
        ...(message.compactionOrder !== undefined ? { compactionOrder: message.compactionOrder } : {}),
        ...(message.transcriptItems ? { transcriptItems: message.transcriptItems } : {}),
      }
    }
    const candidateInternalMessages = [
      ...contextualMessages.map(normalizeInternalMessage),
      ...renderSummaryContext(summary),
      ...skillMessages,
      ...renderContributionContext(contributions),
    ]
    const trailingInternalMessages = trailingMessages.map(normalizeInternalMessage)
    const latestByKey = new Map<string, Message>()
    for (const message of history) {
      if (message.compactionKey) {
        latestByKey.set(message.compactionKey, message)
      }
    }
    const internalMessages = candidateInternalMessages.filter((message) => {
      if (!message.compactionKey) {
        return true
      }
      return latestByKey.get(message.compactionKey)?.content !== message.content
    })
    const turnMessages = [...internalMessages, userMessage, ...trailingInternalMessages]
    for (const message of turnMessages) {
      await this.deps.memory.append(this.sessionId, message)
      await this.record({ type: 'user_input', message })
    }

    return { userMessage, appendedCount: turnMessages.length }
  }

  private buildPartialAssistantMessage(textParts: string[], thinkingBlocks: ThinkingBlock[]): Message | undefined {
    if (textParts.length === 0 && thinkingBlocks.length === 0) {
      return undefined
    }

    const content: ContentBlock[] = [...thinkingBlocks]
    const text = textParts.join('')
    if (text) {
      content.push({ type: 'text', text })
    }

    return {
      role: 'assistant',
      content,
    }
  }

  private async emitMemoryTurnEnd(ctx: {
    traceId: string
    input: AgentInput
    userMessage: Message
    producedMessages: Message[]
    stopReason: StopReason
    totalModelCalls: number
    totalToolCalls: number
    totalInputTokens: number
    totalOutputTokens: number
    durationMs: number
    aborted: boolean
  }): Promise<void> {
    for (const lifecycle of this.deps.memoryLifecycles ?? []) {
      try {
        await lifecycle.onTurnEnd?.({
          agentId: this.id,
          sessionId: this.sessionId,
          ...ctx,
        })
      } catch (err) {
        this.deps.logger.warn('memory lifecycle onTurnEnd failed — continuing', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  private async emitMemoryCompaction(traceId: string, trimResult: TrimSummary, summary: string): Promise<void> {
    if ((this.deps.memoryLifecycles ?? []).length === 0) {
      return
    }
    const ts = Date.now()
    const archivedMessages = parseArchivedMessages(trimResult.archivedText)
    for (const lifecycle of this.deps.memoryLifecycles ?? []) {
      try {
        await lifecycle.onCompaction?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          archivedText: trimResult.archivedText,
          archivedMessages,
          removedCount: trimResult.removedCount,
          summary,
          ts,
        })
      } catch (err) {
        this.deps.logger.warn('memory lifecycle onCompaction failed — continuing', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  private async emitMemoryCompactionStarted(traceId: string, removedCount: number): Promise<void> {
    const ctx = { agentId: this.id, sessionId: this.sessionId, traceId, removedCount, ts: Date.now() }
    for (const lifecycle of this.deps.memoryLifecycles ?? []) {
      try {
        await lifecycle.onCompactionStarted?.(ctx)
      } catch (err) {
        this.deps.logger.warn('memory lifecycle onCompactionStarted failed — continuing', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  private async commitCompaction(traceId: string, trimResult: TrimSummary, summary: string): Promise<void> {
    const keptMessages = await this.deps.memory.getAll(this.sessionId)
    await this.record({
      type: 'compaction',
      summary,
      compactedCount: trimResult.removedCount,
      ts: Date.now(),
      keptMessages,
    })
    await this.emitMemoryCompaction(traceId, trimResult, summary)
    await this.deps.memory.prependMessage(this.sessionId, createCompactionSummaryMessage(summary))
  }

  // -------------------------------------------------------------------------
  // invoke — run the loop to completion
  // -------------------------------------------------------------------------

  async invoke(input: AgentInput, signal?: AbortSignal): Promise<AgentResponse> {
    const { recorder, hooks } = this.deps
    const { conversationInput, contextualMessages, trailingMessages, selections } = unwrapAgentInput(input)
    const traceId = recorder.start(
      typeof conversationInput === 'string' ? [{ role: 'user', content: conversationInput }] : conversationInput,
    )
    const startTime = Date.now()
    let aborted = false

    // Token accumulators — fed by runLoop via shared closure so invoke()
    // reports real token usage, not hardcoded placeholders.
    let totalInputTokens = 0
    let totalOutputTokens = 0

    const fireAbort = () => {
      if (aborted) {
        return
      }
      aborted = true
      hooks?.invoke?.abort?.({
        agentId: this.id,
        sessionId: this.sessionId,
        traceId,
        elapsedMs: Date.now() - startTime,
        modelCallsSoFar: 0,
        toolCallsSoFar: 0,
      })
    }

    if (signal?.aborted) {
      fireAbort()
    } else if (signal) {
      signal.addEventListener('abort', fireAbort)
    }

    hooks?.invoke?.before?.({
      agentId: this.id,
      sessionId: this.sessionId,
      traceId,
      mode: 'invoke',
      input,
      contextWindowTokens: this.deps.contextWindowTokens,
      triggerTokens: resolveCompactionTriggerTokens(this.deps),
    })

    const { userMessage: userMsg } = await this.appendTurnStartMessages(
      traceId,
      conversationInput,
      contextualMessages,
      trailingMessages,
      selections,
    )

    const produced: Message[] = []
    let totalModelCalls = 0
    let totalToolCalls = 0
    let finalStopReason: StopReason = 'end_turn'
    let loopError: unknown

    if (!aborted) {
      try {
        const loop = this.runLoop(traceId, signal, { input: 0, output: 0 })
        for await (const msg of loop) {
          // Extract token accumulator from the final synthetic yield before
          // skipping it — it carries no user-visible content.
          if ('_tokenAcc' in msg) {
            const acc = (msg as Message & { _tokenAcc?: { input: number; output: number } })._tokenAcc
            if (acc) {
              totalInputTokens = acc.input
              totalOutputTokens = acc.output
            }
            continue // don't push the synthetic message
          }
          produced.push(msg)
          if ('_stopReason' in msg) {
            finalStopReason = (msg as Message & { _stopReason: StopReason })._stopReason
          }
        }
      } catch (error) {
        loopError = error
      }
    }

    // Re-derive counts from memory (simpler than threading counts through)
    for (const m of produced) {
      if (m.role === 'assistant') {
        totalModelCalls++
      }
      if (m.role === 'user' && Array.isArray(m.content)) {
        totalToolCalls += (m.content as ContentBlock[]).filter((b) => b.type === 'tool_result').length
      }
    }

    hooks?.invoke?.after?.({
      agentId: this.id,
      sessionId: this.sessionId,
      traceId,
      stopReason: finalStopReason,
      totalModelCalls,
      totalToolCalls,
      totalInputTokens,
      totalOutputTokens,
      durationMs: Date.now() - startTime,
      aborted,
    })

    await this.emitMemoryTurnEnd({
      traceId,
      input,
      userMessage: userMsg,
      producedMessages: produced,
      stopReason: finalStopReason,
      totalModelCalls,
      totalToolCalls,
      totalInputTokens,
      totalOutputTokens,
      durationMs: Date.now() - startTime,
      aborted,
    })

    if (aborted || signal?.aborted) {
      await this.recordTurnTerminal('aborted', { reason: signal?.reason })
    } else if (loopError) {
      await this.recordTurnTerminal('failed', { error: loopError })
    } else {
      await this.recordTurnTerminal('completed', { stopReason: finalStopReason })
    }

    recorder.end(traceId)

    if (loopError) {
      throw loopError
    }

    return { messages: produced, trajectory: recorder.getTrace(traceId) }
  }

  // -------------------------------------------------------------------------
  // stream — yield events as they happen
  // -------------------------------------------------------------------------

  async *stream(input: AgentInput, signal?: AbortSignal): AsyncIterable<AgentStreamEvent> {
    const { memory, recorder, hooks } = this.deps
    const { conversationInput, contextualMessages, trailingMessages, selections } = unwrapAgentInput(input)
    const traceId = recorder.start(
      typeof conversationInput === 'string' ? [{ role: 'user', content: conversationInput }] : conversationInput,
    )
    const startTime = Date.now()
    let aborted = false
    const fireStreamAbort = () => {
      if (aborted) {
        return
      }
      aborted = true
      hooks?.invoke?.abort?.({
        agentId: this.id,
        sessionId: this.sessionId,
        traceId,
        elapsedMs: Date.now() - startTime,
        modelCallsSoFar: 0,
        toolCallsSoFar: 0,
      })
    }
    if (signal?.aborted) {
      fireStreamAbort()
    } else {
      signal?.addEventListener('abort', fireStreamAbort, { once: true })
    }

    hooks?.invoke?.before?.({
      agentId: this.id,
      sessionId: this.sessionId,
      traceId,
      mode: 'stream',
      input,
      contextWindowTokens: this.deps.contextWindowTokens,
      triggerTokens: resolveCompactionTriggerTokens(this.deps),
    })

    // Snapshot history length before the loop so we can derive counts
    // for just this stream() call (not the entire session history).
    const historyBefore = await memory.getAll(this.sessionId)

    const { userMessage: userMsg, appendedCount } = await this.appendTurnStartMessages(
      traceId,
      conversationInput,
      contextualMessages,
      trailingMessages,
      selections,
    )

    // Accumulate tokens across the stream loop for invoke.after reporting.
    const tokenAcc = { input: 0, output: 0 }
    let finalStopReason: StopReason = 'end_turn'
    let doneEvent: Extract<AgentStreamEvent, { type: 'done' }> | undefined

    let streamError: unknown
    try {
      for await (const event of this.streamLoop(traceId, signal, tokenAcc)) {
        if (event.type === 'done') {
          finalStopReason = event.stopReason
          doneEvent = event
          continue
        }
        yield event
      }
    } catch (error) {
      streamError = error
    }

    // Count only messages added during this stream() call.
    const historyAfter = await memory.getAll(this.sessionId)
    const newMessages = historyAfter.slice(historyBefore.length + appendedCount)
    let totalModelCalls = 0
    let totalToolCalls = 0
    for (const m of newMessages) {
      if (m.role === 'assistant') {
        totalModelCalls++
      }
      if (m.role === 'user' && Array.isArray(m.content)) {
        totalToolCalls += (m.content as ContentBlock[]).filter((b) => b.type === 'tool_result').length
      }
    }

    hooks?.invoke?.after?.({
      agentId: this.id,
      sessionId: this.sessionId,
      traceId,
      stopReason: finalStopReason,
      totalModelCalls,
      totalToolCalls,
      totalInputTokens: tokenAcc.input,
      totalOutputTokens: tokenAcc.output,
      durationMs: Date.now() - startTime,
      aborted,
    })

    if (!streamError && !aborted && !signal?.aborted && !doneEvent) {
      streamError = new Error('Agent stream ended without a terminal done event')
    }

    await this.emitMemoryTurnEnd({
      traceId,
      input,
      userMessage: userMsg,
      producedMessages: newMessages,
      stopReason: finalStopReason,
      totalModelCalls,
      totalToolCalls,
      totalInputTokens: tokenAcc.input,
      totalOutputTokens: tokenAcc.output,
      durationMs: Date.now() - startTime,
      aborted,
    })

    if (aborted || signal?.aborted) {
      await this.recordTurnTerminal('aborted', { reason: signal?.reason })
    } else if (streamError) {
      await this.recordTurnTerminal('failed', { error: streamError })
    } else {
      await this.recordTurnTerminal('completed', { stopReason: finalStopReason })
    }

    recorder.end(traceId)
    if (streamError) {
      throw streamError
    }
    if (doneEvent) {
      yield doneEvent
    }
  }

  structured<T>(schema: ZodType<T>, options?: StructuredOutputOptions): StructuredAgent<T> {
    const extract = this.deps.provider.withStructuredOutput(schema, options)
    return {
      invoke: async (input, signal) => {
        await this.invoke(input, signal)
        const history = await this.deps.memory.getAll(this.sessionId)
        return extract(history, signal)
      },
    }
  }

  // -------------------------------------------------------------------------
  // Core loop (produces Message[] for invoke)
  // -------------------------------------------------------------------------

  private async *runLoop(
    traceId: string,
    signal?: AbortSignal,
    tokenAcc?: { input: number; output: number },
  ): AsyncIterable<Message & { _stopReason?: StopReason }> {
    const {
      provider,
      tools,
      memory,
      hitl,
      recorder,
      hooks,
      middleware,
      deps: _unused,
    } = {
      ...this.deps,
      deps: null,
    }
    const { model, maxTokens, systemPrompt, trimPolicy, summarizer, skills } = this.deps

    let totalModelCalls = 0
    let totalToolCalls = 0
    let finalStopReason: StopReason = 'end_turn'
    while (true) {
      if (signal?.aborted) {
        break
      }

      // Check before every model call. Tool results can grow the request during
      // a single invoke/stream loop, so checking only at turn entry is too late.
      if (trimPolicy) {
        const triggerTokens = resolveCompactionTriggerTokens(this.deps)
        const history = await memory.getAll(this.sessionId)
        // Usage describes the previous request, while the current history may
        // have grown since then (most notably after a large tool result). Use
        // both signals so neither stale usage nor newly appended content can
        // let an oversized request through.
        const estimatedCurrentTokens = history.length > 0 ? await provider.countTokens(history) : 0
        const contextTokens = Math.max(this.lastInputTokens, estimatedCurrentTokens)
        if (contextTokens > triggerTokens) {
          // The signal is consumed — the next model call re-measures the
          // compacted context, and a stale value must not re-trigger.
          this.lastInputTokens = 0
          const trimResult = await memory.trim(this.sessionId, trimPolicy)
          if (trimResult.removedCount > 0) {
            await this.emitMemoryCompactionStarted(traceId, trimResult.removedCount)
            recorder.emit({
              traceId,
              ts: Date.now(),
              phase: 'memory_trimmed',
              data: { removedCount: trimResult.removedCount },
            })
            const textForSummary = trimResult.summarizeText ?? trimResult.archivedText
            if (summarizer && textForSummary) {
              const txt = await summarizer.summarize(textForSummary)
              if (txt) {
                await this.commitCompaction(traceId, trimResult, txt)
              }
            }
          }
        }
      }
      const history = await memory.getAll(this.sessionId)
      const systemBlocks = buildSystemPrompt(systemPrompt ?? '', skills)
      const request: ChatRequest = {
        model,
        messages: history,
        system: systemBlocks,
        tools: tools.all().length > 0 ? tools.all() : undefined,
        ...(maxTokens !== undefined ? { maxTokens } : {}),
      }

      // Per-iteration telemetry — local chars/4 heuristic, NOT
      // provider.countTokens: that may hit the vendor's count endpoint, and
      // two network calls per iteration is too dear for hook estimates.
      const estimatedSystemTokens =
        systemBlocks.length > 0 ? estimateTokens([{ role: 'user', content: JSON.stringify(systemBlocks) }]) : 0
      const estimatedHistoryTokens = estimateTokens(history)
      const systemPromptChars = JSON.stringify(systemBlocks).length

      const callIndex = totalModelCalls
      hooks?.model?.before?.({
        agentId: this.id,
        sessionId: this.sessionId,
        traceId,
        callIndex,
        model,
        systemBlockCount: systemBlocks.length,
        estimatedSystemTokens,
        estimatedHistoryTokens,
        systemPromptChars,
        contextTokens: estimatedSystemTokens + estimatedHistoryTokens,
        toolCount: tools.all().length,
      })

      const modelStart = Date.now()
      let response
      try {
        response = await provider.invoke(request, signal)
      } catch (error) {
        hooks?.model?.error?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          callIndex,
          model,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - modelStart,
        })
        throw error
      }
      totalModelCalls++

      // Accumulate token usage for invoke() reporting.
      if (tokenAcc) {
        tokenAcc.input += response.usage.inputTokens
        tokenAcc.output += response.usage.outputTokens
      }

      hooks?.model?.after?.({
        agentId: this.id,
        sessionId: this.sessionId,
        traceId,
        callIndex,
        model,
        stopReason: response.stopReason,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        cachedInputTokens: response.usage.cachedInputTokens,
        durationMs: Date.now() - modelStart,
      })

      this.lastInputTokens = response.usage.inputTokens

      // Filter to only tool_use blocks we can resolve; unresolvable blocks
      // (e.g. provider-internal tools) are stripped to avoid invalid history.
      const allContent: ContentBlock[] =
        typeof response.message.content !== 'string' ? (response.message.content as ContentBlock[]) : []
      const allToolUseBlocks: ToolUseBlock[] = allContent.filter((b): b is ToolUseBlock => b.type === 'tool_use')
      const shouldRunTools = response.stopReason === 'tool_use'
      const toolUseBlocks = shouldRunTools ? allToolUseBlocks.filter((b) => tools.resolve(b.name)) : []
      for (const block of shouldRunTools ? allToolUseBlocks : []) {
        if (tools.resolve(block.name)) {
          continue
        }
        const missingIndex = totalToolCalls++
        hooks?.tool?.before?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: 'builtin',
          toolUseId: block.id,
          callIndex: missingIndex,
          isSensitive: false,
        })
        hooks?.tool?.after?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: 'builtin',
          toolUseId: block.id,
          callIndex: missingIndex,
          isError: true,
          errorKind: 'not_found',
          durationMs: 0,
        })
      }
      // Thinking blocks (with signatures) must round-trip when the turn
      // uses tools — Anthropic requires them on subsequent turns. Prepend
      // them ahead of tool_use; in the no-tool branch they're already kept.
      const thinkingBlocks: ThinkingBlock[] = allContent.filter((b): b is ThinkingBlock => b.type === 'thinking')
      const effectiveContent: ContentBlock[] =
        shouldRunTools && toolUseBlocks.length > 0
          ? [...thinkingBlocks, ...toolUseBlocks]
          : ((typeof response.message.content === 'string'
              ? response.message.content
              : (response.message.content as ContentBlock[]).filter((b) => b.type !== 'tool_use')) as ContentBlock[])
      const effectiveStopReason: StopReason =
        response.stopReason === 'tool_use' && toolUseBlocks.length === 0 ? 'end_turn' : response.stopReason
      const needsFollowUp = effectiveStopReason === 'tool_use' || response.endTurn === false
      const effectiveMessage: Message = {
        role: 'assistant',
        content: effectiveContent,
        transcriptItems: assistantMessageToItems({ role: 'assistant', content: effectiveContent }),
      }

      await memory.append(this.sessionId, effectiveMessage)
      await this.record({
        type: 'assistant_turn',
        items: response.items.length > 0 ? response.items : assistantMessageToItems(effectiveMessage),
        stopReason: effectiveStopReason,
      })
      finalStopReason = effectiveStopReason
      recorder.emit({ traceId, ts: Date.now(), phase: 'model_thought', data: { stopReason: effectiveStopReason } })

      const msg: Message & { _stopReason?: StopReason } = {
        ...effectiveMessage,
        _stopReason: effectiveStopReason,
      }
      yield msg

      if (!needsFollowUp) {
        break
      }

      if (effectiveStopReason !== 'tool_use') {
        continue
      }

      const toolResults: ToolResultBlock[] = []
      const directReturnCandidate =
        allToolUseBlocks.length === 1 &&
        toolUseBlocks.length === 1 &&
        tools.resolve(toolUseBlocks[0]!.name)?.descriptor.returnDirect === true

      for (const block of toolUseBlocks) {
        if (signal?.aborted) {
          break
        }

        const descriptor = tools.resolve(block.name)?.descriptor
        const toolEvents: ToolEvent[] = []
        const ctx = {
          agentId: this.id,
          traceId,
          signal: signal ?? new AbortController().signal,
          metadata: this.deps.toolContext,
          emit: (event: ToolEvent) => toolEvents.push(event),
          agentPath: this.agentPath,
          agentManager: this.deps.agentManager,
        }
        const toolCallIndex = totalToolCalls
        const mwCtx: ToolMiddlewareContext = {
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? 'builtin',
          toolUseId: block.id,
          callIndex: toolCallIndex,
        }

        // HITL check (invoke mode: call handler synchronously)
        if (descriptor && hitl.needsApproval(descriptor, block.input)) {
          recorder.emit({ traceId, ts: Date.now(), phase: 'hitl_intercept', data: { toolName: block.name } })
          const preview = await runPreviewMiddleware(middleware ?? [], block.name, block.input, mwCtx)
          const approvalRequest = await buildApprovalRequest(descriptor, block.input, traceId, {
            reason: 'HITL check',
            ...(preview.aborted ? { skipPreview: true } : { previewInput: preview.input }),
          })
          const approval = await hitl.requestApproval(approvalRequest)
          if (approval.decision === 'reject') {
            const feedback = approval.feedback ?? `Tool "${block.name}" was rejected by HITL`
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: feedback, is_error: true })
            continue
          }
        }

        hooks?.tool?.before?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? 'builtin',
          toolUseId: block.id,
          callIndex: toolCallIndex,
          isSensitive: descriptor ? toolNeedsHumanApproval(descriptor) : false,
        })

        const toolStart = Date.now()
        const beforeResult = await runBeforeMiddleware(middleware ?? [], block.name, block.input, mwCtx)

        let result: ToolResult
        let errorKind: ToolErrorKind | undefined

        if (beforeResult.aborted) {
          errorKind = 'aborted'
          result = { toolUseId: block.id, content: beforeResult.error.message, isError: true }
        } else {
          const rawResult = await this.executor.execute(block.name, beforeResult.input, ctx, block.id)
          result = await runAfterMiddleware(middleware ?? [], block.name, rawResult, mwCtx)
          if (result.isError) {
            errorKind = result.errorKind ?? 'handler_error'
          }
        }
        totalToolCalls++

        hooks?.tool?.after?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? 'builtin',
          toolUseId: block.id,
          callIndex: toolCallIndex,
          isError: result.isError,
          errorKind,
          durationMs: Date.now() - toolStart,
        })

        recorder.emit({
          traceId,
          ts: Date.now(),
          phase: 'tool_executed',
          data: { toolName: block.name, isError: result.isError },
        })
        if (!result.isError) {
          for (const event of toolEvents) {
            this.recordToolEvent(traceId, event)
          }
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: result.toolUseId,
          content: result.content,
          is_error: result.isError,
        })
      }

      if (toolResults.length > 0) {
        const toolResultMsg: Message = { role: 'user', content: toolResults }
        await memory.append(this.sessionId, toolResultMsg)
        for (const r of toolResults) {
          await this.record({ type: 'tool_result', result: r })
        }
        const returnDirect = directReturnCandidate && toolResults.length === 1 && toolResults[0]!.is_error !== true
        yield { ...toolResultMsg, _stopReason: returnDirect ? 'end_turn' : undefined }
        if (returnDirect) {
          finalStopReason = 'end_turn'
          break
        }
      }

      void finalStopReason // suppress unused warning
    }

    // Yield a synthetic message carrying the accumulated token counts so
    // invoke() can report real usage instead of hardcoded placeholders.
    if (tokenAcc) {
      yield { role: 'user', content: '', _stopReason: undefined, _tokenAcc: tokenAcc } as Message & {
        _stopReason?: StopReason
        _tokenAcc?: { input: number; output: number }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Stream loop (yields AgentStreamEvents)
  // -------------------------------------------------------------------------

  private async *streamLoop(
    traceId: string,
    signal?: AbortSignal,
    tokenAcc?: { input: number; output: number },
  ): AsyncIterable<AgentStreamEvent> {
    const { provider, tools, memory, hitl, recorder, hooks, middleware } = this.deps
    const { model, maxTokens, systemPrompt, trimPolicy, summarizer, skills } = this.deps

    let totalModelCalls = 0
    let totalToolCalls = 0
    while (true) {
      if (signal?.aborted) {
        break
      }

      // Check before every model call. Tool results can grow the request during
      // a single stream loop, so checking only at turn entry is too late.
      if (trimPolicy) {
        const triggerTokens = resolveCompactionTriggerTokens(this.deps)
        const history = await memory.getAll(this.sessionId)
        const estimatedCurrentTokens = history.length > 0 ? await provider.countTokens(history) : 0
        const contextTokens = Math.max(this.lastInputTokens, estimatedCurrentTokens)
        if (contextTokens > triggerTokens) {
          this.lastInputTokens = 0
          const trimResult = await memory.trim(this.sessionId, trimPolicy)
          if (trimResult.removedCount > 0) {
            await this.emitMemoryCompactionStarted(traceId, trimResult.removedCount)
            recorder.emit({
              traceId,
              ts: Date.now(),
              phase: 'memory_trimmed',
              data: { removedCount: trimResult.removedCount },
            })
            const textForSummary = trimResult.summarizeText ?? trimResult.archivedText
            if (summarizer && textForSummary) {
              yield {
                type: 'context_compacted',
                status: 'started',
                compactedCount: trimResult.removedCount,
              }
              const txt = await summarizer.summarize(textForSummary)
              if (txt) {
                await this.commitCompaction(traceId, trimResult, txt)
              }
              yield {
                type: 'context_compacted',
                status: 'completed',
                compactedCount: trimResult.removedCount,
                ...(txt ? { summary: txt } : {}),
              }
            }
          }
        }
      }
      const history = await memory.getAll(this.sessionId)
      const systemBlocks = buildSystemPrompt(systemPrompt ?? '', skills)
      const request: ChatRequest = {
        model,
        messages: history,
        system: systemBlocks,
        tools: tools.all().length > 0 ? tools.all() : undefined,
        ...(maxTokens !== undefined ? { maxTokens } : {}),
      }

      // Per-iteration telemetry — local heuristic; see runLoop for rationale.
      const estimatedSystemTokens =
        systemBlocks.length > 0 ? estimateTokens([{ role: 'user', content: JSON.stringify(systemBlocks) }]) : 0
      const estimatedHistoryTokens = estimateTokens(history)
      const systemPromptChars = JSON.stringify(systemBlocks).length

      const callIndex = totalModelCalls

      // Emit text via streaming
      let firstToken = true
      const streamStart = Date.now()
      const textParts: string[] = []

      hooks?.model?.before?.({
        agentId: this.id,
        sessionId: this.sessionId,
        traceId,
        callIndex,
        model,
        systemBlockCount: systemBlocks.length,
        estimatedSystemTokens,
        estimatedHistoryTokens,
        systemPromptChars,
        contextTokens: estimatedSystemTokens + estimatedHistoryTokens,
        toolCount: tools.all().length,
      })

      let finalStopReason: StopReason = 'end_turn'
      const toolUseBlocks: ToolUseBlock[] = []
      const thinkingBlocks: ThinkingBlock[] = []
      let sawThinkingDelta = false
      let thinkingCompleted = false
      let assistantItems: RoxyAssistantItem[] | undefined
      let endTurn: boolean | undefined
      let sawMessageStop = false

      try {
        for await (const chunk of provider.stream(request, signal)) {
          if (chunk.type === 'text_delta') {
            if (sawThinkingDelta && !thinkingCompleted) {
              thinkingCompleted = true
              yield { type: 'thinking_complete', callIndex }
            }
            textParts.push(chunk.text)
            yield { type: 'text', delta: chunk.text, callIndex }
            if (firstToken) {
              firstToken = false
              hooks?.model?.firstToken?.({
                agentId: this.id,
                sessionId: this.sessionId,
                traceId,
                callIndex,
                latencyMs: Date.now() - streamStart,
              })
            }
          } else if (chunk.type === 'thinking_delta') {
            sawThinkingDelta = true
            yield { type: 'thinking', delta: chunk.text, callIndex }
          } else if (chunk.type === 'thinking_block') {
            // Preserve the signed thinking block for history round-trip
            // (Anthropic requires it on subsequent turns when thinking is on).
            thinkingBlocks.push(chunk.block)
          } else if (chunk.type === 'web_search_call') {
            yield { type: 'web_search_call', item: chunk.item, callIndex }
          } else if (chunk.type === 'tool_use') {
            toolUseBlocks.push(chunk.block)
          } else if (chunk.type === 'message_stop') {
            sawMessageStop = true
            finalStopReason = chunk.stopReason
            endTurn = chunk.endTurn
            assistantItems = chunk.items
            this.lastInputTokens = chunk.usage.inputTokens
            if (tokenAcc) {
              tokenAcc.input += chunk.usage.inputTokens
              tokenAcc.output += chunk.usage.outputTokens
            }
            hooks?.model?.after?.({
              agentId: this.id,
              sessionId: this.sessionId,
              traceId,
              callIndex,
              model,
              stopReason: chunk.stopReason,
              inputTokens: chunk.usage.inputTokens,
              outputTokens: chunk.usage.outputTokens,
              cachedInputTokens: chunk.usage.cachedInputTokens,
              durationMs: Date.now() - streamStart,
            })
          }
        }
      } catch (error) {
        hooks?.model?.error?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          callIndex,
          model,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - streamStart,
        })
        const partialAssistantMsg = this.buildPartialAssistantMessage(textParts, thinkingBlocks)
        if (partialAssistantMsg) {
          await this.recordAssistantTurn(partialAssistantMsg, finalStopReason)
        }
        throw error
      }

      if (!sawMessageStop) {
        const partialAssistantMsg = this.buildPartialAssistantMessage(textParts, thinkingBlocks)
        if (partialAssistantMsg) {
          await this.recordAssistantTurn(partialAssistantMsg, finalStopReason)
        }
        throw new Error('Agent stream ended without a terminal response event')
      }

      if (sawThinkingDelta && !thinkingCompleted) {
        yield { type: 'thinking_complete', callIndex }
      }

      totalModelCalls++

      // Only keep tool_use blocks for tools we can actually resolve.
      // If the model calls an internal/unknown tool (e.g. DeepSeek built-ins),
      // treat the whole response as end_turn to avoid committing an
      // assistant message with unresolvable tool_use blocks that would
      // cause the provider to reject subsequent tool_result messages.
      const shouldRunTools = finalStopReason === 'tool_use'
      const resolvableBlocks = shouldRunTools ? toolUseBlocks.filter((b) => tools.resolve(b.name)) : []
      for (const block of shouldRunTools ? toolUseBlocks : []) {
        if (tools.resolve(block.name)) {
          continue
        }
        const missingIndex = totalToolCalls++
        hooks?.tool?.before?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: 'builtin',
          toolUseId: block.id,
          callIndex: missingIndex,
          isSensitive: false,
        })
        hooks?.tool?.after?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: 'builtin',
          toolUseId: block.id,
          callIndex: missingIndex,
          isError: true,
          errorKind: 'not_found',
          durationMs: 0,
        })
      }
      const effectiveToolUseBlocks =
        finalStopReason === 'tool_use' && resolvableBlocks.length > 0 ? resolvableBlocks : []
      const effectiveStopReason: StopReason =
        finalStopReason === 'tool_use' && effectiveToolUseBlocks.length === 0 ? 'end_turn' : finalStopReason
      const needsFollowUp = effectiveStopReason === 'tool_use' || endTurn === false
      const keepTranscriptItems =
        finalStopReason !== 'max_tokens' &&
        finalStopReason === effectiveStopReason &&
        (shouldRunTools ? effectiveToolUseBlocks.length === toolUseBlocks.length : toolUseBlocks.length === 0)
      // Reconstruct assistant message from stream. Thinking blocks (with
      // signatures) MUST precede text/tool_use so they round-trip on the
      // next turn (Anthropic ordering requirement for extended thinking).
      const bodyBlocks: ContentBlock[] =
        effectiveToolUseBlocks.length > 0 ? effectiveToolUseBlocks : [{ type: 'text', text: textParts.join('') }]
      const assistantContent: ContentBlock[] = [...thinkingBlocks, ...bodyBlocks]
      const assistantMsg: Message = {
        role: 'assistant',
        content: assistantContent,
      }
      const storedItems =
        keepTranscriptItems && assistantItems && assistantItems.length > 0
          ? assistantItems
          : assistantMessageToItems(assistantMsg)
      assistantMsg.transcriptItems = storedItems
      await this.deps.memory.append(this.sessionId, assistantMsg)
      await this.record({ type: 'assistant_turn', items: storedItems, stopReason: effectiveStopReason })
      recorder.emit({ traceId, ts: Date.now(), phase: 'model_thought', data: { stopReason: effectiveStopReason } })

      if (!needsFollowUp) {
        yield { type: 'done', stopReason: effectiveStopReason }
        break
      }

      if (effectiveStopReason !== 'tool_use') {
        continue
      }

      // Process tools
      const toolResults: ToolResultBlock[] = []
      const directReturnCandidate =
        toolUseBlocks.length === 1 &&
        effectiveToolUseBlocks.length === 1 &&
        tools.resolve(effectiveToolUseBlocks[0]!.name)?.descriptor.returnDirect === true
      for (const block of effectiveToolUseBlocks) {
        yield { type: 'tool_call', block, callIndex }

        if (signal?.aborted) {
          break
        }

        const descriptor = tools.resolve(block.name)?.descriptor
        const toolEvents: ToolEvent[] = []
        const ctx = {
          agentId: this.id,
          traceId,
          signal: signal ?? new AbortController().signal,
          metadata: this.deps.toolContext,
          emit: (event: ToolEvent) => toolEvents.push(event),
          agentPath: this.agentPath,
          agentManager: this.deps.agentManager,
        }
        const toolCallIndex = totalToolCalls
        const mwCtx: ToolMiddlewareContext = {
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? 'builtin',
          toolUseId: block.id,
          callIndex: toolCallIndex,
        }

        // HITL check (stream mode: park on Promise, emit hitl_pending)
        if (descriptor && hitl.needsApproval(descriptor, block.input)) {
          recorder.emit({ traceId, ts: Date.now(), phase: 'hitl_intercept', data: { toolName: block.name } })
          const preview = await runPreviewMiddleware(middleware ?? [], block.name, block.input, mwCtx)
          const approvalRequest = await buildApprovalRequest(descriptor, block.input, traceId, {
            reason: 'HITL check',
            ...(preview.aborted ? { skipPreview: true } : { previewInput: preview.input }),
          })
          let resolveApproval!: (r: ApprovalResult) => void
          const approvalPromise = new Promise<ApprovalResult>((r) => {
            resolveApproval = r
          })
          const pending: PendingApproval = {
            traceId,
            request: approvalRequest,
            resume: resolveApproval,
          }
          this.pendingApprovals.set(traceId, resolveApproval)
          yield { type: 'hitl_pending', pending }

          const approval = await approvalPromise
          this.pendingApprovals.delete(traceId)

          if (approval.decision === 'reject') {
            const feedback = approval.feedback ?? `Tool "${block.name}" was rejected by HITL`
            const r = { toolUseId: block.id, content: feedback, isError: true }
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: feedback, is_error: true })
            yield { type: 'tool_result', result: r }
            continue
          }
        }

        hooks?.tool?.before?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? 'builtin',
          toolUseId: block.id,
          callIndex: toolCallIndex,
          isSensitive: descriptor ? toolNeedsHumanApproval(descriptor) : false,
        })

        const toolStart = Date.now()
        const beforeResult = await runBeforeMiddleware(middleware ?? [], block.name, block.input, mwCtx)

        let result: ToolResult
        let errorKind: ToolErrorKind | undefined

        if (beforeResult.aborted) {
          errorKind = 'aborted'
          result = { toolUseId: block.id, content: beforeResult.error.message, isError: true }
        } else {
          // Race the tool against parked clarifications: an ask_user (or a
          // plugin auth request) suspends INSIDE the handler, so the only
          // way the UI can hear about it is to interleave the yield here.
          const execution = this.executor
            .execute(block.name, beforeResult.input, ctx, block.id)
            .then((raw) => runAfterMiddleware(middleware ?? [], block.name, raw, mwCtx))
          const settled = execution.then((r) => ({ done: true as const, r }))
          let raced: ToolResult | undefined
          while (raced === undefined) {
            while (this.clarificationQueue.length > 0) {
              yield { type: 'clarification_pending', pending: this.clarificationQueue.shift()! }
            }
            const winner = await Promise.race([
              settled,
              this.nextClarificationSignal().then(() => ({ done: false as const })),
            ])
            if (winner.done) {
              raced = winner.r
            }
          }
          result = raced
          if (result.isError) {
            errorKind = result.errorKind ?? 'handler_error'
          }
        }
        totalToolCalls++

        hooks?.tool?.after?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? 'builtin',
          toolUseId: block.id,
          callIndex: toolCallIndex,
          isError: result.isError,
          errorKind,
          durationMs: Date.now() - toolStart,
        })

        recorder.emit({
          traceId,
          ts: Date.now(),
          phase: 'tool_executed',
          data: { toolName: block.name, isError: result.isError },
        })
        if (!result.isError) {
          for (const event of toolEvents) {
            this.recordToolEvent(traceId, event)
            yield event
          }
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: result.toolUseId,
          content: result.content,
          is_error: result.isError,
        })
        yield { type: 'tool_result', result }
      }

      if (toolResults.length > 0) {
        const toolResultMsg: Message = { role: 'user', content: toolResults }
        await memory.append(this.sessionId, toolResultMsg)
        for (const r of toolResults) {
          await this.record({ type: 'tool_result', result: r })
        }
        const returnDirect = directReturnCandidate && toolResults.length === 1 && toolResults[0]!.is_error !== true
        if (returnDirect) {
          yield { type: 'done', stopReason: 'end_turn' }
          break
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // resume / clarify / dispose
  // -------------------------------------------------------------------------

  resume(traceId: string, decision: ApprovalResult): void {
    const resolve = this.pendingApprovals.get(traceId)
    if (resolve) {
      resolve(decision)
      this.pendingApprovals.delete(traceId)
    }
  }

  clarify(traceId: string, result: ClarificationResult): void {
    const resolve = this.pendingClarifications.get(traceId)
    if (resolve) {
      resolve(result)
      this.pendingClarifications.delete(traceId)
    }
  }

  cancelPending(reason = 'Agent interaction cancelled'): void {
    for (const resolve of this.pendingApprovals.values()) {
      resolve({ decision: 'reject', feedback: reason })
    }
    this.pendingApprovals.clear()

    for (const resolve of this.pendingClarifications.values()) {
      resolve({ answer: '' })
    }
    this.pendingClarifications.clear()
  }

  addDisposeCallback(cb: () => void | Promise<void>): void {
    this.disposeCallbacks.push(cb)
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.cancelPending('Agent disposed')
    for (const cb of [...this.disposeCallbacks].toReversed()) {
      await cb()
    }
  }
}

// Re-export for the AgentRuntime assembler
export type { AgentGraph, AgentGraphDeps } from './graph.ts'
