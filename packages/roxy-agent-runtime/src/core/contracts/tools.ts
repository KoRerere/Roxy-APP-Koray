import type { ZodError, ZodType } from 'zod'
import type { AgentPath, IAgentManager } from './agent-manager.ts'
import type { ToolCallNormalizer } from './provider.ts'
import type { ToolEvent } from './todo.ts'

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** Serialized JSON Schema used only at provider and MCP protocol boundaries. */
export type JsonSchema = Record<string, unknown>

export type ToolSource = 'builtin' | 'skill' | 'mcp'

export interface ToolAnnotations {
  /** Human-readable tool title, matching MCP ToolAnnotations. */
  title?: string
  /** If true, the tool does not modify its environment. */
  readOnlyHint?: boolean
  /** If true, the tool may perform destructive updates to its environment. */
  destructiveHint?: boolean
  /** If true, repeated calls with the same arguments have no additional effect. */
  idempotentHint?: boolean
  /** If true, the tool may interact with external entities. */
  openWorldHint?: boolean
}

export interface ToolDescriptor {
  name: string
  description: string
  /** Provider-facing input kind. Custom tools accept free-form text. */
  kind?: 'function' | 'custom'
  /**
   * The single source of truth for model-facing input documentation, runtime
   * validation, defaults, and transforms. Hand-written JSON Schema is not
   * accepted for locally registered tools.
   */
  inputSchema: ZodType
  source: ToolSource
  /**
   * End the current Agent turn after this tool succeeds as the only resolved
   * tool call in a model response. The marker is runtime-local and is never
   * projected into a provider-facing tool schema.
   */
  returnDirect?: boolean
  /** Runtime-local formatter for strict Zod input failures. */
  formatInputError?: (input: unknown, error: ZodError) => string
  /** Standard MCP-style tool annotations. For MCP tools this is copied from tools/list. */
  annotations?: ToolAnnotations
  /** Runtime-local free-form metadata. This is not an MCP field and does not drive HITL. */
  metadata?: Record<string, unknown>
  /**
   * Optional diff preview callback. When present, `HitlInterceptor` calls it
   * before requesting approval and attaches the result as
   * {@link ApprovalRequest.diff}. Errors are silently swallowed — a missing
   * diff never blocks the approval flow.
   *
   * Intended for mutating tools such as `apply_patch` that can show the exact
   * proposed change before executing.
   */
  previewFn?: (input: unknown) => Promise<string | undefined>
}

export interface ToolContext {
  agentId: string
  traceId: string
  /** Identifier of the concrete model tool-use block being executed. */
  toolUseId?: string
  /** Queue an event that the runtime publishes only if the final tool result succeeds. */
  emit?: (event: ToolEvent) => void
  /**
   * Cooperative-cancellation signal, owned by the runtime/executor. A handler
   * MUST check/await on this (e.g. pass to child processes, poll in loops) so
   * an aborted agent turn does not leave work running. Aborting the signal is
   * not itself an error — the executor surfaces an `isError` ToolResult if a
   * handler rejects with an `AbortError`.
   */
  signal: AbortSignal
  /** Host-specific metadata forwarded to adapted application tools. */
  metadata?: Record<string, unknown>
  /** Trusted path of the agent that owns this tool call; never model-supplied. */
  agentPath?: AgentPath
  /** Manager owning the agent tree, for spawn/list/wait delegation tools. */
  agentManager?: IAgentManager
}

export interface ToolResult {
  toolUseId: string
  content: string
  isError: boolean
  /** Machine-readable failure category for hooks, metrics, and middleware. */
  errorKind?: ToolErrorKind
}

/** The body of a tool result, minus the id (the executor stamps `toolUseId`). */
export interface ToolHandlerResult {
  content: string
  isError: boolean
  /** Usually stamped by the executor; direct validating wrappers may set it. */
  errorKind?: ToolErrorKind
}

export type ToolHandler = (input: unknown, ctx: ToolContext) => Promise<ToolHandlerResult>

/** A complete tool registration entry with one Zod schema and one handler. */
export interface ToolDefinition {
  descriptor: ToolDescriptor
  handler: ToolHandler
}

export interface IToolRegistry {
  /**
   * Register a tool. On a name collision the new entry replaces the old and a
   * warning is logged; the previous handler is dropped. The decision key is
   * the complete user-facing `name` only (NOT `{source}.{name}`). MCP clients
   * namespace remote tools as `mcp_{server-name}__{tool-name}` before
   * registration; any remaining exact-name collision still replaces the old
   * entry.
   */
  add(descriptor: ToolDescriptor, handler: ToolHandler): void
  remove(name: string): void
  resolve(name: string): { descriptor: ToolDescriptor; handler: ToolHandler } | undefined
  all(): ToolDescriptor[]
  /**
   * Project the unified tool list into Anthropic's `tools` shape:
   * `{ name, description, input_schema }` (note the snake_case
   * `input_schema`). Custom free-form tools are excluded because Anthropic
   * function tools require an object input schema.
   */
  toAnthropicTools(): AnthropicTool[]
}

export interface AnthropicTool {
  name: string
  description: string
  input_schema: JsonSchema
}

/**
 * Construction options for {@link ToolExecutor} implementations.
 */
export interface ToolExecutorOptions {
  /**
   * Optional normaliser applied to every tool-use block before dispatch.
   * Correct model-produced quirks here rather than in individual handlers.
   * Defaults to identity (no normalisation).
   */
  normalizer?: ToolCallNormalizer
}

export interface ToolExecutor {
  /**
   * Execute a registered tool by name inside a sandbox.
   *
   * Failure modes never reject — they return a `ToolResult` so the agent loop
   * stays alive:
   *  - unknown tool name → `{ isError: true, errorKind: "not_found", content: "tool not found: <name>" }`
   *  - invalid input     → `{ isError: true, errorKind: "input_invalid", content: <zod error> }`
   *  - handler throws    → `{ isError: true, content: <Error.message> }`
   *  - handler rejects with an AbortError (signal aborted) →
   *      `{ isError: true, content: "aborted" }`
   *  - handler returns    → passed through (handler's own isError/content).
   *
   * Every resolved tool input is parsed by its Zod schema immediately before
   * the handler runs. Handlers receive the parsed value, including defaults
   * and transforms, and are never called for invalid input.
   * `toolUseId` is taken from the call site and echoed back on the result.
   */
  execute(name: string, input: unknown, ctx: ToolContext, toolUseId: string): Promise<ToolResult>
}

/**
 * Classification of why a tool execution failed. Carried by
 * {@link ToolAfterContext} so hook consumers can distinguish model-side errors
 * from infrastructure errors without parsing free-text content strings.
 *
 * - `not_found`     — the model called a tool name absent from the registry.
 *                     Indicates hallucination or a stale tool list in the prompt.
 * - `input_invalid` — the model passed input that failed schema validation.
 *                     Indicates a misunderstanding of the tool's contract.
 * - `handler_error` — the registered handler threw or returned `isError: true`.
 *                     Indicates a bug or transient failure in the tool itself.
 * - `aborted`       — the AbortSignal fired while the handler was running.
 *                     Not a model or tool error — initiated by the caller.
 */
export type ToolErrorKind = 'not_found' | 'input_invalid' | 'handler_error' | 'aborted'
