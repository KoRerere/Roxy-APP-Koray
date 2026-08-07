import type { ZodType } from "zod";
import type {
  Agent,
  AgentInput,
  AgentResponse,
  AgentStreamEvent,
  ApprovalResult,
  ChatRequest,
  ClarificationResult,
  ContentBlock,
  Message,
  PendingApproval,
  PendingClarification,
  RolloutEvent,
  SessionId,
  StopReason,
  StructuredAgent,
  StructuredOutputOptions,
  SubAgentOptions,
  SystemBlock,
  ThinkingBlock,
  ToolErrorKind,
  ToolEvent,
  ToolMiddlewareContext,
  ToolResult,
  ToolResultBlock,
  ToolUseBlock,
  TrimSummary,
} from "../core/interfaces.ts";
import { ToolExecutor } from "../tools/executor.ts";
import { buildSystemPrompt } from "../memory/summarizer.ts";
import { estimateTokens } from "../provider/estimate.ts";
import { SuspendingClarificationHandler } from "../clarification/handler.ts";
import type { AgentGraph, AgentGraphDeps } from "./graph.ts";
import { extractDeps } from "./graph.ts";
import { runAfterMiddleware, runBeforeMiddleware } from "./middleware_chain.ts";
import { renderSelectedSkillMessages, skillCatalogBudgetChars } from "../skills/prompt.ts";

function unwrapAgentInput(input: AgentInput): {
  conversationInput: string | Message[];
  selections: import("../core/interfaces.ts").SkillSelection[];
} {
  if (typeof input === "string" || Array.isArray(input)) {
    return { conversationInput: input, selections: [] };
  }
  return { conversationInput: input.input, selections: input.skills ?? [] };
}

function isToolResultMessage(message: Message): boolean {
  return (
    message.role === "user" &&
    Array.isArray(message.content) &&
    message.content.some((block) => block.type === "tool_result")
  );
}

function injectTurnContext(history: Message[], contextualMessages: Message[]): Message[] {
  if (contextualMessages.length === 0) return history;
  for (let index = history.length - 1; index >= 0; index--) {
    const message = history[index]!;
    if (message.role === "user" && !isToolResultMessage(message)) {
      return [...history.slice(0, index), ...contextualMessages, ...history.slice(index)];
    }
  }
  return [...contextualMessages, ...history];
}

function parseArchivedMessages(archivedText: string): Message[] {
  if (!archivedText) return [];
  return archivedText.split("\n").map((line): Message => {
    const i = line.indexOf(": ");
    if (i < 0) return { role: "user", content: line };
    const role = line.slice(0, i) as Message["role"];
    const contentText = line.slice(i + 2);
    try {
      return { role, content: JSON.parse(contentText) as ContentBlock[] };
    } catch {
      return { role, content: contentText };
    }
  });
}

/**
 * Internal {@link Agent} implementation. Owns the tool-use loop, HITL
 * intercept, context-contributor chain, lifecycle hooks, and stream/resume
 * machinery. The package root exposes {@link AgentRuntime} instead.
 */
export class AgentImpl implements Agent {
  readonly id: string;
  readonly sessionId: SessionId;

  private readonly deps: AgentGraphDeps;
  private readonly executor: ToolExecutor;
  private disposed = false;
  private readonly disposeCallbacks: Array<() => void | Promise<void>> = [];

  // Key = traceId (one pending approval per trace at a time in Phase 4).
  private readonly pendingApprovals = new Map<string, (r: ApprovalResult) => void>();
  private readonly pendingClarifications = new Map<string, (r: ClarificationResult) => void>();
  // Pendings parked by a SuspendingClarificationHandler, awaiting a
  // `clarification_pending` yield from an active stream (drained by the
  // streamLoop's execute-race; resolved out-of-band via clarify() otherwise).
  private readonly clarificationQueue: PendingClarification[] = [];
  private clarificationArrived: (() => void)[] = [];
  // REAL context size as last reported by the API (`usage.input_tokens` of the
  // most recent model call). The compaction trigger prefers this over the
  // chars/4 heuristic — code-heavy histories drift far from the estimate.
  // 0 = no signal yet (fresh/resumed session, or just compacted).
  private lastInputTokens = 0;

  constructor(graph: AgentGraph, _deps: unknown, id: string, sessionId: SessionId) {
    this.id = id;
    this.sessionId = sessionId;
    this.deps = extractDeps(graph);
    this.executor = new ToolExecutor(this.deps.tools);
    // Wire the interactive clarification channel: parked ask_user requests
    // register for Agent.clarify() and surface as clarification_pending
    // stream events (see the execute-race in streamLoop).
    if (this.deps.clarification instanceof SuspendingClarificationHandler) {
      this.deps.clarification.onPending = (p) => this.acceptPendingClarification(p);
    }
  }

