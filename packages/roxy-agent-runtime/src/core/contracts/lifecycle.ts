import type { AgentInput, AgentStreamEvent } from "./agent.ts";
import type { SessionId } from "./memory.ts";
import type { StopReason } from "./provider.ts";
import type { SubAgentOptions } from "./subagent.ts";
import type { ToolErrorKind, ToolSource } from "./tools.ts";

// ---------------------------------------------------------------------------
// Lifecycle Hooks (external observation — metrics / eval / benchmarking)
// ---------------------------------------------------------------------------

/**
 * Hook contexts — one interface per hook, carrying exactly the fields that
 * phase needs. Common fields (agentId, sessionId, traceId) appear on every
 * context so consumers can correlate across a multi-hook pipeline without
 * additional bookkeeping.
 */

export interface InvokeBeforeContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  /** Which entry-point the caller used — useful for separating invoke vs stream metrics. */
  mode: "invoke" | "stream";
  input: AgentInput;
}

export interface InvokeAfterContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  stopReason: StopReason;
  /** Total number of LLM API calls made inside this invoke. */
  totalModelCalls: number;
  totalToolCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  durationMs: number;
  /** True when the caller's AbortSignal fired; results are incomplete. */
  aborted: boolean;
}

export interface InvokeAbortContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  /** Wall-clock time from invoke.before to the abort signal. */
  elapsedMs: number;
  /** Progress counters at the moment of abort. */
  modelCallsSoFar: number;
  toolCallsSoFar: number;
}

export interface ModelBeforeContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  /** 0-based index of this LLM call within the current invoke. */
  callIndex: number;
  model: string;
  /** Number of SystemBlock entries in ChatRequest.system. */
  systemBlockCount: number;
  /** Token estimate for the system prompt blocks (local chars/4 heuristic). */
  estimatedSystemTokens: number;
  /** Token estimate for the message history (local chars/4 heuristic). */
  estimatedHistoryTokens: number;
  /** Number of tools exposed in this request. */
  toolCount: number;
}

export interface ModelFirstTokenContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  callIndex: number;
  /** Wall-clock milliseconds from model.before to the first text delta. */
  latencyMs: number;
}

export interface ModelAfterContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  callIndex: number;
  model: string;
  stopReason: StopReason;
  inputTokens: number;
  outputTokens: number;
  /** Wall-clock ms for the full model call (request sent → last token). */
  durationMs: number;
  // Derived: tokens/s = outputTokens / (durationMs / 1000)
}

export interface ToolBeforeContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  toolName: string;
  toolSource: ToolSource;
  toolUseId: string;
  /** 0-based index of this tool call within the current invoke. */
  callIndex: number;
  /** True when descriptor.metadata.sensitive === true. */
  isSensitive: boolean;
}

export interface ToolAfterContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  toolName: string;
  toolSource: ToolSource;
  toolUseId: string;
  callIndex: number;
  /**
   * Whether the tool produced an error result **as seen by the model** —
   * i.e. the POST-{@link ToolMiddleware} state. If a middleware recovered
   * from a handler error (`isError: false` after `after()` transforms it),
   * this will be `false`. If a middleware introduced a new error, this will
   * be `true`. This is intentional: hooks measure what the model experienced,
   * not the raw handler internals.
   *
   * If you need "raw handler error count" (pre-middleware), capture it inside
   * the middleware itself rather than relying on this hook field.
   *
   * See the Execution Order Contract comment block for the full pipeline.
   */
  isError: boolean;
  /**
   * Present only when `isError` is `true`. Classifies the error origin.
   * Also reflects the post-middleware value: if middleware changed `isError`
   * to `true`, it should set an appropriate `errorKind` in the returned
   * {@link ToolResult} (carried here as a convention — the runtime reads
   * it from the result's metadata when available, else infers from context).
   */
  errorKind?: ToolErrorKind;
  /** Wall-clock ms from tool.before hook to tool.after hook (step ⑨ → ⑬), including middleware execution time. */
  durationMs: number;
}

export interface SubagentBeforeContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  task: string;
  options: SubAgentOptions;
}

export interface SubagentAfterContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  task: string;
  options: SubAgentOptions;
  /** Actual number of subagents that completed (parallel may be < count on error). */
  completedCount: number;
  durationMs: number;
  /** True if any subagent returned an error response. */
  hasErrors: boolean;
}

export interface StreamChunkContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  /** The AgentStreamEvent being emitted on this tick. */
  event: AgentStreamEvent;
  /** 0-based index of this chunk within the current stream() call. */
  chunkIndex: number;
}

