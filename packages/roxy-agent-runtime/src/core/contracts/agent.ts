import type { ZodType } from 'zod'
import type { IClarificationHandler, ClarificationResult, PendingClarification } from './clarification.ts'
import type { IContextContributor } from './context.ts'
import type { ApprovalResult, IHITLHandler, PendingApproval } from './hitl.ts'
import type { AgentLifecycleHooks } from './lifecycle.ts'
import type { ILogger } from './logging.ts'
import type { IMemoryProvider, ISessionStore, SessionId, Summarizer, TrimPolicy } from './memory.ts'
import type { ITrajectoryRecorder, TrajectoryEvent } from './observability.ts'
import type { RoxyPlugin, ToolMiddleware } from './plugins.ts'
import type {
  IModelProvider,
  Message,
  RoxyWebSearchCallItem,
  StopReason,
  StructuredOutputOptions,
  ToolUseBlock,
} from './provider.ts'
import type { SkillManifest, SkillSelection } from './skills.ts'
import type { AgentPath, IAgentManager } from './agent-manager.ts'
import type { ToolEvent } from './todo.ts'
import type { IToolRegistry, ToolResult } from './tools.ts'

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/**
 * One agent turn plus any skills explicitly selected by the host/user.
 * When `input` is a message array, every leading item is turn-start context
 * and must use the user or developer role; the final item is the visible user
 * request. `trailingMessages` are persisted immediately after that request and
 * are always marked internal.
 */
export interface AgentTurnInput {
  input: string | Message[]
  trailingMessages?: Message[]
  skills?: SkillSelection[]
}

export type AgentInput = string | Message[] | AgentTurnInput

export type AgentStreamEvent =
  | { type: 'text'; delta: string; callIndex: number }
  | { type: 'thinking'; delta: string; callIndex: number }
  | { type: 'thinking_complete'; callIndex: number }
  | { type: 'tool_call'; block: ToolUseBlock; callIndex: number }
  | { type: 'web_search_call'; item: RoxyWebSearchCallItem; callIndex: number }
  | { type: 'hitl_pending'; pending: PendingApproval }
  /**
   * The model called `ask_user` and is waiting for a reply. Resolve via
   * {@link Agent.clarify} with the user's answer. If the request carries a
   * `timeoutMs`, the loop auto-resolves with `answer: ""` after that delay.
   */
  | { type: 'clarification_pending'; pending: PendingClarification }
  | { type: 'tool_result'; result: ToolResult }
  | { type: 'context_compacted'; status: 'started' | 'completed'; compactedCount: number; summary?: string }
  | ToolEvent
  | { type: 'done'; stopReason: StopReason }

export interface AgentResponse {
  /** Messages produced during this `invoke()` call (assistant turns + tool results), oldest-first. Does NOT include the input. */
  messages: Message[]
  /** Ordered trajectory events for THIS call only (not cumulative across calls). */
  trajectory: TrajectoryEvent[]
}

/**
 * A schema-bound Agent view. Calling `invoke()` runs a normal Agent turn,
 * then performs one typed extraction call over the resulting session history.
 */
export interface StructuredAgent<T> {
  invoke(input: AgentInput, signal?: AbortSignal): Promise<T>
}