  private recordToolEvent(traceId: string, event: ToolEvent): void {
    this.deps.recorder.emit({
      traceId,
      ts: Date.now(),
      phase: event.type,
      data: { todos: event.todos },
    });
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
        this.pendingClarifications.delete(p.traceId);
        const i = this.clarificationQueue.indexOf(wrapped);
        if (i >= 0) this.clarificationQueue.splice(i, 1);
        p.resume(r);
      },
    };
    this.pendingClarifications.set(p.traceId, wrapped.resume);
    this.clarificationQueue.push(wrapped);
    const waiters = this.clarificationArrived;
    this.clarificationArrived = [];
    for (const w of waiters) w();
  }

  /** Resolves when the next clarification parks (used by the stream race). */
  private nextClarificationSignal(): Promise<void> {
    return new Promise((resolve) => this.clarificationArrived.push(resolve));
  }

  /**
   * Double-write hook: mirror a `memory.append` into the durable rollout store,
   * when one is configured. Failures are swallowed (and warned) so a rollout
   * write error never kills the live conversation — mirroring the framework's
   * "failure never crosses the loop boundary" convention. Writes are awaited
   * (not fire-and-forget) so event order matches the live history.
   */
  private async record(event: RolloutEvent): Promise<void> {
    const { sessionStore, logger } = this.deps;
    if (!sessionStore) return;
    try {
      await sessionStore.append(this.sessionId, event);
    } catch (err) {
      logger.warn("rollout append failed — continuing without persistence", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async emitMemoryTurnEnd(ctx: {
    traceId: string;
    input: AgentInput;
    userMessage: Message;
    producedMessages: Message[];
    stopReason: StopReason;
    totalModelCalls: number;
    totalToolCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    durationMs: number;
    aborted: boolean;
  }): Promise<void> {
    for (const lifecycle of this.deps.memoryLifecycles ?? []) {
      try {
        await lifecycle.onTurnEnd?.({
          agentId: this.id,
          sessionId: this.sessionId,
          ...ctx,
        });
      } catch (err) {
        this.deps.logger.warn("memory lifecycle onTurnEnd failed — continuing", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async emitMemoryCompaction(traceId: string, trimResult: TrimSummary, summary: string): Promise<void> {
    if ((this.deps.memoryLifecycles ?? []).length === 0) return;
    const ts = Date.now();
    const archivedMessages = parseArchivedMessages(trimResult.archivedText);
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
        });
      } catch (err) {
        this.deps.logger.warn("memory lifecycle onCompaction failed — continuing", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // invoke — run the loop to completion
  // -------------------------------------------------------------------------

  async invoke(input: AgentInput, signal?: AbortSignal): Promise<AgentResponse> {
    const { memory, recorder, hooks } = this.deps;
    const { conversationInput, selections } = unwrapAgentInput(input);
    const traceId = recorder.start(
      typeof conversationInput === "string" ? [{ role: "user", content: conversationInput }] : conversationInput,
    );
    const startTime = Date.now();
    let aborted = false;

    // Token accumulators — fed by runLoop via shared closure so invoke()
    // reports real token usage, not hardcoded placeholders.
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const fireAbort = () => {
      if (aborted) return;
      aborted = true;
      hooks?.invoke?.abort?.({
        agentId: this.id,
        sessionId: this.sessionId,
        traceId,
        elapsedMs: Date.now() - startTime,
        modelCallsSoFar: 0,
        toolCallsSoFar: 0,
      });
    };

    if (signal?.aborted) {
      fireAbort();
    } else if (signal) {
      signal.addEventListener("abort", fireAbort);
    }

    hooks?.invoke?.before?.({
      agentId: this.id,
      sessionId: this.sessionId,
      traceId,
      mode: "invoke",
      input,
    });

    // Append the user message (or last message if array)
    const userMsg: Message =
      typeof conversationInput === "string"
        ? { role: "user", content: conversationInput }
        : (conversationInput[conversationInput.length - 1] ?? { role: "user", content: "" });
    await memory.append(this.sessionId, userMsg);
    await this.record({ type: "user_input", message: userMsg });
    const skillMessages = await renderSelectedSkillMessages(selections, this.deps.skills ?? []);

    const produced: Message[] = [];
    let totalModelCalls = 0;
    let totalToolCalls = 0;
    let finalStopReason: StopReason = "end_turn";

    if (!aborted) {
      try {
        const loop = this.runLoop(traceId, signal, { input: 0, output: 0 }, skillMessages);
        for await (const msg of loop) {
          // Extract token accumulator from the final synthetic yield before
          // skipping it — it carries no user-visible content.
          if ("_tokenAcc" in msg) {
            const acc = (msg as Message & { _tokenAcc?: { input: number; output: number } })._tokenAcc;
            if (acc) {
              totalInputTokens = acc.input;
              totalOutputTokens = acc.output;
            }
            continue; // don't push the synthetic message
          }
          produced.push(msg);
          if ("_stopReason" in msg) {
            finalStopReason = (msg as Message & { _stopReason: StopReason })._stopReason;
          }
        }
      } catch {
        // swallow on abort
      }
    }

    // Re-derive counts from memory (simpler than threading counts through)
    for (const m of produced) {
      if (m.role === "assistant") totalModelCalls++;
      if (m.role === "user" && Array.isArray(m.content))
        totalToolCalls += (m.content as ContentBlock[]).filter((b) => b.type === "tool_result").length;
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
    });

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
    });

    recorder.end(traceId);

    return { messages: produced, trajectory: recorder.getTrace(traceId) };
  }

  // -------------------------------------------------------------------------
  // stream — yield events as they happen
  // -------------------------------------------------------------------------

  async *stream(input: AgentInput, signal?: AbortSignal): AsyncIterable<AgentStreamEvent> {
    const { memory, recorder, hooks } = this.deps;
    const { conversationInput, selections } = unwrapAgentInput(input);
    const traceId = recorder.start(
      typeof conversationInput === "string" ? [{ role: "user", content: conversationInput }] : conversationInput,
    );
    const startTime = Date.now();

    hooks?.invoke?.before?.({
      agentId: this.id,
      sessionId: this.sessionId,
      traceId,
      mode: "stream",
      input,
    });

    // Snapshot history length before the loop so we can derive counts
    // for just this stream() call (not the entire session history).
    const historyBefore = await memory.getAll(this.sessionId);

    const userMsg: Message =
      typeof conversationInput === "string"
        ? { role: "user", content: conversationInput }
        : (conversationInput[conversationInput.length - 1] ?? { role: "user", content: "" });
    await memory.append(this.sessionId, userMsg);
    await this.record({ type: "user_input", message: userMsg });
    const skillMessages = await renderSelectedSkillMessages(selections, this.deps.skills ?? []);

    // Accumulate tokens across the stream loop for invoke.after reporting.
    const tokenAcc = { input: 0, output: 0 };
    let finalStopReason: StopReason = "end_turn";

    for await (const event of this.streamLoop(traceId, signal, tokenAcc, skillMessages)) {
      if (event.type === "done") {
        finalStopReason = event.stopReason;
      }
      yield event;
    }

    // Count only messages added during this stream() call.
    const historyAfter = await memory.getAll(this.sessionId);
    const newMessages = historyAfter.slice(historyBefore.length + 1); // +1 for userMsg
    let totalModelCalls = 0;
    let totalToolCalls = 0;
    for (const m of newMessages) {
      if (m.role === "assistant") totalModelCalls++;
      if (m.role === "user" && Array.isArray(m.content)) {
        totalToolCalls += (m.content as ContentBlock[]).filter((b) => b.type === "tool_result").length;
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
      aborted: false,
    });

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
      aborted: false,
    });

    recorder.end(traceId);
  }

  structured<T>(schema: ZodType<T>, options?: StructuredOutputOptions): StructuredAgent<T> {
    const extract = this.deps.provider.withStructuredOutput(schema, options);
    return {
      invoke: async (input, signal) => {
        await this.invoke(input, signal);
        const history = await this.deps.memory.getAll(this.sessionId);
        return extract(history, signal);
      },
    };
  }

  // -------------------------------------------------------------------------
  // Core loop (produces Message[] for invoke)
  // -------------------------------------------------------------------------

  private async *runLoop(
    traceId: string,
    signal?: AbortSignal,
    tokenAcc?: { input: number; output: number },
    skillMessages: Message[] = [],
  ): AsyncIterable<Message & { _stopReason?: StopReason }> {
    const {
      provider,
      tools,
      memory,
      hitl,
      recorder,
      hooks,
      contributors,
      middleware,
      deps: _unused,
    } = {
      ...this.deps,
      deps: null,
    };
    const { model, maxTokens, systemPrompt, trimPolicy, summarizer } = this.deps;

    let totalModelCalls = 0;
    let totalToolCalls = 0;
    let finalStopReason: StopReason = "end_turn";
    let firstIteration = true;

    while (true) {
      if (signal?.aborted) break;

      // Trim history once per invoke (before the first model call only) so we
      // never trim mid-tool-loop where the last message is a tool_result.
      //
      // Trigger: REAL context size of the last model call (usage.input_tokens)
      // when available, else the chars/4 estimate (fresh/resumed session).
      // When triggered, trim old messages, summarize them, and inject the
      // summary as a user message at the front of the remaining history so
      // the model sees it as conversation context.
      if (firstIteration && trimPolicy) {
        const triggerTokens = this.deps.triggerTokens ?? 150_000;
        const history = await memory.getAll(this.sessionId);
        const contextTokens =
          this.lastInputTokens > 0
            ? this.lastInputTokens
            : history.length > 0
              ? await provider.countTokens(history)
              : 0;
        if (contextTokens > triggerTokens) {
          // The signal is consumed — the next model call re-measures the
          // compacted context, and a stale value must not re-trigger.
          this.lastInputTokens = 0;
          const trimResult = await memory.trim(this.sessionId, trimPolicy);
          if (trimResult.removedCount > 0) {
            recorder.emit({
              traceId,
              ts: Date.now(),
              phase: "memory_trimmed",
              data: { removedCount: trimResult.removedCount },
            });
            if (summarizer && trimResult.archivedText) {
              const txt = await summarizer.summarize(trimResult.archivedText);
              if (txt) {
                await this.record({
                  type: "compaction",
                  summary: txt,
                  compactedCount: trimResult.removedCount,
                  ts: Date.now(),
                });
                await this.emitMemoryCompaction(traceId, trimResult, txt);
                await memory.prependMessage(this.sessionId, {
                  role: "user",
                  content: `Previous conversation summary:\n<summary>\n${txt}\n</summary>`,
                });
              }
            }
          }
        }
      }
      firstIteration = false;

      // Assemble system blocks
      const summary = await memory.getSummary(this.sessionId);
      const baseBlocks = buildSystemPrompt(
        systemPrompt ?? "",
        summary,
        this.deps.skills ?? [],
        skillCatalogBudgetChars(this.deps.contextWindowTokens),
      );
      const extraBlocks: SystemBlock[] = [];
      for (const contributor of contributors ?? []) {
        try {
          const history = await memory.getAll(this.sessionId);
          const blocks = await contributor.contribute({
            agentId: this.id,
            sessionId: this.sessionId,
            traceId,
            recentMessages: history.slice(-10),
          });
          extraBlocks.push(...blocks);
        } catch {
          // contributor errors are swallowed
        }
      }

      const history = await memory.getAll(this.sessionId);
      const requestMessages = injectTurnContext(history, skillMessages);
      const allSystemBlocks = [...baseBlocks, ...extraBlocks];
      const request: ChatRequest = {
        model,
        messages: requestMessages,
        system: allSystemBlocks,
        tools: tools.all().length > 0 ? tools.all() : undefined,
        maxTokens,
      };

      // Per-iteration telemetry — local chars/4 heuristic, NOT
      // provider.countTokens: that may hit the vendor's count endpoint, and
      // two network calls per iteration is too dear for hook estimates.
      const estimatedSystemTokens =
        allSystemBlocks.length > 0 ? estimateTokens([{ role: "user", content: JSON.stringify(allSystemBlocks) }]) : 0;
      const estimatedHistoryTokens = estimateTokens(requestMessages);

      const callIndex = totalModelCalls;
      hooks?.model?.before?.({
        agentId: this.id,
        sessionId: this.sessionId,
        traceId,
        callIndex,
        model,
        systemBlockCount: allSystemBlocks.length,
        estimatedSystemTokens,
        estimatedHistoryTokens,
        toolCount: tools.all().length,
      });

      const modelStart = Date.now();
      const response = await provider.chat(request, signal);
      totalModelCalls++;

      // Accumulate token usage for invoke() reporting.
      if (tokenAcc) {
        tokenAcc.input += response.usage.inputTokens;
        tokenAcc.output += response.usage.outputTokens;
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
        durationMs: Date.now() - modelStart,
      });

      this.lastInputTokens = response.usage.inputTokens;

      // Filter to only tool_use blocks we can resolve; unresolvable blocks
      // (e.g. provider-internal tools) are stripped to avoid invalid history.
      const allContent: ContentBlock[] =
        typeof response.message.content !== "string" ? (response.message.content as ContentBlock[]) : [];
      const allToolUseBlocks: ToolUseBlock[] = allContent.filter((b): b is ToolUseBlock => b.type === "tool_use");
      const toolUseBlocks = allToolUseBlocks.filter((b) => tools.resolve(b.name));
      // Thinking blocks (with signatures) must round-trip when the turn
      // uses tools — Anthropic requires them on subsequent turns. Prepend
      // them ahead of tool_use; in the no-tool branch they're already kept.
      const thinkingBlocks: ThinkingBlock[] = allContent.filter((b): b is ThinkingBlock => b.type === "thinking");
      const effectiveContent: ContentBlock[] =
        toolUseBlocks.length > 0
          ? [...thinkingBlocks, ...toolUseBlocks]
          : ((typeof response.message.content === "string"
              ? response.message.content
              : (response.message.content as ContentBlock[]).filter((b) => b.type !== "tool_use")) as ContentBlock[]);
      const effectiveMessage: Message = {
        role: "assistant",
        content: effectiveContent,
        ...(response.message.providerState ? { providerState: response.message.providerState } : {}),
      };
      const effectiveStopReason: StopReason =
        response.stopReason === "tool_use" && toolUseBlocks.length === 0 ? "end_turn" : response.stopReason;

      await memory.append(this.sessionId, effectiveMessage);
      await this.record({ type: "assistant_turn", message: effectiveMessage, stopReason: effectiveStopReason });
      finalStopReason = effectiveStopReason;
      recorder.emit({ traceId, ts: Date.now(), phase: "model_thought", data: { stopReason: effectiveStopReason } });

      const msg: Message & { _stopReason?: StopReason } = {
        ...effectiveMessage,
        _stopReason: effectiveStopReason,
      };
      yield msg;

      if (effectiveStopReason !== "tool_use") break;

      const toolResults: ToolResultBlock[] = [];

      for (const block of toolUseBlocks) {
        if (signal?.aborted) break;

        const descriptor = tools.resolve(block.name)?.descriptor;
        const toolEvents: ToolEvent[] = [];
        const ctx = {
          agentId: this.id,
          traceId,
          signal: signal ?? new AbortController().signal,
          emit: (event: ToolEvent) => toolEvents.push(event),
        };

        // HITL check (invoke mode: call handler synchronously)
        if (descriptor && hitl.needsApproval(descriptor, block.input)) {
          recorder.emit({ traceId, ts: Date.now(), phase: "hitl_intercept", data: { toolName: block.name } });
          const approval = await hitl.requestApproval({
            toolName: block.name,
            input: block.input,
            reason: "HITL check",
            traceId,
          });
          if (approval.decision === "reject") {
            const feedback = approval.feedback ?? `Tool "${block.name}" was rejected by HITL`;
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: feedback, is_error: true });
            continue;
          }
        }

        const toolCallIndex = totalToolCalls;
        const mwCtx: ToolMiddlewareContext = {
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? "builtin",
          toolUseId: block.id,
          callIndex: toolCallIndex,
        };

        hooks?.tool?.before?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? "builtin",
          toolUseId: block.id,
          callIndex: toolCallIndex,
          isSensitive: descriptor?.metadata?.sensitive === true,
        });

        const toolStart = Date.now();
        const beforeResult = await runBeforeMiddleware(middleware ?? [], block.name, block.input, mwCtx);

        let result: ToolResult;
        let errorKind: ToolErrorKind | undefined;

        if (beforeResult.aborted) {
          errorKind = "aborted";
          result = { toolUseId: block.id, content: beforeResult.error.message, isError: true };
        } else {
          const rawResult = await this.executor.execute(block.name, beforeResult.input, ctx, block.id);
          result = await runAfterMiddleware(middleware ?? [], block.name, rawResult, mwCtx);
        }
        totalToolCalls++;

        hooks?.tool?.after?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? "builtin",
          toolUseId: block.id,
          callIndex: toolCallIndex,
          isError: result.isError,
          errorKind,
          durationMs: Date.now() - toolStart,
        });

        recorder.emit({
          traceId,
          ts: Date.now(),
          phase: "tool_executed",
          data: { toolName: block.name, isError: result.isError },
        });
        if (!result.isError) {
          for (const event of toolEvents) this.recordToolEvent(traceId, event);
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: result.toolUseId,
          content: result.content,
          is_error: result.isError,
        });
      }

      if (toolResults.length > 0) {
        const toolResultMsg: Message = { role: "user", content: toolResults };
        await memory.append(this.sessionId, toolResultMsg);
        for (const r of toolResults) {
          await this.record({ type: "tool_result", result: r });
        }
        yield { ...toolResultMsg, _stopReason: undefined };
      }

      void finalStopReason; // suppress unused warning
    }

    // Yield a synthetic message carrying the accumulated token counts so
    // invoke() can report real usage instead of hardcoded placeholders.
    if (tokenAcc) {
      yield { role: "user", content: "", _stopReason: undefined, _tokenAcc: tokenAcc } as Message & {
        _stopReason?: StopReason;
        _tokenAcc?: { input: number; output: number };
      };
    }
  }

  // -------------------------------------------------------------------------
  // Stream loop (yields AgentStreamEvents)
  // -------------------------------------------------------------------------

  private async *streamLoop(
    traceId: string,
    signal?: AbortSignal,
    tokenAcc?: { input: number; output: number },
    skillMessages: Message[] = [],
  ): AsyncIterable<AgentStreamEvent> {
    const { provider, tools, memory, hitl, recorder, hooks, contributors, middleware } = this.deps;
    const { model, maxTokens, systemPrompt, trimPolicy, summarizer } = this.deps;

    let totalModelCalls = 0;
    let totalToolCalls = 0;
    let firstIteration = true;

    while (true) {
      if (signal?.aborted) break;

      // Trim history once per stream() call (before the first model call only)
      // so we never trim mid-tool-loop where the last message is a tool_result.
      // Same trigger as runLoop: real usage of the last call, else the estimate.
      if (firstIteration && trimPolicy) {
        const triggerTokens = this.deps.triggerTokens ?? 150_000;
        const history = await memory.getAll(this.sessionId);
        const contextTokens =
          this.lastInputTokens > 0
            ? this.lastInputTokens
            : history.length > 0
              ? await provider.countTokens(history)
              : 0;
        if (contextTokens > triggerTokens) {
          this.lastInputTokens = 0;
          const trimResult = await memory.trim(this.sessionId, trimPolicy);
          if (trimResult.removedCount > 0) {
            recorder.emit({
              traceId,
              ts: Date.now(),
              phase: "memory_trimmed",
              data: { removedCount: trimResult.removedCount },
            });
            if (summarizer && trimResult.archivedText) {
              const txt = await summarizer.summarize(trimResult.archivedText);
              if (txt) {
                await this.record({
                  type: "compaction",
                  summary: txt,
                  compactedCount: trimResult.removedCount,
                  ts: Date.now(),
                });
                await this.emitMemoryCompaction(traceId, trimResult, txt);
                await memory.prependMessage(this.sessionId, {
                  role: "user",
                  content: `Previous conversation summary:\n<summary>\n${txt}\n</summary>`,
                });
              }
            }
          }
        }
      }
      firstIteration = false;

      const summary = await memory.getSummary(this.sessionId);
      const baseBlocks = buildSystemPrompt(
        systemPrompt ?? "",
        summary,
        this.deps.skills ?? [],
        skillCatalogBudgetChars(this.deps.contextWindowTokens),
      );
      const extraBlocks: SystemBlock[] = [];
      for (const contributor of contributors ?? []) {
        try {
          const history = await memory.getAll(this.sessionId);
          const blocks = await contributor.contribute({
            agentId: this.id,
            sessionId: this.sessionId,
            traceId,
            recentMessages: history.slice(-10),
          });
          extraBlocks.push(...blocks);
        } catch {
          // swallow
        }
      }

      const history = await memory.getAll(this.sessionId);
      const requestMessages = injectTurnContext(history, skillMessages);
      const allSystemBlocks = [...baseBlocks, ...extraBlocks];
      const request: ChatRequest = {
        model,
        messages: requestMessages,
        system: allSystemBlocks,
        tools: tools.all().length > 0 ? tools.all() : undefined,
        maxTokens,
      };

      // Per-iteration telemetry — local heuristic; see runLoop for rationale.
      const estimatedSystemTokens =
        allSystemBlocks.length > 0 ? estimateTokens([{ role: "user", content: JSON.stringify(allSystemBlocks) }]) : 0;
      const estimatedHistoryTokens = estimateTokens(requestMessages);

      const callIndex = totalModelCalls;

      // Emit text via streaming
      let firstToken = true;
      const streamStart = Date.now();
      const textParts: string[] = [];

      hooks?.model?.before?.({
        agentId: this.id,
        sessionId: this.sessionId,
        traceId,
        callIndex,
        model,
        systemBlockCount: allSystemBlocks.length,
        estimatedSystemTokens,
        estimatedHistoryTokens,
        toolCount: tools.all().length,
      });

      let finalStopReason: StopReason = "end_turn";
      let providerState: Message["providerState"];
      const toolUseBlocks: ToolUseBlock[] = [];
      const thinkingBlocks: ThinkingBlock[] = [];

      for await (const chunk of provider.chatStream(request, signal)) {
        if (chunk.type === "text_delta") {
          textParts.push(chunk.text);
          yield { type: "text", delta: chunk.text, callIndex };
          if (firstToken) {
            firstToken = false;
            hooks?.model?.firstToken?.({
              agentId: this.id,
              sessionId: this.sessionId,
              traceId,
              callIndex,
              latencyMs: Date.now() - streamStart,
            });
          }
        } else if (chunk.type === "thinking_delta") {
          yield { type: "thinking", delta: chunk.text, callIndex };
        } else if (chunk.type === "thinking_block") {
          // Preserve the signed thinking block for history round-trip
          // (Anthropic requires it on subsequent turns when thinking is on).
          thinkingBlocks.push(chunk.block);
        } else if (chunk.type === "tool_use") {
          toolUseBlocks.push(chunk.block);
          yield { type: "tool_call", block: chunk.block, callIndex };
        } else if (chunk.type === "message_stop") {
          finalStopReason = chunk.stopReason;
          providerState = chunk.providerState;
          this.lastInputTokens = chunk.usage.inputTokens;
          if (tokenAcc) {
            tokenAcc.input += chunk.usage.inputTokens;
            tokenAcc.output += chunk.usage.outputTokens;
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
            durationMs: Date.now() - streamStart,
          });
        }
      }

      totalModelCalls++;

      // Only keep tool_use blocks for tools we can actually resolve.
      // If the model calls an internal/unknown tool (e.g. DeepSeek built-ins),
      // treat the whole response as end_turn to avoid committing an
      // assistant message with unresolvable tool_use blocks that would
      // cause the provider to reject subsequent tool_result messages.
      const resolvableBlocks = toolUseBlocks.filter((b) => tools.resolve(b.name));
      const effectiveToolUseBlocks = resolvableBlocks.length > 0 ? resolvableBlocks : [];
      const effectiveStopReason: StopReason =
        finalStopReason === "tool_use" && effectiveToolUseBlocks.length === 0 ? "end_turn" : finalStopReason;

      // Reconstruct assistant message from stream. Thinking blocks (with
      // signatures) MUST precede text/tool_use so they round-trip on the
      // next turn (Anthropic ordering requirement for extended thinking).
      const bodyBlocks: ContentBlock[] =
        effectiveToolUseBlocks.length > 0 ? effectiveToolUseBlocks : [{ type: "text", text: textParts.join("") }];
      const assistantContent: ContentBlock[] = [...thinkingBlocks, ...bodyBlocks];
      const assistantMsg: Message = {
        role: "assistant",
        content: assistantContent,
        ...(providerState ? { providerState } : {}),
      };
      await memory.append(this.sessionId, assistantMsg);
      await this.record({ type: "assistant_turn", message: assistantMsg, stopReason: effectiveStopReason });
      recorder.emit({ traceId, ts: Date.now(), phase: "model_thought", data: { stopReason: effectiveStopReason } });

      if (effectiveStopReason !== "tool_use") {
        yield { type: "done", stopReason: effectiveStopReason };
        break;
      }

      // Process tools
      const toolResults: ToolResultBlock[] = [];
      for (const block of effectiveToolUseBlocks) {
        if (signal?.aborted) break;

        const descriptor = tools.resolve(block.name)?.descriptor;
        const toolEvents: ToolEvent[] = [];
        const ctx = {
          agentId: this.id,
          traceId,
          signal: signal ?? new AbortController().signal,
          emit: (event: ToolEvent) => toolEvents.push(event),
        };

        // HITL check (stream mode: park on Promise, emit hitl_pending)
        if (descriptor && hitl.needsApproval(descriptor, block.input)) {
          recorder.emit({ traceId, ts: Date.now(), phase: "hitl_intercept", data: { toolName: block.name } });
          let resolveApproval!: (r: ApprovalResult) => void;
          const approvalPromise = new Promise<ApprovalResult>((r) => {
            resolveApproval = r;
          });
          const pending: PendingApproval = {
            traceId,
            request: { toolName: block.name, input: block.input, reason: "HITL check", traceId },
            resume: resolveApproval,
          };
          this.pendingApprovals.set(traceId, resolveApproval);
          yield { type: "hitl_pending", pending };

          const approval = await approvalPromise;
          this.pendingApprovals.delete(traceId);

          if (approval.decision === "reject") {
            const feedback = approval.feedback ?? `Tool "${block.name}" was rejected by HITL`;
            const r = { toolUseId: block.id, content: feedback, isError: true };
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: feedback, is_error: true });
            yield { type: "tool_result", result: r };
            continue;
          }
        }

        const toolCallIndex = totalToolCalls;
        const mwCtx: ToolMiddlewareContext = {
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? "builtin",
          toolUseId: block.id,
          callIndex: toolCallIndex,
        };

        hooks?.tool?.before?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? "builtin",
          toolUseId: block.id,
          callIndex: toolCallIndex,
          isSensitive: descriptor?.metadata?.sensitive === true,
        });

        const toolStart = Date.now();
        const beforeResult = await runBeforeMiddleware(middleware ?? [], block.name, block.input, mwCtx);

        let result: ToolResult;
        let errorKind: ToolErrorKind | undefined;

        if (beforeResult.aborted) {
          errorKind = "aborted";
          result = { toolUseId: block.id, content: beforeResult.error.message, isError: true };
        } else {
          // Race the tool against parked clarifications: an ask_user (or a
          // plugin auth request) suspends INSIDE the handler, so the only
          // way the UI can hear about it is to interleave the yield here.
          const execution = this.executor
            .execute(block.name, beforeResult.input, ctx, block.id)
            .then((raw) => runAfterMiddleware(middleware ?? [], block.name, raw, mwCtx));
          const settled = execution.then((r) => ({ done: true as const, r }));
          let raced: ToolResult | undefined;
          while (raced === undefined) {
            while (this.clarificationQueue.length > 0) {
              yield { type: "clarification_pending", pending: this.clarificationQueue.shift()! };
            }
            const winner = await Promise.race([
              settled,
              this.nextClarificationSignal().then(() => ({ done: false as const })),
            ]);
            if (winner.done) raced = winner.r;
          }
          result = raced;
        }
        totalToolCalls++;

        hooks?.tool?.after?.({
          agentId: this.id,
          sessionId: this.sessionId,
          traceId,
          toolName: block.name,
          toolSource: descriptor?.source ?? "builtin",
          toolUseId: block.id,
          callIndex: toolCallIndex,
          isError: result.isError,
          errorKind,
          durationMs: Date.now() - toolStart,
        });

        recorder.emit({
          traceId,
          ts: Date.now(),
          phase: "tool_executed",
          data: { toolName: block.name, isError: result.isError },
        });
        if (!result.isError) {
          for (const event of toolEvents) {
            this.recordToolEvent(traceId, event);
            yield event;
          }
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: result.toolUseId,
          content: result.content,
          is_error: result.isError,
        });
        yield { type: "tool_result", result };
      }

      if (toolResults.length > 0) {
        const toolResultMsg: Message = { role: "user", content: toolResults };
        await memory.append(this.sessionId, toolResultMsg);
        for (const r of toolResults) {
          await this.record({ type: "tool_result", result: r });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // resume / clarify / delegate / dispose
  // -------------------------------------------------------------------------

  resume(traceId: string, decision: ApprovalResult): void {
    const resolve = this.pendingApprovals.get(traceId);
    if (resolve) {
      resolve(decision);
      this.pendingApprovals.delete(traceId);
    }
  }

  clarify(traceId: string, result: ClarificationResult): void {
    const resolve = this.pendingClarifications.get(traceId);
    if (resolve) {
      resolve(result);
      this.pendingClarifications.delete(traceId);
    }
  }

  cancelPending(reason = "Agent interaction cancelled"): void {
    for (const resolve of this.pendingApprovals.values()) {
      resolve({ decision: "reject", feedback: reason });
    }
    this.pendingApprovals.clear();

    for (const resolve of this.pendingClarifications.values()) {
      resolve({ answer: "" });
    }
    this.pendingClarifications.clear();
  }

  async delegate(_task: string, _options: SubAgentOptions): Promise<AgentResponse[]> {
    // Phase 7: SubAgent
    return [];
  }

  addDisposeCallback(cb: () => void | Promise<void>): void {
    this.disposeCallbacks.push(cb);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelPending("Agent disposed");
    for (const cb of [...this.disposeCallbacks].reverse()) {
      await cb();
    }
  }
}

// Re-export for the AgentRuntime assembler
export type { AgentGraph, AgentGraphDeps } from "./graph.ts";