/**
 * Optional lifecycle hooks for external observation of agent execution.
 * Distinct from {@link ITrajectoryRecorder} (internal append-only log for
 * replay/debug) — hooks are fire-and-forget callbacks designed for metrics
 * collection, eval harnesses, and benchmarking.
 *
 * Hooks are grouped into five namespaces by concern. Implement only the
 * subset you care about — every field is optional:
 *
 *   invoke   — the full invoke() / stream() lifecycle (start, end, abort)
 *   model    — each LLM API call within the loop (before, first token, after)
 *   tool     — each tool execution (before handler runs, after it resolves)
 *   subagent — delegation to child agents (before fan-out, after all complete)
 *   stream   — per-chunk observation during stream() (not fired by invoke())
 *
 * ALL hooks are synchronous — the runtime never awaits them. If you need
 * async processing (e.g. writing to a remote metrics store), push to an
 * internal queue and drain it outside the hook. Blocking in a hook will
 * perturb the latency measurements you are trying to collect.
 *
 * Injected via {@link AgentDefinition.hooks}; forwarded to
 * {@link AgentGraphDeps} by the AgentRuntime assembler.
 *
 * @example
 * const agent = await AgentRuntime.create({
 *   // provider, memory, tools, hitl, recorder, logger, ...
 *   hooks: {
 *     model: {
 *       firstToken: ({ latencyMs }) => metrics.record("first_token_ms", latencyMs),
 *       after: ({ outputTokens, durationMs }) =>
 *         metrics.record("tokens_per_sec", outputTokens / (durationMs / 1000)),
 *     },
 *     tool: {
 *       after: ({ toolName, isError, errorKind }) =>
 *         isError && logger.warn("tool failed", { toolName, errorKind }),
 *     },
 *     invoke: {
 *       after: ({ totalInputTokens, totalOutputTokens, durationMs, aborted }) =>
 *         bench.record({ totalInputTokens, totalOutputTokens, durationMs, aborted }),
 *     },
 *   },
 * });
 */
export interface AgentLifecycleHooks {
  /** Fires once at the boundary of invoke() / stream(). */
  invoke?: {
    before?: (ctx: InvokeBeforeContext) => void;
    after?: (ctx: InvokeAfterContext) => void;
    /** Fires immediately when the AbortSignal fires, before the loop exits. */
    abort?: (ctx: InvokeAbortContext) => void;
  };
  /** Fires for each LLM API call within the invoke loop. */
  model?: {
    before?: (ctx: ModelBeforeContext) => void;
    /** Fires on the first streaming text delta — primary latency measurement point. */
    firstToken?: (ctx: ModelFirstTokenContext) => void;
    after?: (ctx: ModelAfterContext) => void;
  };
  /** Fires for each tool execution (after HITL approval, if any). */
  tool?: {
    before?: (ctx: ToolBeforeContext) => void;
    after?: (ctx: ToolAfterContext) => void;
  };
  /** Fires when the agent delegates to subagents via {@link Agent.delegate}. */
  subagent?: {
    before?: (ctx: SubagentBeforeContext) => void;
    after?: (ctx: SubagentAfterContext) => void;
  };
  /**
   * Fires for every {@link AgentStreamEvent} emitted during stream().
   * Not fired during invoke(). Use for side-channel observation when you
   * are not the primary consumer of the async iterable.
   */
  stream?: {
    chunk?: (ctx: StreamChunkContext) => void;
  };
}