export interface Agent {
  /** Agent instance id (identifies the assembled config, stable). */
  readonly id: string
  /**
   * The session this instance is bound to. One Agent instance per sessionId;
   * supplying the same id to {@link AgentRuntime.create} on a later run resumes this
   * session's history. Isolation is per-instance.
   */
  readonly sessionId: SessionId
  /**
   * Run one agent turn (model → tool loop → end). The loop continues until
   * the model stops calling tools or HITL rejects a critical tool. Resolves
   * with all messages and trajectory events produced during this call.
   *
   * @param signal - Cooperative cancellation. Aborting the signal cancels the
   *   in-flight provider call and any running tool handler. The loop exits
   *   cleanly; partially-accumulated messages are NOT returned — the caller
   *   should treat abort as an empty/cancelled response. Handlers MUST
   *   forward the signal to child processes / fetch calls.
   */
  invoke(input: AgentInput, signal?: AbortSignal): Promise<AgentResponse>
  /**
   * Streaming variant of {@link invoke}. Emits incremental events as the
   * loop runs: text deltas, tool calls, HITL checkpoints, tool results, and
   * a terminal `done`. See {@link AgentStreamEvent}.
   *
   * @param signal - Same cooperative-cancellation semantics as `invoke`. On
   *   abort the async iterable completes without a `done` event.
   */
  stream(input: AgentInput, signal?: AbortSignal): AsyncIterable<AgentStreamEvent>
  /**
   * Bind an output schema without mutating this Agent instance.
   *
   * The returned view first runs the complete Agent loop, including tools,
   * memory, HITL, and lifecycle hooks. It then asks the configured provider to
   * extract `T` from the updated session history. The extraction result is not
   * appended to memory.
   */
  structured<T>(schema: ZodType<T>, options?: StructuredOutputOptions): StructuredAgent<T>
  /**
   * Resume a HITL-suspended loop turn.
   *
   * During a `stream()` (or `invoke()`) the loop may park at a tool call
   * awaiting human approval, emitting a `hitl_pending` event. The outer
   * caller — a CLI, a UI, or an automated approver — calls `resume()` with
   * the `traceId` from that event and the human's decision. The loop then
   * either executes the tool (approved) or feeds the rejection feedback back
   * to the model (rejected) and continues.
   *
   * Calling `resume()` with an unknown or already-resolved `traceId` is a
   * no-op.
   */
  resume(traceId: string, decision: ApprovalResult): void
  /**
   * Resolve a model-initiated clarification request.
   *
   * Call this after receiving a `clarification_pending` stream event, once
   * the user has answered (or a timeout has fired). The loop feeds
   * `result.answer` back to the model as the `tool_result` content of the
   * `ask_user` call and continues execution.
   *
   * Calling `clarify()` with an unknown or already-resolved `traceId` is a
   * no-op.
   */
  clarify(traceId: string, result: ClarificationResult): void
  /**
   * Release every currently parked HITL approval and clarification request.
   *
   * This is an interaction-lifecycle operation, not cancellation of an
   * in-flight model or tool call. Hosts that need to stop the whole run own an
   * `AbortController` and pass its signal to `invoke()` or `stream()`.
   * Pending approvals are rejected with `reason`; clarifications receive an
   * empty answer. It is safe to call when nothing is parked.
   */
  cancelPending(reason?: string): void
  /**
   * Tear down the agent and release all resources.
   *
   * Runs all `onDispose` callbacks registered by plugins (in reverse
   * registration order), then clears the internal graph state. After
   * `dispose()` the instance MUST NOT be used — any subsequent `invoke()` /
   * `stream()` call will throw.
   *
   * Idempotent: calling dispose twice on the same instance is a no-op on the
   * second call.
   */
  dispose(): Promise<void>
}

/**
 * Complete object graph for one Agent instance.
 *
 * The framework consumes concrete interface implementations rather than a
 * deployment config. Hosts own provider selection, persistence layout, tool
 * composition, and all environment/config parsing before they call
 * `AgentRuntime.create`.
 *
 * Omit `sessionId` to generate a fresh id. Supply one to replay that session
 * through the injected `ISessionStore` before the first invocation.
 */
export interface AgentDefinition {
  sessionId?: SessionId
  agentId?: string
  model: string
  maxTokens?: number
  systemPrompt?: string
  provider: IModelProvider
  memory: IMemoryProvider
  tools: IToolRegistry
  hitl: IHITLHandler
  recorder: ITrajectoryRecorder
  logger: ILogger
  /** Host-specific metadata forwarded to every tool invocation. */
  toolContext?: Record<string, unknown>
  sessionStore?: ISessionStore
  clarification?: IClarificationHandler
  hooks?: AgentLifecycleHooks
  contributors?: IContextContributor[]
  middleware?: ToolMiddleware[]
  trimPolicy?: TrimPolicy
  summarizer?: Summarizer
  contextWindowTokens?: number
  triggerTokens?: number
  skills?: SkillManifest[]
  /**
   * Trusted path of this agent. Omit on a root agent (the runtime registers
   * `/root`); supply on a managed child so tools read a trustworthy identity
   * instead of a model-supplied parent path.
   */
  agentPath?: AgentPath
  /**
   * Manager owning this agent tree. Omit on root to let the runtime create
   * one; supply the parent's manager on a managed child so spawn/list/wait
   * share one tree.
   */
  agentManager?: IAgentManager
  plugins?: RoxyPlugin[]
  /**
   * Called after the Agent is disposed. Hosts use this to close resources they
   * deliberately transfer to this Agent's lifecycle.
   */
  onDispose?: () => void | Promise<void>
}