// ---------------------------------------------------------------------------
// Execution Order Contract
// ---------------------------------------------------------------------------
//
// Canonical reference for WHEN each hook fires, WHEN middleware runs, and
// WHEN contributors are called — relative to each other, and to HITL,
// clarification, and subagent events.
//
// Key invariants:
//   • Hooks observe the OUTER boundary.  Hooks always see POST-middleware
//     values (e.g. tool.after.isError reflects what the model received, not
//     what the raw handler returned before middleware touched it).
//   • Middleware transforms the INNER detail.  Middleware runs between a
//     hook.before and the corresponding hook.after.
//   • Contributors run on the REQUEST PATH.  They are awaited before each
//     LLM call; async retrieval (vector DB, HTTP) is fully supported.
//   • All hooks are synchronous and fire-and-forget.  The runtime never
//     awaits them.  A throwing hook is caught, logged, and silently ignored
//     — it MUST NOT crash the agent loop.
//
// ─────────────────────────────────────────────────────────────────────────
// AgentRuntime.create(definition)
// ─────────────────────────────────────────────────────────────────────────
//
//   for each plugin in definition.plugins  (declaration order):
//     await plugin.setup(api)
//     → registers tools / contributors / hooks / middleware / onDispose
//
// ─────────────────────────────────────────────────────────────────────────
// agent.invoke(input) / agent.stream(input)
// ─────────────────────────────────────────────────────────────────────────
//
//   ① invoke.before hook  (sync, multi-cast)
//
//   ┌─ agent loop  (repeats for every model turn until stop ≠ tool_use) ──┐
//   │                                                                      │
//   │  ② IContextContributor.contribute() × N  (awaited, in order)        │
//   │     → returns extra SystemBlock[] appended AFTER built-in blocks     │
//   │                                                                      │
//   │  ③ ChatRequest assembled:                                            │
//   │     system = [base | skill-catalog | summary | contributor blocks…]  │
//   │                                                                      │
//   │  ④ model.before hook  (sync)                                         │
//   │     systemBlockCount and estimatedTokens reflect contributor output  │
//   │                                                                      │
//   │  ⑤ LLM API call                                                      │
//   │                                                                      │
//   │  ⑥ model.firstToken hook  (sync — stream mode only, on first delta)  │
//   │                                                                      │
//   │  ⑦ model.after hook  (sync — after full response received)           │
//   │                                                                      │
//   │  for each tool_use block in the response:                            │
//   │                                                                      │
//   │    ⑧  HITL check  (IHITLHandler.needsApproval?)                     │
//   │        yes → emit hitl_pending; await Agent.resume()                 │
//   │              rejected: feed rejection feedback to model, continue    │
//   │              approved: proceed to ⑨                                  │
//   │        no  → proceed directly to ⑨                                   │
//   │                                                                      │
//   │    ⑨  tool.before hook  (sync)                                       │
//   │                                                                      │
//   │    ⑩  ToolMiddleware.before chain  (awaited, registration order)     │
//   │        → may return a modified input                                 │
//   │        → may throw to ABORT: handler is skipped; after-chain and     │
//   │          tool.after hook still run with                               │
//   │          isError: true / errorKind: "aborted"                        │
//   │                                                                      │
//   │    ⑪  tool handler  (await)                                          │
//   │                                                                      │
//   │    ⑫  ToolMiddleware.after chain  (awaited, REVERSE order)           │
//   │        → may return a modified ToolResult (isError, content)         │
//   │        → cannot abort; handler has already run                       │
//   │                                                                      │
//   │    ⑬  tool.after hook  (sync)                                        │
//   │        isError / errorKind = POST-middleware state (model's view)    │
//   │        durationMs = wall-clock from ⑨ to ⑬ (includes middleware)    │
//   │                                                                      │
//   │        ── ask_user tool (clarification) ─────────────────────────── │
//   │        Handler parks until Agent.clarify() resolves or timeoutMs     │
//   │        fires.  Emits clarification_pending stream event.             │
//   │        Hooks and middleware apply identically to any other tool.     │
//   │                                                                      │
//   │        ── subagent dispatch tool ───────────────────────────────── │
//   │        Handler calls Agent.delegate(); inside that call:             │
//   │          subagent.before hook                                        │
//   │          [child agents run — each has its own full loop above]       │
//   │          subagent.after hook                                         │
//   │        Handler returns, execution continues at ⑫.                   │
//   │                                                                      │
//   └──────────────────────────────────────────────────────────────────────┘
//
//   ⑭ invoke.after hook  (sync)
//      totalInputTokens / totalOutputTokens = sum across ALL loop turns
//      aborted = true if AbortSignal fired (invoke.abort also fires then)
//
// ─────────────────────────────────────────────────────────────────────────
// stream() — additional
// ─────────────────────────────────────────────────────────────────────────
//
//   stream.chunk hook fires for EVERY AgentStreamEvent emitted:
//     text | tool_call | hitl_pending | clarification_pending |
//     tool_result | todo_updated | done
//   Not fired during invoke().  Fires AFTER the event has been enqueued in
//   the async iterable (the consumer may not have pulled it yet).
//
// ─────────────────────────────────────────────────────────────────────────
// agent.dispose()
// ─────────────────────────────────────────────────────────────────────────
//
//   onDispose callbacks run in REVERSE registration order, each awaited.
//   Plugin A registered first → disposes last.
//
// ─────────────────────────────────────────────────────────────────────────
// Multi-cast ordering
// ─────────────────────────────────────────────────────────────────────────
//
//   HOOKS (when multiple listeners are registered):
//     1. Plugin hooks — fired in plugin declaration order.
//     2. AgentDefinition.hooks — fired AFTER all plugin hooks.
//   Rationale: plugins are infrastructure (inner); per-invocation observers
//   like test harnesses and benchmarks are the outermost layer.
//
//   CONTRIBUTORS (IContextContributor.contribute call order):
//     1. Standalone contributors (AgentGraphDeps.contributors, in array order).
//     2. Plugin contributors (plugin declaration order).
//   Blocks from later contributors appear later in the system prompt
//   (i.e. closer to the model call — highest recency priority).
//
//   MIDDLEWARE.before (execution order):
//     Registration order — first-registered = outermost (runs first).
//   MIDDLEWARE.after (execution order):
//     Reverse registration order — first-registered = innermost (runs last).
//   This is the standard onion/middleware convention (Express, Koa, etc.).
